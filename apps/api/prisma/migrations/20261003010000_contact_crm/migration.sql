CREATE TYPE "CrmStage" AS ENUM ('NEW', 'TALKING', 'INTERESTED', 'RESERVED', 'WON', 'LOST');
CREATE TYPE "CrmSource" AS ENUM ('WHATSAPP', 'MANUAL', 'WALKIN', 'OTHER');
CREATE TYPE "CrmActivityType" AS ENUM ('NOTE', 'STAGE', 'FOLLOW');

ALTER TABLE "Contact" ADD COLUMN "email" TEXT;
ALTER TABLE "Contact" ADD COLUMN "stage" "CrmStage" NOT NULL DEFAULT 'NEW';
ALTER TABLE "Contact" ADD COLUMN "source" "CrmSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Contact" ADD COLUMN "notes" TEXT;
ALTER TABLE "Contact" ADD COLUMN "expectedValue" DECIMAL(12, 2);
ALTER TABLE "Contact" ADD COLUMN "nextActionAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "nextAction" TEXT;
ALTER TABLE "Contact" ADD COLUMN "lostReason" TEXT;

CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "CrmActivityType" NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contact_companyId_stage_idx" ON "Contact"("companyId", "stage");
CREATE INDEX "Contact_companyId_nextActionAt_idx" ON "Contact"("companyId", "nextActionAt");
CREATE INDEX "CrmActivity_contactId_createdAt_idx" ON "CrmActivity"("contactId", "createdAt");
CREATE INDEX "CrmActivity_companyId_createdAt_idx" ON "CrmActivity"("companyId", "createdAt");

ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Contact" SET "source" = 'WHATSAPP'
WHERE EXISTS (
  SELECT 1 FROM "Conversation" c WHERE c."contactId" = "Contact"."id"
);

UPDATE "Contact" SET "stage" = 'TALKING'
WHERE "stage" = 'NEW' AND EXISTS (
  SELECT 1 FROM "Conversation" c WHERE c."contactId" = "Contact"."id"
);

UPDATE "Contact" SET "stage" = 'RESERVED'
WHERE EXISTS (
  SELECT 1 FROM "Booking" b
  WHERE b."contactId" = "Contact"."id"
    AND b."status" IN ('PENDING', 'CONFIRMED')
);

UPDATE "Contact" SET "stage" = 'WON'
WHERE EXISTS (
  SELECT 1 FROM "Booking" b
  WHERE b."contactId" = "Contact"."id"
    AND b."status" = 'COMPLETED'
);
