import { z } from "zod";

export const createCouponSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().positive(),
  minOrderAmount: z.number().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  isActive: z.boolean().optional().default(true),
  expiresAt: z.string().optional(),
});

export const validateCouponSchema = z.object({
  code: z.string().min(1),
  orderAmount: z.number().positive(),
});

export const updateCouponSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase().optional(),
  discountType: z.enum(["percentage", "fixed"]).optional(),
  discountValue: z.number().positive().optional(),
  minOrderAmount: z.number().positive().nullable().optional(),
  // null == unlimited uses (see coupons.service.ts validateCoupon); negative values would
  // otherwise make `usedCount >= maxUses` always true and silently brick the coupon.
  maxUses: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
}).refine(
  (data) => !(data.discountType === "percentage" && data.discountValue !== undefined && data.discountValue > 100),
  { message: "Percentage discount cannot exceed 100%", path: ["discountValue"] },
);
