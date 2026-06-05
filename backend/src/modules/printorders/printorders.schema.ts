import { z } from "zod";

export const createPrintSettingsSchema = z.object({
  // ── New independent B&W / Color pricing ───────────────────────────────────
  bwSingleSide:         z.number().nonnegative().optional(),
  bwBothSideUnder20:    z.number().nonnegative().optional(),
  bwBothSideAbove20:    z.number().nonnegative().optional(),
  colorSingleSide:      z.number().nonnegative().optional(),
  colorBothSideUnder20: z.number().nonnegative().optional(),
  colorBothSideAbove20: z.number().nonnegative().optional(),
  colorAbove99:         z.number().nonnegative().optional(),
  // ── Shared settings ───────────────────────────────────────────────────────
  spiralExtra:          z.number().nonnegative().default(30),
  staplerExtra:         z.number().nonnegative().default(10),
  maxPdfsPerOrder:      z.number().int().positive().default(20),
  // ── Legacy fields (backward compat — still accepted but not used in pricing)
  singleSideBasePrice:  z.number().nonnegative().optional(),
  singleSideBulkPrice:  z.number().nonnegative().optional(),
  doubleSidePrice:      z.number().nonnegative().optional(),
  bulkThreshold:        z.number().int().positive().optional(),
  colorSurcharge:       z.number().nonnegative().optional(),
  colorPrice:           z.number().nonnegative().optional(),
  bwPrice:              z.number().nonnegative().optional(),
  singleSideExtra:      z.number().nonnegative().optional(),
  bothSideDiscount:     z.number().nonnegative().optional(),
});

export const createPrintOrderSchema = z.object({
  colorType:    z.enum(["color", "bw"]),
  printSide:    z.enum(["single", "both"]),
  orientation:  z.enum(["portrait", "landscape"]),
  bindingType:  z.enum(["spiral", "stapler"]),
  /** Total pages across ALL uploaded files (before multiplying by copies) */
  pageCount:    z.union([z.number(), z.string()]).transform(Number),
  copies:       z.union([z.number(), z.string()]).transform(Number).default(1),
  totalPrice:   z.union([z.number(), z.string()]).transform(Number),
  /** Estimated print time in minutes; calculated server-side as well */
  estimatedMinutes: z.union([z.number(), z.string()]).transform(Number).optional(),
  /** Print orders are ALWAYS online payment – COD not allowed */
  paymentMethod: z.literal("ONLINE").default("ONLINE"),
  customerEmail: z.string().email("Valid email is required"),
  customerName:  z.string().min(1, "Full name is required"),
  customerPhone: z.string().regex(/^\d{10}$/, "Valid 10-digit phone number is required"),
  customerAddress: z.string().min(1, "Address is required"),
  colorPrice:    z.union([z.number(), z.string()]).transform(Number).optional(),
  bwPrice:       z.union([z.number(), z.string()]).transform(Number).optional(),
  bindingExtra:  z.union([z.number(), z.string()]).transform(Number).optional(),
  sideExtra:     z.union([z.number(), z.string()]).transform(Number).optional(),
  /** JSON array of per-file page counts, e.g. "[5,12,8]" */
  filePageCounts: z.string().optional(),
  /** JSON array of original file names */
  fileNames:      z.string().optional(),
  /** JSON array of per-file copy counts, e.g. "[2,5,1]" — replaces global copies */
  fileCopies:     z.string().optional(),
  /** JSON array of human-readable file sizes, e.g. '["1.2 MB","0.4 MB"]' */
  fileSizes:      z.string().optional(),
});

export type CreatePrintOrderInput = z.infer<typeof createPrintOrderSchema>;

export type PricingSettings = {
  bwSingleSide:         number;
  bwBothSideUnder20:    number;
  bwBothSideAbove20:    number;
  colorSingleSide:      number;
  colorBothSideUnder20: number;
  colorBothSideAbove20: number;
  colorAbove99:         number;
  spiralExtra:  number;
  staplerExtra: number;
};

export function getPricePerPage(
  totalRawPages: number,
  printSide: "single" | "both",
  colorType: "color" | "bw",
  settings: PricingSettings,
): number {
  if (colorType === "bw") {
    if (printSide === "single") return settings.bwSingleSide;
    return totalRawPages < 20 ? settings.bwBothSideUnder20 : settings.bwBothSideAbove20;
  }
  if (totalRawPages > 99) return settings.colorAbove99;
  if (printSide === "single") return settings.colorSingleSide;
  return totalRawPages < 20 ? settings.colorBothSideUnder20 : settings.colorBothSideAbove20;
}

export function calculatePrintPrice(params: {
  pageCount: number;
  copies: number;
  printSide: "single" | "both";
  colorType: "color" | "bw";
  bindingType: "spiral" | "stapler";
  settings: PricingSettings;
}): { pricePerPage: number; printCost: number; bindingCost: number; totalPrice: number } {
  const { pageCount, copies, printSide, colorType, bindingType, settings } = params;

  const pricePerPage = getPricePerPage(pageCount, printSide, colorType, settings);
  const printCost    = pricePerPage * pageCount * copies;
  const bindingCost  = (bindingType === "spiral" ? settings.spiralExtra : settings.staplerExtra) * copies;
  const totalPrice   = Math.round((printCost + bindingCost) * 100) / 100;

  return { pricePerPage, printCost, bindingCost, totalPrice };
}

/** Rule: 60 pages per minute (rounded up to nearest minute) */
export function calculateEstimatedMinutes(totalPages: number): number {
  return Math.max(1, Math.ceil(totalPages / 60));
}
