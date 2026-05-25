-- AlterTable: add Shiprocket tracking fields to Order (idempotent)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shiprocketOrderId"    TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shiprocketShipmentId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "awbCode"              TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "courierName"          TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingUrl"          TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "labelUrl"             TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "invoiceUrl"           TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "manifestUrl"          TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shiprocketStatus"     TEXT DEFAULT 'NOT_CREATED';

-- CreateIndex on awbCode for fast webhook lookups (idempotent)
CREATE INDEX IF NOT EXISTS "Order_awbCode_idx" ON "Order"("awbCode");

-- CreateTable: ShiprocketToken (idempotent)
CREATE TABLE IF NOT EXISTS "ShiprocketToken" (
    "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
    "token"     TEXT         NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiprocketToken_pkey" PRIMARY KEY ("id")
);
