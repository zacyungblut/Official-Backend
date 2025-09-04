-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('SINGLE', 'RELATIONSHIP', 'SITUATIONSHIP');

-- CreateEnum
CREATE TYPE "public"."InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "relationshipStatus" "public"."Status" NOT NULL DEFAULT 'SINGLE',
    "verificationCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invite" (
    "id" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "status" "public"."InviteStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_UserPartners" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserPartners_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "public"."User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_senderPhone_recipientPhone_key" ON "public"."Invite"("senderPhone", "recipientPhone");

-- CreateIndex
CREATE INDEX "_UserPartners_B_index" ON "public"."_UserPartners"("B");

-- AddForeignKey
ALTER TABLE "public"."Invite" ADD CONSTRAINT "Invite_senderPhone_fkey" FOREIGN KEY ("senderPhone") REFERENCES "public"."User"("phone") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_UserPartners" ADD CONSTRAINT "_UserPartners_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_UserPartners" ADD CONSTRAINT "_UserPartners_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
