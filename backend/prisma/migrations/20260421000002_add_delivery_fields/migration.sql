-- Add delivery tracking fields to Order
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "deliveryType" TEXT DEFAULT 'PAID';

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "deliveryDistance" DECIMAL(5,2);
