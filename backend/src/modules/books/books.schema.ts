import { z } from "zod";

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

export const createBookSchema = z.object({
  title:        z.string().min(1, "Title is required"),
  author:       z.string().min(1, "Author is required"),
  isbn:         z.string().min(1, "ISBN is required"),
  description:  z.string().optional(),
  price:        stringToNumber("Price"),
  comparePrice: optionalStringToNumber("Compare Price"),
  categoryId:   z.string().uuid("Category is required").optional(),
  subcategoryId:z.string().uuid("Subcategory must be a valid UUID").optional(),
  stock:        stringToNumber("Stock"),
  language:     z.string().optional().default("English"),
  publication:  z.string().optional(),
});

export const updateBookSchema = z.object({
  title:        z.string().min(1).optional(),
  author:       z.string().min(1).optional(),
  isbn:         z.string().min(1).optional(),
  description:  z.string().optional(),
  price:        stringToNumber("Price").optional(),
  comparePrice: optionalStringToNumber("Compare Price"),
  categoryId:   z.string().uuid().optional().nullable(),
  subcategoryId:z.string().uuid().optional().nullable(),
  stock:        stringToNumber("Stock").optional(),
  language:     z.string().optional(),
  publication:  z.string().optional(),
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
  page:         optionalStringToNumber("Page").pipe(z.number().default(1)),
  limit:        optionalStringToNumber("Limit").pipe(z.number().default(10)),
});
