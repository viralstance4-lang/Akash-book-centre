-- Prevents a race (double-submit / two tabs) from applying the same
-- single-use-per-customer coupon twice: the app-level "already used" check
-- in coupons.service.ts was not atomic without this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS "CouponUse_couponId_userId_key" ON "CouponUse"("couponId", "userId");
