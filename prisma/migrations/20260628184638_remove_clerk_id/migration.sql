/*
  Warnings:

  - You are about to drop the column `clerkId` on the `user` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "user_clerkId_key";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "clerkId";
