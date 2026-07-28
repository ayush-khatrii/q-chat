CREATE TYPE "RoomMemberStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "RoomMember"
ADD COLUMN "status" "RoomMemberStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "RoomMember"
SET "status" = 'APPROVED';

CREATE INDEX "RoomMember_roomId_status_idx"
ON "RoomMember"("roomId", "status");
