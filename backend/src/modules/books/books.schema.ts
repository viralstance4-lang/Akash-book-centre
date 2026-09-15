import { z } from "zod";

const stringToBoolean = (fieldName: string) =>
  z
    .union([z.boolean(), z.string(), z.number()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined;
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value === 1;
      const v = value.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(v)) return true;
      if (["false", "0", "no", "off", ""].includes(v)) return false;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} must be a boolean` });
      return z.NEVER;
    });

const stringToNumber = (fieldName: string) =>
  z.string().min(1, `${fieldName} is required`).transform((value, ctx) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} must be a valid number` });
      return z.NEVER;
    }
    return parsed;
  });

const optionalStringToNumber = (fieldName: string) =>
  z.string().optional().transform((value, ctx) => {
    if (value === undefined || value === "") return undefined;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} must be a valid number` });
      return z.NEVER;
    }
    return parsed;
  });

// Accepts a single UUID string or an array of UUID strings from FormData,
// and always produces string[]. Handles: undefined → [], "id" → ["id"], ["id1","id2"] → ["id1","id2"]
const uuidArrayField = z
  .union([z.string().uuid(), z.array(z.string().uuid())])
  .optional()
  .transform((val): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return [val];
  });

export const createBookSchema = z.object({
  title:        z.string().min(1, "Title is required"),
  author:       z.string().min(1, "Author is required"),
  isbn:         z.string().trim().min(1, "ISBN is required"),
  description:  z.string().optional(),
  price:        stringToNumber("Price").refine((val) => val > 0, "Price must be greater than 0"),
  comparePrice: optionalStringToNumber("Compare Price").refine((val) => val === undefined || val >= 0, "Compare Price must be 0 or greater"),
  categoryIds:   uuidArrayField,
  subcategoryIds: uuidArrayField,
  stock:        stringToNumber("Stock").refine((val) => val >= 0, "Stock cannot be negative"),
  language:     z.string().optional().default("English"),
  publication:  z.string().optional(),
  isPrintBook:        stringToBoolean("isPrintBook").default(false),
  allowStapleBinding: stringToBoolean("Allow staple binding").default(false),
  allowSpiralBinding: stringToBoolean("Allow spiral binding").default(false),
  isOutOfStock:       stringToBoolean("Out of Stock").default(false),
  height:       optionalStringToNumber("Height"),
  length:       optionalStringToNumber("Length"),
  breadth:      optionalStringToNumber("Breadth"),
  weight:       optionalStringToNumber("Weight"),
});

export const updateBookSchema = z.object({
  title:        z.string().min(1).optional(),
  author:       z.string().min(1).optional(),
  isbn:         z.string().trim().min(1).optional(),
  description:  z.string().optional(),
  price:        stringToNumber("Price").refine((val) => val > 0, "Price must be greater than 0").optional(),
  comparePrice: optionalStringToNumber("Compare Price").refine((val) => val === undefined || val >= 0, "Compare Price must be 0 or greater"),
  categoryIds:   uuidArrayField,
  subcategoryIds: uuidArrayField,
  stock:        stringToNumber("Stock").refine((val) => val >= 0, "Stock cannot be negative").optional(),
  language:     z.string().optional(),
  publication:  z.string().optional(),
  isPrintBook:        stringToBoolean("isPrintBook"),
  allowStapleBinding: stringToBoolean("Allow staple binding"),
  allowSpiralBinding: stringToBoolean("Allow spiral binding"),
  isOutOfStock:       stringToBoolean("Out of Stock"),
  height:       optionalStringToNumber("Height"),
  length:       optionalStringToNumber("Length"),
  breadth:      optionalStringToNumber("Breadth"),
  weight:       optionalStringToNumber("Weight"),
});

export const updateStockSchema = z.object({
  quantity: z.number(),
  type:     z.enum(["absolute", "delta"]),
});

export const getBooksQuerySchema = z.object({
  q:            z.string().optional(),
  category:     z.string().optional(),
  categoryId:   z.string().uuid().optional(),
  subcategory:  z.string().optional(),
  author:       z.string().optional(),
  minPrice:     optionalStringToNumber("Minimum price"),
  maxPrice:     optionalStringToNumber("Maximum price"),
  maxStock:     optionalStringToNumber("Maximum stock"),
  page:         optionalStringToNumber("Page").pipe(z.number().default(1)),
  limit:        optionalStringToNumber("Limit").pipe(z.number().default(10)),
});
