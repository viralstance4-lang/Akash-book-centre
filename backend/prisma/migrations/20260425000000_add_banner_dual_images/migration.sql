-- Add separate desktop and mobile image fields to Banner table.
-- imageUrl / publicId are kept as-is for backward compatibility with existing banners.
ALTER TABLE "Banner" ADD COLUMN "desktopImageUrl" TEXT;
ALTER TABLE "Banner" ADD COLUMN "desktopPublicId" TEXT;
ALTER TABLE "Banner" ADD COLUMN "mobileImageUrl"  TEXT;
ALTER TABLE "Banner" ADD COLUMN "mobilePublicId"  TEXT;
