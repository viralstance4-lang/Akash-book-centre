-- Safe Migration v3 - Only adds new tables and columns, never deletes existing data

-- Add new enum values (safe - only adding)
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURN_REQUESTED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURNED';

-- Create PaymentMethod enum if not exists
DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE', 'COD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to Book table (all optional/with defaults)
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "comparePrice" DECIMAL(10,2);
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "language" VARCHAR(100) NOT NULL DEFAULT 'English';
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "publication" TEXT;
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- Add new columns to Order table
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'ONLINE';

-- Add method column to Payment table
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "method" "PaymentMethod" NOT NULL DEFAULT 'ONLINE';
-- Make razorpayOrderId optional
ALTER TABLE "Payment" ALTER COLUMN "razorpayOrderId" DROP NOT NULL;

-- Add new columns to SiteSettings
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "logoWidth" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "logoHeight" INTEGER NOT NULL DEFAULT 40;

-- Create BookImage table
CREATE TABLE IF NOT EXISTS "BookImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bookId" UUID NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookImage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BookImage_bookId_idx" ON "BookImage"("bookId");
ALTER TABLE "BookImage" ADD CONSTRAINT IF NOT EXISTS "BookImage_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE;

-- Create Review table
CREATE TABLE IF NOT EXISTS "Review" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bookId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "title" TEXT,
  "comment" TEXT NOT NULL,
  "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Review_bookId_idx" ON "Review"("bookId");
CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON "Review"("userId");
ALTER TABLE "Review" ADD CONSTRAINT IF NOT EXISTS "Review_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT IF NOT EXISTS "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Create Page table
CREATE TABLE IF NOT EXISTS "Page" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "showInFooter" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Page_slug_key" ON "Page"("slug");

-- Create FeaturedSection table
CREATE TABLE IF NOT EXISTS "FeaturedSection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bookId" UUID NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "FeaturedSection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FeaturedSection_bookId_idx" ON "FeaturedSection"("bookId");

-- Add PrintOrder new columns
ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;
ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "colorPrice" DECIMAL(10,2);
ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "bwPrice" DECIMAL(10,2);
ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "bindingExtra" DECIMAL(10,2);
ALTER TABLE "PrintOrder" ADD COLUMN IF NOT EXISTS "sideExtra" DECIMAL(10,2);

-- Add reviews relation to User (no SQL needed, handled by Prisma)
