-- CreateTable: Category
CREATE TABLE "Category" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "name"           TEXT         NOT NULL,
  "slug"           TEXT         NOT NULL,
  "imageUrl"       TEXT,
  "imagePublicId"  TEXT,
  "isActive"       BOOLEAN      NOT NULL DEFAULT true,
  "order"          INTEGER      NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateTable: Subcategory
CREATE TABLE "Subcategory" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "categoryId" UUID         NOT NULL,
  "name"       TEXT         NOT NULL,
  "slug"       TEXT         NOT NULL,
  "isActive"   BOOLEAN      NOT NULL DEFAULT true,
  "order"      INTEGER      NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subcategory_slug_key"             ON "Subcategory"("slug");
CREATE UNIQUE INDEX "Subcategory_categoryId_name_key"  ON "Subcategory"("categoryId", "name");
CREATE        INDEX "Subcategory_categoryId_idx"        ON "Subcategory"("categoryId");

-- AddForeignKey
ALTER TABLE "Subcategory"
  ADD CONSTRAINT "Subcategory_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
