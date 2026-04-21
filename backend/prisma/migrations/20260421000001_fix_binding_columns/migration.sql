-- Fix missing bindingType column on CartItem
-- (was in schema since v1 but never added via migration)
ALTER TABLE "CartItem"
  ADD COLUMN IF NOT EXISTS "bindingType" TEXT NOT NULL DEFAULT 'NONE';

-- Fix missing columns on OrderItem
ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "bindingType" TEXT NOT NULL DEFAULT 'NONE';

ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "bindingExtra" DECIMAL(10,2) NOT NULL DEFAULT 0;
