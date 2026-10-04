ALTER TABLE "Price" ALTER COLUMN "currency" SET DEFAULT 'USD';
UPDATE "Price" SET "currency" = 'USD' WHERE "currency" = 'PEN';
