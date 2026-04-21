-- Add isVerified column: existing users default to true (already trusted)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT true;
