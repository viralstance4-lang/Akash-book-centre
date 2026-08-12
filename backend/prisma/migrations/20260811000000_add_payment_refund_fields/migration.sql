-- Refund support for cancelled paid orders: track that a Razorpay refund was
-- initiated for a payment, its id, and Razorpay's own refund status.

-- Add new enum value (safe - only adding)
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "razorpayRefundId" TEXT,
  ADD COLUMN IF NOT EXISTS "refundStatus"     TEXT,
  ADD COLUMN IF NOT EXISTS "refundedAt"       TIMESTAMP(3);
