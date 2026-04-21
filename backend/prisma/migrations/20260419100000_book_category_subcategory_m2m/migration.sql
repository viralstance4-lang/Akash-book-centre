-- Many-to-many: Book ↔ Category
CREATE TABLE "BookCategory" (
  "bookId"     UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  CONSTRAINT "BookCategory_pkey" PRIMARY KEY ("bookId", "categoryId")
);
CREATE INDEX "BookCategory_bookId_idx"     ON "BookCategory"("bookId");
CREATE INDEX "BookCategory_categoryId_idx" ON "BookCategory"("categoryId");

ALTER TABLE "BookCategory"
  ADD CONSTRAINT "BookCategory_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookCategory"
  ADD CONSTRAINT "BookCategory_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Many-to-many: Book ↔ Subcategory
CREATE TABLE "BookSubcategory" (
  "bookId"        UUID NOT NULL,
  "subcategoryId" UUID NOT NULL,
  CONSTRAINT "BookSubcategory_pkey" PRIMARY KEY ("bookId", "subcategoryId")
);
CREATE INDEX "BookSubcategory_bookId_idx"        ON "BookSubcategory"("bookId");
CREATE INDEX "BookSubcategory_subcategoryId_idx" ON "BookSubcategory"("subcategoryId");

ALTER TABLE "BookSubcategory"
  ADD CONSTRAINT "BookSubcategory_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookSubcategory"
  ADD CONSTRAINT "BookSubcategory_subcategoryId_fkey"
  FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
