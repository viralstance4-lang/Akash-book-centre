-- Create ReturnStatus enum
DO $$ BEGIN
  CREATE TYPE "ReturnStatus" AS ENUM ('VERIFYING', 'APPROVED', 'REJECTED', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create Return table
CREATE TABLE IF NOT EXISTS "Return" (
  "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "orderId"   UUID         NOT NULL,
  "userId"    UUID         NOT NULL,
  "email"     TEXT         NOT NULL,
  "reason"    TEXT,
  "status"    "ReturnStatus" NOT NULL DEFAULT 'VERIFYING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "Return" ADD CONSTRAINT "Return_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Return" ADD CONSTRAINT "Return_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "Return_orderId_idx"  ON "Return"("orderId");
CREATE INDEX IF NOT EXISTS "Return_userId_idx"   ON "Return"("userId");
CREATE INDEX IF NOT EXISTS "Return_email_idx"    ON "Return"("email");
