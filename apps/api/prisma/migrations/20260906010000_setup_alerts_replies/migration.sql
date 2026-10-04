-- CreateEnum
CREATE TYPE "ReplyMode" AS ENUM ('AUTO', 'HYBRID', 'MANUAL');
CREATE TYPE "AlertType" AS ENUM ('NEW_CONVERSATION', 'HUMAN_TAKEOVER', 'BOT_FALLBACK', 'OUTSIDE_HOURS', 'NEEDS_REPLY');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "replyMode" "ReplyMode" NOT NULL DEFAULT 'AUTO';
ALTER TABLE "Company" ADD COLUMN "setupCompleted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AlertSetting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "conversationId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CannedReply" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "shortcut" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CannedReply_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlertSetting_companyId_type_key" ON "AlertSetting"("companyId", "type");
CREATE INDEX "Alert_companyId_readAt_createdAt_idx" ON "Alert"("companyId", "readAt", "createdAt");
CREATE INDEX "CannedReply_companyId_idx" ON "CannedReply"("companyId");

ALTER TABLE "AlertSetting" ADD CONSTRAINT "AlertSetting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CannedReply" ADD CONSTRAINT "CannedReply_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
