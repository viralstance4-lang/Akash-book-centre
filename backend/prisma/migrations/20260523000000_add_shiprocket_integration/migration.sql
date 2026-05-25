-- AlterTable: add Shiprocket tracking fields to Order
ALTER TABLE "Order" ADD COLUMN "shiprocketOrderId"    TEXT;
ALTER TABLE "Order" ADD COLUMN "shiprocketShipmentId" TEXT;
ALTER TABLE "Order" ADD COLUMN "awbCode"              TEXT;
ALTER TABLE "Order" ADD COLUMN "courierName"          TEXT;
ALTER TABLE "Order" ADD COLUMN "trackingUrl"          TEXT;
ALTER TABLE "Order" ADD COLUMN "labelUrl"             TEXT;
ALTER TABLE "Order" ADD COLUMN "invoiceUrl"           TEXT;
ALTER TABLE "Order" ADD COLUMN "manifestUrl"          TEXT;
ALTER TABLE "Order" ADD COLUMN "shiprocketStatus"     TEXT DEFAULT 'NOT_CREATED';

-- CreateIndex on awbCode for fast webhook lookups
CREATE INDEX "Order_awbCode_idx" ON "Order"("awbCode");

-- CreateTable: ShiprocketToken (cached JWT, auto-refreshed)
CREATE TABLE "ShiprocketToken" (
    "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
    "token"     TEXT         NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiprocketToken_pkey" PRIMARY KEY ("id")
);
