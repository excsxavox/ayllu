CREATE TYPE "ContactAudience" AS ENUM ('CLIENT', 'CONTACT');

ALTER TABLE "Contact" ADD COLUMN "audience" "ContactAudience" NOT NULL DEFAULT 'CLIENT';
