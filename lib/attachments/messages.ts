import "server-only";
import prisma from "@/lib/prisma";
import { ChatMessageAction, type Message } from "@ably/chat";
import {
  ATTACHMENT_CONFIG,
  attachmentIds,
  attachmentType,
  type SharedAttachment,
} from "@/constants/attachments";
import { AttachmentError } from "./http";
import { getAttachmentMessage } from "./ably";

export async function resolveAttachments(
  roomId: string,
  code: string,
  userId: string,
  serial: string,
  ids: string[],
  verifiedMessage?: Message,
) {
  const message =
    verifiedMessage ?? (await getAttachmentMessage(code, userId, serial));
  const deleted = message.action === ChatMessageAction.MessageDelete;
  const actualIds = attachmentIds(message.metadata);
  if (
    !deleted &&
    (ids.length !== actualIds.length ||
      ids.some((id) => !actualIds.includes(id)))
  )
    throw new AttachmentError("Attachments do not match this message.", 403);
  const sentAt = message.timestamp;
  if (sentAt.getTime() > Date.now() + 60_000)
    throw new AttachmentError("Invalid message timestamp.");
  const expiresAt = new Date(sentAt.getTime() + ATTACHMENT_CONFIG.retentionMs);
  const files = await prisma.$transaction(async (tx) => {
    const records = await tx.attachmentUpload.findMany({
      where: {
        id: { in: ids },
        roomId,
        ownerId: message.clientId,
        ...(deleted ? { messageSerial: serial } : {}),
      },
    });
    if (records.length !== ids.length)
      throw new AttachmentError("Attachment not found.", 404);
    if (records.some((file) => !file.messageSerial)) {
      const sender = await tx.roomMember.findUnique({
        where: { userId_roomId: { userId: message.clientId, roomId } },
      });
      if (!sender)
        throw new AttachmentError(
          "The sender is no longer a room member.",
          403,
        );
    }
    for (const file of records) {
      if (file.messageSerial && file.messageSerial !== serial)
        throw new AttachmentError(
          "Attachment already belongs to another message.",
          409,
        );
      if (deleted) {
        await tx.attachmentUpload.update({
          where: { id: file.id },
          data: { state: "deleted", expiresAt: new Date() },
        });
        continue;
      }
      if (
        file.createdAt > sentAt ||
        (!file.messageSerial &&
          (file.state !== "ready" ||
            file.updatedAt > sentAt ||
            file.expiresAt.getTime() <= Date.now() ||
            file.expiresAt <= sentAt))
      )
        throw new AttachmentError("Attachment was not ready when sent.", 409);
      if (!file.messageSerial) {
        // A compare-and-set prevents two messages from claiming the same upload.
        const bound = await tx.attachmentUpload.updateMany({
          where: {
            id: file.id,
            messageSerial: null,
            state: "ready",
            expiresAt: { gt: new Date() },
          },
          data: {
            messageSerial: serial,
            sentAt,
            expiresAt,
            state: "ready",
          },
        });
        if (!bound.count)
          throw new AttachmentError("Attachment binding changed. Retry.", 409);
      }
    }
    return tx.attachmentUpload.findMany({ where: { id: { in: ids } } });
  });
  return files.map((file): SharedAttachment => ({
    id: file.id,
    name: file.name,
    size: file.size,
    mimeType: file.mimeType,
    preview: attachmentType(file.name)?.preview ?? "none",
    expiresAt: file.expiresAt.toISOString(),
    state:
      file.expiresAt.getTime() <= Date.now() ||
      file.deletedAt ||
      file.state === "deleted"
        ? "expired"
        : "ready",
  }));
}
