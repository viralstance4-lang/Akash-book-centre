import { z } from "zod";

export const CATEGORY_SECTION_CONTENT_TYPES = ["category", "manual"] as const;

// create/update routes are hit with multipart/form-data (an optional "image"
// file rides alongside), so every non-file field arrives as a string —
// preprocess booleans, numbers and JSON-encoded id arrays into real types,
// mirroring the approach in banners.schema.ts.

const jsonArrayOfIds = () =>
  z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    if (typeof v === "string") {
      try { return JSON.parse(v); } catch { return v; }
    }
    return v;
  }, z.array(z.string().uuid()).optional());

const optionalInt = () =>
  z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    return Number(v);
  }, z.number().int().optional());

const optionalBool = () =>
  z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    return v === "true" || v === true;
  }, z.boolean().optional());

// "" (no category selected, e.g. a manual section) normalizes to null;
// omitted entirely (update only) leaves the existing value untouched.
const categoryIdField = z.preprocess(
  (v) => (v === "" ? null : v),
  z.string().uuid().optional().nullable(),
);

export const createCategorySectionSchema = z
  .object({
    heading: z.string().min(1, "Heading is required"),
    contentType: z.enum(CATEGORY_SECTION_CONTENT_TYPES).optional().default("category"),
    categoryId: categoryIdField,
    subcategoryIds: jsonArrayOfIds(),
    bookIds: jsonArrayOfIds(),
    sortOrder: optionalInt(),
  })
  .superRefine((data, ctx) => {
    if (data.contentType === "category" && !data.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "categoryId is required when contentType is \"category\"",
      });
    }
    if (data.contentType === "manual" && (!data.bookIds || data.bookIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bookIds"],
        message: "At least one book is required when contentType is \"manual\"",
      });
    }
  });

export const updateCategorySectionSchema = z
  .object({
    heading: z.string().min(1, "Heading is required").optional(),
    contentType: z.enum(CATEGORY_SECTION_CONTENT_TYPES).optional(),
    categoryId: categoryIdField,
    subcategoryIds: jsonArrayOfIds(),
    bookIds: jsonArrayOfIds(),
    sortOrder: optionalInt(),
    isActive: optionalBool(),
    removeImage: optionalBool(),
  })
  .superRefine((data, ctx) => {
    // Only enforce the cross-field invariant when this update actually
    // touches contentType — a partial update (e.g. just flipping isActive)
    // shouldn't be forced to resend categoryId/bookIds.
    if (data.contentType === undefined) return;
    if (data.contentType === "category" && !data.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "categoryId is required when contentType is \"category\"",
      });
    }
    if (data.contentType === "manual" && (!data.bookIds || data.bookIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bookIds"],
        message: "At least one book is required when contentType is \"manual\"",
      });
    }
  });

export type CreateCategorySectionInput = z.infer<typeof createCategorySectionSchema>;
export type UpdateCategorySectionInput = z.infer<typeof updateCategorySectionSchema>;
