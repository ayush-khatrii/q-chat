-- CreateTable
CREATE TABLE "MessageRead" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "messageSerial" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageRead_roomId_messageSerial_idx" ON "MessageRead"("roomId", "messageSerial");

-- CreateIndex
CREATE INDEX "MessageRead_readerId_idx" ON "MessageRead"("readerId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageRead_roomId_messageSerial_readerId_key" ON "MessageRead"("roomId", "messageSerial", "readerId");

-- AddForeignKey
ALTER TABLE "MessageRead" ADD CONSTRAINT "MessageRead_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRead" ADD CONSTRAINT "MessageRead_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
