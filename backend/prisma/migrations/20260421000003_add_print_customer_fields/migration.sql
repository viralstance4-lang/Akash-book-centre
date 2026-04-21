-- Add customer detail columns to PrintOrder
ALTER TABLE "PrintOrder"
  ADD COLUMN IF NOT EXISTS "customerName"    TEXT;

ALTER TABLE "PrintOrder"
  ADD COLUMN IF NOT EXISTS "customerPhone"   TEXT;

ALTER TABLE "PrintOrder"
  ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
