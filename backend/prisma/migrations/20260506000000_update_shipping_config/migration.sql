-- Extend ShippingSettings with the new admin-controlled shipping config fields.
-- All new columns have safe defaults so existing rows are migrated automatically.
ALTER TABLE "ShippingSettings"
  ADD COLUMN IF NOT EXISTS "isShippingEnabled"     BOOLEAN        NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "distanceThreshold"     DOUBLE PRECISION NOT NULL DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS "perKmRate"             DECIMAL(10,2)  NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS "freeDeliveryThreshold" DECIMAL(10,2)  NOT NULL DEFAULT 199,
  ADD COLUMN IF NOT EXISTS "defaultKgRate"         DECIMAL(10,2)  NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "stateRates"            JSONB          NOT NULL DEFAULT '[]'::jsonb;
