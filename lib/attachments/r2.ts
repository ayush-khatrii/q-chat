import "server-only";
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ATTACHMENT_CONFIG } from "@/constants/attachments";

// Lazy initialization lets the application build before credentials are configured.
export function r2() {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
  } = process.env;
  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET_NAME
  )
    throw new Error("Attachment storage is not configured.");
  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    }),
    bucket: R2_BUCKET_NAME,
  };
}

export async function readBytes(key: string, start: number, end: number) {
  const { client, bucket } = r2();
  const result = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=${start}-${end}`,
    }),
  );
  if (!result.Body) throw new Error("File content is unavailable.");
  return Buffer.from(await result.Body.transformToByteArray());
}

export async function removeStoredFile(file: {
  objectKey: string;
  uploadId: string | null;
}) {
  const { client, bucket } = r2();
  if (file.uploadId) {
    try {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: file.objectKey,
          UploadId: file.uploadId,
        }),
      );
    } catch (error) {
      if ((error as { name?: string }).name !== "NoSuchUpload") throw error;
    }
  }
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: file.objectKey }),
  );
}

export async function fileUrl(
  file: { objectKey: string; name: string; mimeType: string; expiresAt: Date },
  preview: boolean,
) {
  const seconds = Math.min(
    ATTACHMENT_CONFIG.readUrlSeconds,
    Math.floor((file.expiresAt.getTime() - Date.now()) / 1000),
  );
  if (seconds < 1) throw new Error("Attachment expired.");
  const { client, bucket } = r2();
  const disposition = `${preview ? "inline" : "attachment"}; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`;
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: file.objectKey,
      ResponseContentType: file.mimeType,
      ResponseContentDisposition: disposition,
      ResponseCacheControl: "private, no-store, max-age=0",
    }),
    { expiresIn: seconds },
  );
}
