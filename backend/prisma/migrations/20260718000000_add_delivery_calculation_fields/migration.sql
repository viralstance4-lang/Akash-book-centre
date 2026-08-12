-- Distance-based delivery charge: add calculationMethod + storeLocation audit
-- fields to Order/PrintOrder (records how deliveryDistance was computed and the
-- store origin used).

-- ─── Order ───────────────────────────────────────────────────────────────────

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "calculationMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "storeLocation" JSONB;

-- ─── PrintOrder ──────────────────────────────────────────────────────────────

ALTER TABLE "PrintOrder"
  ADD COLUMN IF NOT EXISTS "calculationMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "storeLocation" JSONB;
