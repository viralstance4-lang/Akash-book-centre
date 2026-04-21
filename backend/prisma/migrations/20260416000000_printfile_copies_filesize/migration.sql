-- Migration: Add per-file copies and fileSize to PrintFile
-- Each PDF in an order can now have its own copy count and stores its file size

ALTER TABLE "PrintFile" ADD COLUMN "fileSize" VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE "PrintFile" ADD COLUMN "copies"   INTEGER      NOT NULL DEFAULT 1;
