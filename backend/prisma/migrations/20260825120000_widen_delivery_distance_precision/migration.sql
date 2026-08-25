-- Widen deliveryDistance from Decimal(5,2) (max 999.99) to Decimal(7,2)
-- (max 99999.99). The narrower precision caused a hard Postgres "numeric
-- field overflow" (22003) on any order from a customer more than ~1000km
-- from the store — a real scenario for the "All India"/"North East" zones
-- the store explicitly prices for (e.g. Assam is ~1755km away).

-- ─── Order ───────────────────────────────────────────────────────────────────

ALTER TABLE "Order"
  ALTER COLUMN "deliveryDistance" TYPE DECIMAL(7, 2);

-- ─── PrintOrder ──────────────────────────────────────────────────────────────

ALTER TABLE "PrintOrder"
  ALTER COLUMN "deliveryDistance" TYPE DECIMAL(7, 2);
