import { z } from "zod";

export const SECTION_TYPES = ["banner", "categories", "newArrivals", "featuredProducts", "printSection", "allBooks"] as const;

export const SectionConfigSchema = z.object({
  // categories section
  showAll:              z.boolean().optional(),
  selectedCategoryIds:  z.array(z.string()).optional(),
  // newArrivals section
  categoryId:           z.string().optional(),
  title:                z.string().optional(),
  // featuredProducts section
  useManual:            z.boolean().optional(),
  selectedProductIds:   z.array(z.string()).optional(),
  // shared
  limit:                z.number().int().positive().max(100).optional(),
});

export const HomepageSectionSchema = z.object({
  id:         z.string().min(1),
  type:       z.enum(SECTION_TYPES),
  title:      z.string().optional(),
  categoryId: z.string().uuid().optional(),
  enabled:    z.boolean(),
  order:      z.number().int().min(0),
  config:     SectionConfigSchema,
});

export const UpdateHomepageConfigSchema = z.object({
  sections: z.array(HomepageSectionSchema).min(1).max(20),
});

export type HomepageSection = z.infer<typeof HomepageSectionSchema>;
export type SectionConfig   = z.infer<typeof SectionConfigSchema>;
