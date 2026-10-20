CREATE TABLE "AttachmentUpload" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "uploadId" TEXT,
  "name" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'uploading',
  "messageSerial" TEXT,
  "sentAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttachmentUpload_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttachmentUpload_objectKey_key" ON "AttachmentUpload"("objectKey");
CREATE INDEX "AttachmentUpload_expiresAt_deletedAt_idx" ON "AttachmentUpload"("expiresAt", "deletedAt");
CREATE INDEX "AttachmentUpload_roomId_messageSerial_idx" ON "AttachmentUpload"("roomId", "messageSerial");
CREATE INDEX "AttachmentUpload_ownerId_createdAt_idx" ON "AttachmentUpload"("ownerId", "createdAt");
CREATE TABLE "AttachmentRateLimit" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttachmentRateLimit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "AttachmentRateLimit_expiresAt_idx" ON "AttachmentRateLimit"("expiresAt");
