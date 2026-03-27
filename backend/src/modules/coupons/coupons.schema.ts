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
