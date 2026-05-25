-- Add per-book binding visibility controls
ALTER TABLE "Book"
  ADD COLUMN IF NOT EXISTS "allowStapleBinding" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Book"
  ADD COLUMN IF NOT EXISTS "allowSpiralBinding" BOOLEAN NOT NULL DEFAULT false;

