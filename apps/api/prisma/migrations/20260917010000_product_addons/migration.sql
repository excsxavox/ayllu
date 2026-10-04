-- AlterTable
ALTER TABLE "Product" ADD COLUMN "isAddon" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "stock" INTEGER;
ALTER TABLE "Product" ADD COLUMN "parentServiceId" TEXT;

-- CreateIndex
CREATE INDEX "Product_parentServiceId_idx" ON "Product"("parentServiceId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_parentServiceId_fkey" FOREIGN KEY ("parentServiceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
