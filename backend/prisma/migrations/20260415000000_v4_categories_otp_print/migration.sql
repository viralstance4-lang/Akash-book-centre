-- ============================================================
-- Migration v4: Categories, Subcategories, OTP, Multi-PDF Print
-- Safe migration: only adds new tables/columns, never drops
-- ============================================================

-- ----------------------------------------------------------------
-- 1. User: add optional phone field
-- ----------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone") WHERE "phone" IS NOT NULL;

-- ----------------------------------------------------------------
-- 2. Category table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Category" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "name"        VARCHAR(100) NOT NULL,
  "slug"        VARCHAR(120) NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN      NOT NULL DEFAULT true,
  "order"       INTEGER      NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Category_slug_key" ON "Category"("slug");

-- ----------------------------------------------------------------
-- 3. Subcategory table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Subcategory" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "categoryId"  UUID         NOT NULL,
  "name"        VARCHAR(100) NOT NULL,
  "slug"        VARCHAR(120) NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN      NOT NULL DEFAULT true,
  "order"       INTEGER      NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Subcategory_slug_key"           ON "Subcategory"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Subcategory_categoryId_name_key" ON "Subcategory"("categoryId", "name");
CREATE INDEX        IF NOT EXISTS "Subcategory_categoryId_idx"      ON "Subcategory"("categoryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Subcategory_categoryId_fkey'
  ) THEN
    ALTER TABLE "Subcategory"
      ADD CONSTRAINT "Subcategory_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 4. OtpCode table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OtpCode" (
  "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "userId"    UUID         NOT NULL,
  "code"      VARCHAR(6)   NOT NULL,
  "target"    TEXT         NOT NULL,
  "type"      TEXT         NOT NULL DEFAULT 'LOGIN',
  "attempts"  INTEGER      NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "used"      BOOLEAN      NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OtpCode_userId_idx" ON "OtpCode"("userId");
CREATE INDEX IF NOT EXISTS "OtpCode_target_idx" ON "OtpCode"("target");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'OtpCode_userId_fkey'
  ) THEN
    ALTER TABLE "OtpCode"
      ADD CONSTRAINT "OtpCode_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 5. RefreshToken: add sessionExpiresAt for 10-hour session cap
-- ----------------------------------------------------------------
ALTER TABLE "RefreshToken"
  ADD COLUMN IF NOT EXISTS "sessionExpiresAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 hours');

-- ----------------------------------------------------------------
-- 6. PrintFile table (multi-PDF support)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PrintFile" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "printOrderId" UUID         NOT NULL,
  "fileUrl"      TEXT         NOT NULL,
  "filePublicId" TEXT         NOT NULL,
  "originalName" VARCHAR(255) NOT NULL DEFAULT '',
  "pageCount"    INTEGER      NOT NULL DEFAULT 0,
  "order"        INTEGER      NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrintFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PrintFile_printOrderId_idx" ON "PrintFile"("printOrderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PrintFile_printOrderId_fkey'
  ) THEN
    ALTER TABLE "PrintFile"
      ADD CONSTRAINT "PrintFile_printOrderId_fkey"
      FOREIGN KEY ("printOrderId") REFERENCES "PrintOrder"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 7. PrintOrder: add copies and estimatedMinutes columns
-- ----------------------------------------------------------------
ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "copies"           INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER NOT NULL DEFAULT 0;
-- Provide defaults for legacy fileUrl/filePublicId so new orders don't break
ALTER TABLE "PrintOrder" ALTER COLUMN "fileUrl"      SET DEFAULT '';
ALTER TABLE "PrintOrder" ALTER COLUMN "filePublicId" SET DEFAULT '';

-- ----------------------------------------------------------------
-- 8. PrintSettings: new pricing columns
-- ----------------------------------------------------------------
ALTER TABLE "PrintSettings" ADD COLUMN IF NOT EXISTS "singleSideBasePrice"   DECIMAL(10,2) NOT NULL DEFAULT 1.00;
ALTER TABLE "PrintSettings" ADD COLUMN IF NOT EXISTS "singleSideBulkPrice"   DECIMAL(10,2) NOT NULL DEFAULT 0.50;
ALTER TABLE "PrintSettings" ADD COLUMN IF NOT EXISTS "doubleSidePrice"       DECIMAL(10,2) NOT NULL DEFAULT 1.00;
ALTER TABLE "PrintSettings" ADD COLUMN IF NOT EXISTS "bulkThreshold"         INTEGER       NOT NULL DEFAULT 20;
ALTER TABLE "PrintSettings" ADD COLUMN IF NOT EXISTS "colorSurcharge"        DECIMAL(10,2) NOT NULL DEFAULT 3.00;
ALTER TABLE "PrintSettings" ADD COLUMN IF NOT EXISTS "maxPdfsPerOrder"       INTEGER       NOT NULL DEFAULT 20;

-- ----------------------------------------------------------------
-- 9. SiteSettings: add maxPdfUploads
-- ----------------------------------------------------------------
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "maxPdfUploads" INTEGER NOT NULL DEFAULT 20;
