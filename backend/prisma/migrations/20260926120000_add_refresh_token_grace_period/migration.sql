ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "previousTokenHash" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "previousTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_previousTokenHash_key" ON "RefreshToken"("previousTokenHash");
