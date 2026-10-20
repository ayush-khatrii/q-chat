import "server-only";
import prisma from "@/lib/prisma";
import { Client } from "@upstash/qstash";
import { ATTACHMENT_CONFIG } from "@/constants/attachments";
import { removeStoredFile } from "./r2";

export function qstash() {
  if (!process.env.QSTASH_TOKEN || !process.env.APP_URL)
    throw new Error("QStash cleanup is not configured.");
  return {
    client: new Client({ token: process.env.QSTASH_TOKEN }),
    url: `${process.env.APP_URL.replace(/\/$/, "")}/api/attachments/cleanup`,
  };
}

export async function cleanupAttachments() {
  const now = new Date();
  const files = await prisma.attachmentUpload.findMany({
    where: { expiresAt: { lte: now }, deletedAt: null },
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    take: ATTACHMENT_CONFIG.cleanupBatchSize,
  });
  let deleted = 0;
  let failed = 0;
  for (const file of files) {
    try {
      // Both R2 deletion operations are idempotent, so overlapping jobs are safe.
      await removeStoredFile(file);
      await prisma.attachmentUpload.updateMany({
        where: { id: file.id, expiresAt: { lte: now } },
        data: { state: "deleted", deletedAt: new Date() },
      });
      deleted++;
    } catch {
      failed++;
    }
  }
  await prisma.attachmentRateLimit.deleteMany({
    where: { expiresAt: { lte: now } },
  });
  console.info("Attachment cleanup", {
    examined: files.length,
    deleted,
    failed,
  });
  if (failed)
    throw new Error("Some attachments could not be deleted; retry cleanup.");
  if (files.length === ATTACHMENT_CONFIG.cleanupBatchSize) {
    const { client, url } = qstash();
    await client.publishJSON({ url, body: {}, retries: 3, timeout: 50 });
  }
  return { deleted };
}
