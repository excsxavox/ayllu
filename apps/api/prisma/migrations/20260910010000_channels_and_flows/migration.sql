-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'MESSENGER', 'WEB', 'TELEGRAM');

-- CreateTable
CREATE TABLE "BotFlow" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "systemPrompt" TEXT,
    "tone" TEXT,
    "replyMode" "ReplyMode" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "flowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "WhatsAppAccount" ADD COLUMN "channelId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "channelId" TEXT;
ALTER TABLE "BusinessRule" ADD COLUMN "flowId" TEXT;

-- CreateIndex
CREATE INDEX "BotFlow_companyId_idx" ON "BotFlow"("companyId");
CREATE INDEX "Channel_companyId_type_idx" ON "Channel"("companyId", "type");
CREATE UNIQUE INDEX "WhatsAppAccount_channelId_key" ON "WhatsAppAccount"("channelId");
CREATE INDEX "Conversation_channelId_lastMessageAt_idx" ON "Conversation"("channelId", "lastMessageAt");

-- Backfill default flow + channels per company
INSERT INTO "BotFlow" ("id", "companyId", "name", "description", "isDefault", "systemPrompt", "tone", "replyMode", "createdAt", "updatedAt")
SELECT
  'flow_' || c."id",
  c."id",
  'Flujo principal',
  'Responde con el catálogo, el conocimiento y las reglas de la empresa.',
  true,
  c."botSystemPrompt",
  c."botTone",
  c."replyMode",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "BotFlow" f WHERE f."companyId" = c."id" AND f."isDefault" = true
);

INSERT INTO "Channel" ("id", "companyId", "type", "name", "handle", "isActive", "flowId", "createdAt", "updatedAt")
SELECT
  'ch_wa_' || c."id",
  c."id",
  'WHATSAPP',
  'WhatsApp',
  NULL,
  true,
  'flow_' || c."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "Channel" ch WHERE ch."companyId" = c."id" AND ch."type" = 'WHATSAPP'
);

UPDATE "Channel" ch
SET "handle" = a."displayPhone"
FROM (
  SELECT DISTINCT ON ("companyId") "companyId", "displayPhone"
  FROM "WhatsAppAccount"
  ORDER BY "companyId", "createdAt" ASC
) a
WHERE ch."companyId" = a."companyId"
  AND ch."type" = 'WHATSAPP'
  AND ch."handle" IS NULL;

INSERT INTO "Channel" ("id", "companyId", "type", "name", "handle", "isActive", "flowId", "createdAt", "updatedAt")
SELECT
  'ch_web_' || c."id",
  c."id",
  'WEB',
  'Chat web',
  'sitio',
  true,
  'flow_' || c."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "Channel" ch WHERE ch."companyId" = c."id" AND ch."type" = 'WEB'
);

INSERT INTO "Channel" ("id", "companyId", "type", "name", "handle", "isActive", "flowId", "createdAt", "updatedAt")
SELECT
  'ch_ig_' || c."id",
  c."id",
  'INSTAGRAM',
  'Instagram',
  NULL,
  false,
  'flow_' || c."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "Channel" ch WHERE ch."companyId" = c."id" AND ch."type" = 'INSTAGRAM'
);

INSERT INTO "Channel" ("id", "companyId", "type", "name", "handle", "isActive", "flowId", "createdAt", "updatedAt")
SELECT
  'ch_ms_' || c."id",
  c."id",
  'MESSENGER',
  'Messenger',
  NULL,
  false,
  'flow_' || c."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "Channel" ch WHERE ch."companyId" = c."id" AND ch."type" = 'MESSENGER'
);

INSERT INTO "Channel" ("id", "companyId", "type", "name", "handle", "isActive", "flowId", "createdAt", "updatedAt")
SELECT
  'ch_tg_' || c."id",
  c."id",
  'TELEGRAM',
  'Telegram',
  NULL,
  false,
  'flow_' || c."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1 FROM "Channel" ch WHERE ch."companyId" = c."id" AND ch."type" = 'TELEGRAM'
);

UPDATE "WhatsAppAccount" a
SET "channelId" = ch."id"
FROM "Channel" ch
WHERE ch."companyId" = a."companyId"
  AND ch."type" = 'WHATSAPP'
  AND a."channelId" IS NULL
  AND a."id" = (
    SELECT a2."id" FROM "WhatsAppAccount" a2
    WHERE a2."companyId" = ch."companyId" AND a2."channelId" IS NULL
    ORDER BY a2."createdAt" ASC
    LIMIT 1
  );

UPDATE "Conversation" conv
SET "channelId" = COALESCE(
  (SELECT a."channelId" FROM "WhatsAppAccount" a WHERE a."id" = conv."whatsappAccountId"),
  (SELECT ch."id" FROM "Channel" ch WHERE ch."companyId" = conv."companyId" AND ch."type" = 'WHATSAPP' LIMIT 1)
)
WHERE conv."channelId" IS NULL;

-- Unique per channel + contact (after backfill)
DROP INDEX IF EXISTS "Conversation_companyId_contactId_key";
CREATE UNIQUE INDEX "Conversation_channelId_contactId_key" ON "Conversation"("channelId", "contactId");

-- ForeignKeys
ALTER TABLE "BotFlow" ADD CONSTRAINT "BotFlow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "BotFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppAccount" ADD CONSTRAINT "WhatsAppAccount_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessRule" ADD CONSTRAINT "BusinessRule_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "BotFlow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
