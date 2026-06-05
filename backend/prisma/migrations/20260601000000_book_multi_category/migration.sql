-- Re-introduce many-to-many: Book ↔ Category and Book ↔ Subcategory
-- Existing single-FK fields (categoryId, subcategoryId) are kept as-is for backward compat.

-- ─── BookCategory ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "BookCategory" (
  "bookId"     UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  CONSTRAINT "BookCategory_pkey" PRIMARY KEY ("bookId", "categoryId"),
  CONSTRAINT "BookCategory_bookId_fkey"
    FOREIGN KEY ("bookId")     REFERENCES "Book"("id")     ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookCategory_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "BookCategory_bookId_idx"     ON "BookCategory"("bookId");
CREATE INDEX IF NOT EXISTS "BookCategory_categoryId_idx" ON "BookCategory"("categoryId");

-- ─── BookSubcategory ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "BookSubcategory" (
  "bookId"        UUID NOT NULL,
  "subcategoryId" UUID NOT NULL,
  CONSTRAINT "BookSubcategory_pkey" PRIMARY KEY ("bookId", "subcategoryId"),
  CONSTRAINT "BookSubcategory_bookId_fkey"
    FOREIGN KEY ("bookId")        REFERENCES "Book"("id")        ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookSubcategory_subcategoryId_fkey"
    FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "BookSubcategory_bookId_idx"        ON "BookSubcategory"("bookId");
CREATE INDEX IF NOT EXISTS "BookSubcategory_subcategoryId_idx" ON "BookSubcategory"("subcategoryId");

-- ─── Back-fill from existing FK fields ───────────────────────────────────────

INSERT INTO "BookCategory" ("bookId", "categoryId")
SELECT "id", "categoryId"
FROM   "Book"
WHERE  "categoryId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "BookSubcategory" ("bookId", "subcategoryId")
SELECT "id", "subcategoryId"
FROM   "Book"
WHERE  "subcategoryId" IS NOT NULL
ON CONFLICT DO NOTHING;
