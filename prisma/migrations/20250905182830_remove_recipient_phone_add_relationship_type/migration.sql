/*
  Warnings:

  - You are about to drop the column `recipientPhone` on the `Invite` table. All the data in the column will be lost.
  - Added the required column `relationshipType` to the `Invite` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Invite_senderPhone_recipientPhone_key";

-- AlterTable
ALTER TABLE "public"."Invite" DROP COLUMN "recipientPhone",
ADD COLUMN     "relationshipType" "public"."Status" NOT NULL;
