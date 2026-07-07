import { z } from "zod";

export const SECTION_TYPES    = ["books", "banner", "categories", "printCta", "allBooks"] as const;
export const LAYOUT_TYPES     = ["horizontal", "grid", "carousel"] as const;
export const BOOK_FILTER_TYPES = ["newArrivals", "bestSellers", "featured", "all"] as const;
/// How a 'categories' section displays each selected category:
/// 'auto' shows its subcategories when it has any, else the category itself.
export const CATEGORY_DISPLAY_MODES = ["auto", "categories", "subcategories"] as const;

export const SectionConfigSchema = z.object({
  limit:                  z.number().int().positive().max(100).optional(),
  showAll:                z.boolean().optional(),
  selectedCategoryIds:    z.array(z.string()).optional(),
  selectedSubcategoryIds: z.array(z.string()).optional(),
  displayMode:            z.enum(CATEGORY_DISPLAY_MODES).optional(),
  useManual:              z.boolean().optional(),
  selectedProductIds:     z.array(z.string()).optional(),
}).default({});

export const CreateSectionSchema = z.object({
  title:        z.string().min(1).max(255),
  subtitle:     z.string().max(255).optional(),
  description:  z.string().optional(),
  type:         z.enum(SECTION_TYPES).default("books"),
  layoutType:   z.enum(LAYOUT_TYPES).default("horizontal"),
  bookFilter:   z.enum(BOOK_FILTER_TYPES).default("newArrivals"),
  categoryId:   z.string().uuid().optional().nullable(),
  subcategoryId:z.string().uuid().optional().nullable(),
  isEnabled:    z.boolean().default(true),
  order:        z.number().int().min(0).optional(),
  config:       SectionConfigSchema,
});

export const UpdateSectionSchema = CreateSectionSchema.partial();

export const ReorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export type CreateSectionInput = z.infer<typeof CreateSectionSchema>;
export type UpdateSectionInput = z.infer<typeof UpdateSectionSchema>;
