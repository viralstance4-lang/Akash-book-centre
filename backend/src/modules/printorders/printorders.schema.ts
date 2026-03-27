import { z } from "zod";

export const createPrintSettingsSchema = z.object({
  colorPrice: z.number().positive(),
  bwPrice: z.number().positive(),
  singleSideExtra: z.number().default(0),
  bothSideDiscount: z.number().default(0),
  spiralExtra: z.number().default(0),
  staplerExtra: z.number().default(0),
});

export const createPrintOrderSchema = z.object({
  colorType: z.enum(["color", "bw"]),
  printSide: z.enum(["single", "both"]),
  orientation: z.enum(["portrait", "landscape"]),
  bindingType: z.enum(["spiral", "stapler"]),
  pageCount: z.union([z.number(), z.string()]).transform(Number),
  totalPrice: z.union([z.number(), z.string()]).transform(Number),
  paymentMethod: z.enum(["ONLINE", "COD"]).optional().default("ONLINE"),
  customerEmail: z.string().email().optional(),
  colorPrice: z.union([z.number(), z.string()]).transform(Number).optional(),
  bwPrice: z.union([z.number(), z.string()]).transform(Number).optional(),
  bindingExtra: z.union([z.number(), z.string()]).transform(Number).optional(),
  sideExtra: z.union([z.number(), z.string()]).transform(Number).optional(),
});
