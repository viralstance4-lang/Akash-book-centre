import { z } from "zod";

export const createBannerSchema = z.object({
  redirectUrl: z.string().min(1),
  title: z.string().optional(),
  isActive: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional().default(true),
  order: z.preprocess((v) => Number(v), z.number().int()).optional().default(0),
});

// PATCH sends multipart/form-data so all values arrive as strings — preprocess each field.
export const updateBannerSchema = z.object({
  redirectUrl: z.string().min(1).optional(),
  title: z.string().optional(),
  isActive: z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    return v === "true" || v === true;
  }, z.boolean().optional()),
  order: z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    return Number(v);
  }, z.number().int().optional()),
});
