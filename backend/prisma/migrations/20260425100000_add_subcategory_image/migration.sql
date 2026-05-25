-- Add optional image fields to Subcategory.
-- Nullable so existing subcategories are unaffected.
ALTER TABLE "Subcategory" ADD COLUMN "imageUrl"      TEXT;
ALTER TABLE "Subcategory" ADD COLUMN "imagePublicId" TEXT;
