import { z } from "zod";

export const createReturnSchema = z.object({
  email: z.string().email("Invalid email address"),
  orderId: z.string().uuid("Invalid order ID"),
  reason: z.string().optional(),
});

export const updateReturnStatusSchema = z.object({
  status: z.enum(["VERIFYING", "APPROVED", "REJECTED", "COMPLETED"]),
});

export const getUserReturnsSchema = z.object({
  email: z.string().email("Invalid email address"),
});
