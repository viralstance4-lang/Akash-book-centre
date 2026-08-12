import { z } from "zod";

const slugField = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain only lowercase letters, numbers, and hyphens");

export const createPageSchema = z.object({
  title:        z.string().trim().min(1, "Title is required"),
  slug:         slugField,
  content:      z.string().trim().min(1, "Content is required"),
  isActive:     z.boolean().optional().default(true),
  showInFooter: z.boolean().optional().default(true),
});

export const updatePageSchema = z.object({
  title:        z.string().trim().min(1, "Title is required").optional(),
  slug:         slugField.optional(),
  content:      z.string().trim().min(1, "Content is required").optional(),
  isActive:     z.boolean().optional(),
  showInFooter: z.boolean().optional(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
