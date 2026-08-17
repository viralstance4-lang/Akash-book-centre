-- Print-order PDFs are migrating from Cloudinary to S3 (Cloudinary's raw-file
-- size cap — 10MB Free / 20MB paid — silently blocked real customer orders).
-- New uploads go to S3; existing rows stay on Cloudinary untouched. This
-- column records which provider each stored file actually lives on so
-- pdf.controller.ts and cleanup paths can read/delete from the right place.

ALTER TABLE "PrintFile"
  ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'CLOUDINARY';

ALTER TABLE "PrintOrder"
  ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'CLOUDINARY';
