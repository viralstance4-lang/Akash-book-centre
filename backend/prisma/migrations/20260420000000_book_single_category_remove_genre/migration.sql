-- ============================================================
-- Migration: Book → single Category + Subcategory (direct FK)
-- Remove Genre, BookCategory join table, BookSubcategory join table
-- ============================================================

-- Step 1: Add categoryId and subcategoryId to Book (nullable for safe migration)
ALTER TABLE "Book" ADD COLUMN "categoryId"    UUID;
ALTER TABLE "Book" ADD COLUMN "subcategoryId" UUID;

-- Step 2: Best-effort back-fill from existing M2M join tables
--   Each book gets its first BookCategory row as its category,
--   and its first BookSubcategory row as its subcategory.
UPDATE "Book" b
SET "categoryId" = (
  SELECT bc."categoryId"
  FROM   "BookCategory" bc
  WHERE  bc."bookId" = b.id
  ORDER  BY bc."categoryId"
  LIMIT  1
)
WHERE "categoryId" IS NULL;

UPDATE "Book" b
SET "subcategoryId" = (
  SELECT bs."subcategoryId"
  FROM   "BookSubcategory" bs
  WHERE  bs."bookId" = b.id
  ORDER  BY bs."subcategoryId"
  LIMIT  1
)
WHERE "subcategoryId" IS NULL;

-- Step 3: Drop old M2M junction tables
DROP TABLE IF EXISTS "BookSubcategory";
DROP TABLE IF EXISTS "BookCategory";

-- Step 4: Drop genreId FK and column from Book
ALTER TABLE "Book" DROP CONSTRAINT IF EXISTS "Book_genreId_fkey";
DROP INDEX  IF EXISTS "Book_genreId_idx";
ALTER TABLE "Book" DROP COLUMN IF EXISTS "genreId";

-- Step 5: Drop Genre table
DROP TABLE IF EXISTS "Genre";

-- Step 6: Add FK constraints for the new columns (nullable → no cascade required)
ALTER TABLE "Book"
  ADD CONSTRAINT "Book_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Book"
  ADD CONSTRAINT "Book_subcategoryId_fkey"
  FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 7: Add indexes
CREATE INDEX "Book_categoryId_idx"    ON "Book"("categoryId");
CREATE INDEX "Book_subcategoryId_idx" ON "Book"("subcategoryId");
