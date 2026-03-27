import { z } from "zod";

const stringToNumber = (fieldName: string) =>
  z.string().min(1, `${fieldName} is required`).transform((value, ctx) => {
    const parsedValue = Number(value);
    if (Number.isNaN(parsedValue)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} must be a valid number` });
      return z.NEVER;
    }
    return parsedValue;
  });

const optionalStringToNumber = (fieldName: string) =>
  z.string().optional().transform((value, ctx) => {
    if (value === undefined || value === "") return undefined;
    const parsedValue = Number(value);
    if (Number.isNaN(parsedValue)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} must be a valid number` });
      return z.NEVER;
    }
    return parsedValue;
  });

export const createBookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  isbn: z.string().min(1, "ISBN is required"),
  description: z.string().optional(),
  price: stringToNumber("Price"),
  comparePrice: optionalStringToNumber("Compare Price"),
  genreId: z.string().min(1, "Genre is required"),
  stock: stringToNumber("Stock"),
  language: z.string().optional().default("English"),
  publication: z.string().optional(),
});

export const updateBookSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  author: z.string().min(1, "Author is required").optional(),
  isbn: z.string().min(1, "ISBN is required").optional(),
  description: z.string().optional(),
  price: stringToNumber("Price").optional(),
  comparePrice: optionalStringToNumber("Compare Price"),
  genreId: z.string().min(1, "Genre is required").optional(),
  stock: stringToNumber("Stock").optional(),
  language: z.string().optional(),
  publication: z.string().optional(),
});

export const updateStockSchema = z.object({
  quantity: z.number(),
  type: z.enum(["absolute", "delta"]),
});

export const getBooksQuerySchema = z.object({
  q: z.string().optional(),
  genre: z.string().optional(),
  author: z.string().optional(),
  minPrice: optionalStringToNumber("Minimum price"),
  maxPrice: optionalStringToNumber("Maximum price"),
  page: optionalStringToNumber("Page").pipe(z.number().default(1)),
  limit: optionalStringToNumber("Limit").pipe(z.number().default(10)),
});
