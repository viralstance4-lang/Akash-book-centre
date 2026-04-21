-- Add missing spiralBindingPrice column to SiteSettings
ALTER TABLE "SiteSettings" ADD COLUMN "spiralBindingPrice" DECIMAL(10,2) NOT NULL DEFAULT 30;
