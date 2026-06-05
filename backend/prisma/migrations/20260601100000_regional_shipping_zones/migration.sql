-- Regional Shipping Zones: add localZoneRate + northEastRate to ShippingSettings,
-- and shippingDetails JSON to Order for per-order zone/weight/rate audit trail.

-- ─── ShippingSettings ────────────────────────────────────────────────────────

ALTER TABLE "ShippingSettings"
  ADD COLUMN IF NOT EXISTS "localZoneRate" DECIMAL(10,2) NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "northEastRate" DECIMAL(10,2) NOT NULL DEFAULT 80;

-- Update All-India default rate from 50 → 70 on existing rows where it still
-- holds the original default value.  Rows the admin already customised are untouched.
UPDATE "ShippingSettings"
SET "defaultKgRate" = 70
WHERE "defaultKgRate" = 50;

-- ─── Order ───────────────────────────────────────────────────────────────────

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "shippingDetails" JSONB;
