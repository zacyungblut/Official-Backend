/*
  Warnings:

  - You are about to drop the `_UserPartners` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."_UserPartners" DROP CONSTRAINT "_UserPartners_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_UserPartners" DROP CONSTRAINT "_UserPartners_B_fkey";

-- DropTable
DROP TABLE "public"."_UserPartners";

-- CreateTable
CREATE TABLE "public"."Relationship" (
    "id" TEXT NOT NULL,
    "status" "public"."Status" NOT NULL DEFAULT 'RELATIONSHIP',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_RelationshipToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RelationshipToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RelationshipToUser_B_index" ON "public"."_RelationshipToUser"("B");

-- AddForeignKey
ALTER TABLE "public"."_RelationshipToUser" ADD CONSTRAINT "_RelationshipToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Relationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_RelationshipToUser" ADD CONSTRAINT "_RelationshipToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
