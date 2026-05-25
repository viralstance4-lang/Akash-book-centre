-- Add optional book dimensions (cm) and weight (kg)
ALTER TABLE "Book"
  ADD COLUMN IF NOT EXISTS "height"  DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "length"  DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "breadth" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "weight"  DECIMAL(10,3);

