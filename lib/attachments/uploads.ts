import "server-only";
import { randomUUID } from "node:crypto";
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import prisma from "@/lib/prisma";
import { ATTACHMENT_CONFIG, validateAttachment } from "@/constants/attachments";
import { AttachmentError } from "./http";
import { r2, readBytes, removeStoredFile } from "./r2";
import { validateFileContent } from "./validation";

export async function startUpload(
  userId: string,
  input: { roomId: string; name: string; size: number; mimeType: string },
) {
  let type;
  try {
    type = validateAttachment(input.name, input.size, input.mimeType);
  } catch (error) {
    throw new AttachmentError((error as Error).message);
  }
  const { client, bucket } = r2();
  const file = await prisma.$transaction(async (tx) => {
    // Serialize quota checks for this user, even across separate server instances.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const now = new Date();
    const pending = await tx.attachmentUpload.count({
      where: {
        ownerId: userId,
        messageSerial: null,
        deletedAt: null,
        expiresAt: { gt: now },
      },
    });
    const recent = await tx.attachmentUpload.count({
      where: {
        ownerId: userId,
        createdAt: { gt: new Date(Date.now() - 3_600_000) },
      },
    });
    if (
      pending >= ATTACHMENT_CONFIG.maxPendingPerUser ||
      recent >= ATTACHMENT_CONFIG.maxUploadsPerHour
    )
      throw new AttachmentError(
        "Upload limit reached. Remove pending files or try again later.",
        429,
      );
    return tx.attachmentUpload.create({
      data: {
        ownerId: userId,
        roomId: input.roomId,
        name: input.name,
        size: input.size,
        mimeType: type.mime,
        objectKey: `chat-attachments/${randomUUID()}`,
        expiresAt: new Date(Date.now() + ATTACHMENT_CONFIG.unsentRetentionMs),
      },
    });
  });
  try {
    const upload = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: file.objectKey,
        ContentType: type.mime,
        ContentDisposition: "attachment",
        CacheControl: "private, no-store, max-age=0",
      }),
    );
    if (!upload.UploadId) throw new Error("Unable to start upload.");
    try {
      await prisma.attachmentUpload.update({
        where: { id: file.id },
        data: { uploadId: upload.UploadId },
      });
    } catch (error) {
      await removeStoredFile({ ...file, uploadId: upload.UploadId });
      throw error;
    }
    return {
      id: file.id,
      partBytes: ATTACHMENT_CONFIG.partBytes,
      mimeType: type.mime,
      expiresAt: file.expiresAt.toISOString(),
    };
  } catch (error) {
    await prisma.attachmentUpload.update({
      where: { id: file.id },
      data: { state: "rejected", expiresAt: new Date() },
    });
    throw error;
  }
}

export async function signPart(
  file: {
    id: string;
    size: number;
    objectKey: string;
    uploadId: string | null;
    state: string;
    expiresAt: Date;
  },
  partNumber: number,
) {
  if (
    file.state !== "uploading" ||
    !file.uploadId ||
    file.expiresAt.getTime() <= Date.now()
  )
    throw new AttachmentError("This upload is no longer active.", 409);
  const count = Math.ceil(file.size / ATTACHMENT_CONFIG.partBytes);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > count)
    throw new AttachmentError("Invalid part number.");
  const size = Math.min(
    ATTACHMENT_CONFIG.partBytes,
    file.size - (partNumber - 1) * ATTACHMENT_CONFIG.partBytes,
  );
  const { client, bucket } = r2();
  const url = await getSignedUrl(
    client,
    new UploadPartCommand({
      Bucket: bucket,
      Key: file.objectKey,
      UploadId: file.uploadId,
      PartNumber: partNumber,
      ContentLength: size,
    }),
    {
      expiresIn: Math.min(
        ATTACHMENT_CONFIG.uploadUrlSeconds,
        Math.max(1, Math.floor((file.expiresAt.getTime() - Date.now()) / 1000)),
      ),
    },
  );
  return { url };
}

export async function completeUpload(id: string) {
  let file = await prisma.attachmentUpload.findUniqueOrThrow({ where: { id } });
  if (file.state === "ready" && file.expiresAt.getTime() > Date.now())
    return { id };
  const claimed = await prisma.attachmentUpload.updateMany({
    where: { id, state: "uploading", expiresAt: { gt: new Date() } },
    data: { state: "processing" },
  });
  if (!claimed.count || !file.uploadId)
    throw new AttachmentError("Upload is processing or no longer active.", 409);
  const { client, bucket } = r2();
  let completed = false;
  try {
    const result = await client.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: file.objectKey,
        UploadId: file.uploadId,
      }),
    );
    const parts = result.Parts ?? [];
    const count = Math.ceil(file.size / ATTACHMENT_CONFIG.partBytes);
    if (result.IsTruncated || parts.length !== count)
      throw new AttachmentError("Some upload parts are missing.");
    for (let i = 0; i < count; i++) {
      const expected = Math.min(
        ATTACHMENT_CONFIG.partBytes,
        file.size - i * ATTACHMENT_CONFIG.partBytes,
      );
      if (
        parts[i].PartNumber !== i + 1 ||
        parts[i].Size !== expected ||
        !parts[i].ETag
      )
        throw new AttachmentError(
          "Upload size does not match the declared file.",
        );
    }
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: file.objectKey,
        UploadId: file.uploadId,
        MultipartUpload: {
          Parts: parts.map((part) => ({
            PartNumber: part.PartNumber,
            ETag: part.ETag,
          })),
        },
      }),
    );
    completed = true;
    await validateFileContent(file, readBytes);
    const updated = await prisma.attachmentUpload.updateMany({
      where: { id, state: "processing", expiresAt: { gt: new Date() } },
      data: { state: "ready", uploadId: null },
    });
    if (!updated.count)
      throw new AttachmentError("Upload was cancelled or expired.", 409);
    return { id };
  } catch (error) {
    await prisma.attachmentUpload.updateMany({
      where: { id, messageSerial: null },
      data: {
        state: "rejected",
        expiresAt: new Date(),
        ...(completed ? { uploadId: null } : {}),
      },
    });
    file = await prisma.attachmentUpload.findUniqueOrThrow({ where: { id } });
    // Leave failed deletions recorded so the scheduled cleanup can retry them.
    try {
      await removeStoredFile(file);
      await prisma.attachmentUpload.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch {
      /* Cleanup will retry. */
    }
    if (error instanceof AttachmentError) throw error;
    throw new AttachmentError(
      "Upload validation failed. Please select the original file again.",
    );
  }
}
