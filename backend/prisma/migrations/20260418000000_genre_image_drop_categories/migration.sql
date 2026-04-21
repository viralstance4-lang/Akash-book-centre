-- Add imageUrl to Genre (nullable — existing genres keep working)
ALTER TABLE "Genre" ADD COLUMN "imageUrl" TEXT;

-- Drop the old Category/Subcategory system
-- Subcategory first (FK dependency)
DROP TABLE IF EXISTS "Subcategory";
DROP TABLE IF EXISTS "Category";
