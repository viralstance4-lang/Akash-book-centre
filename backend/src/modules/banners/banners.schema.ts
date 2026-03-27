import { z } from "zod";

export const createBannerSchema = z.object({
  redirectUrl: z.string().min(1),
  title: z.string().optional(),
  isActive: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional().default(true),
  order: z.preprocess((v) => Number(v), z.number().int()).optional().default(0),
});

export const updateBannerSchema = z.object({
  redirectUrl: z.string().min(1).optional(),
  title: z.string().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().optional(),
});
