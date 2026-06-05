-- Independent B&W and Color print pricing fields.
-- Old fields (singleSideBasePrice, colorSurcharge, etc.) are kept for backward compat.
-- New fields get admin-configurable defaults per the business requirements.

ALTER TABLE "PrintSettings"
  ADD COLUMN IF NOT EXISTS "bwSingleSide"         DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS "bwBothSideUnder20"    DECIMAL(10,2) NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS "bwBothSideAbove20"    DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS "colorSingleSide"      DECIMAL(10,2) NOT NULL DEFAULT 8.00,
  ADD COLUMN IF NOT EXISTS "colorBothSideUnder20" DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS "colorBothSideAbove20" DECIMAL(10,2) NOT NULL DEFAULT 8.00,
  ADD COLUMN IF NOT EXISTS "colorAbove99"         DECIMAL(10,2) NOT NULL DEFAULT 6.00;
