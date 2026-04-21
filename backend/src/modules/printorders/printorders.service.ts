import prisma from "../../lib/prisma";
import { uploadImage, deleteImage } from "../../lib/cloudinary";
import AppError from "../../lib/AppError";
import {
  sendAdminPrintOrderNotification,
  sendInvoiceNotification,
  sendPrintOrderInvoice,
} from "../../lib/email";
import {
  calculateEstimatedMinutes,
  type CreatePrintOrderInput,
} from "./printorders.schema";

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getPrintSettings = async () => prisma.printSettings.findFirst();

export const upsertPrintSettings = async (data: any) => {
  const existing = await prisma.printSettings.findFirst();
  if (existing) return prisma.printSettings.update({ where: { id: existing.id }, data });
  return prisma.printSettings.create({ data });
};

const DEFAULT_SETTINGS = {
  singleSideBasePrice: 1.00,
  singleSideBulkPrice: 0.50,
  doubleSidePrice:     1.00,
  bulkThreshold:       20,
  colorSurcharge:      3.00,
  spiralExtra:         30,
  staplerExtra:        10,
  maxPdfsPerOrder:     20,
};

const getSettings = async () => {
  const row = await prisma.printSettings.findFirst();
  if (!row) return DEFAULT_SETTINGS;
  return {
    singleSideBasePrice: Number(row.singleSideBasePrice),
    singleSideBulkPrice: Number(row.singleSideBulkPrice),
    doubleSidePrice:     Number(row.doubleSidePrice),
    bulkThreshold:       row.bulkThreshold,
    colorSurcharge:      Number(row.colorSurcharge),
    spiralExtra:         Number(row.spiralExtra),
    staplerExtra:        Number(row.staplerExtra),
    maxPdfsPerOrder:     row.maxPdfsPerOrder,
  };
};

// ─── Per-file pricing helpers ─────────────────────────────────────────────────

/**
 * Calculates total price when each file has its own copy count.
 *
 * Print cost  = pricePerPage × Σ(pageCount[i] × copies[i])
 * Binding cost = bindingRate × Σ(copies[i])   (one binding charge per physical copy)
 * Bulk rule applies to total raw pages (unweighted) as a threshold signal.
 */
function calcPerFilePricing(params: {
  filePageCounts: number[];
  fileCopies:     number[];
  printSide:      "single" | "both";
  colorType:      "color" | "bw";
  bindingType:    "spiral" | "stapler";
  settings:       typeof DEFAULT_SETTINGS;
}) {
  const { filePageCounts, fileCopies, printSide, colorType, bindingType, settings } = params;

  const totalRawPages     = filePageCounts.reduce((s, n) => s + n, 0);
  const totalWeightedPages = filePageCounts.reduce((s, n, i) => s + n * (fileCopies[i] ?? 1), 0);
  const totalCopies        = fileCopies.reduce((s, c) => s + c, 0);

  const isBulk = totalRawPages > settings.bulkThreshold;
  const basePPP =
    printSide === "single"
      ? isBulk ? settings.singleSideBulkPrice : settings.singleSideBasePrice
      : settings.doubleSidePrice;

  const pricePerPage = basePPP + (colorType === "color" ? settings.colorSurcharge : 0);
  const printCost    = pricePerPage * totalWeightedPages;
  const bindingCost  = (bindingType === "spiral" ? settings.spiralExtra : settings.staplerExtra) * totalCopies;
  const totalPrice   = Math.round((printCost + bindingCost) * 100) / 100;

  return { pricePerPage, printCost, bindingCost, totalPrice, totalRawPages, totalWeightedPages, totalCopies };
}

// ─── Create Print Order (multi-file with per-file copies) ─────────────────────

export const createPrintOrder = async (
  userId: string,
  data: CreatePrintOrderInput,
  files: Express.Multer.File[],
) => {
  const settings = await getSettings();

  if (!files || files.length === 0) {
    throw new AppError("At least one PDF file is required", 400, "FILE_REQUIRED");
  }
  if (files.length > settings.maxPdfsPerOrder) {
    throw new AppError(
      `Maximum ${settings.maxPdfsPerOrder} PDF files allowed per order`,
      400,
      "TOO_MANY_FILES",
    );
  }

  // ── Parse per-file arrays ────────────────────────────────────────────────
  const parseSafeJson = <T>(raw: string | undefined, fallback: T[]): T[] => {
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T[]; } catch { return fallback; }
  };

  const rawPageCount = Number(data.pageCount) || 0;
  const perFile      = Math.max(1, Math.ceil(rawPageCount / files.length));

  let filePageCounts: number[] = parseSafeJson<number>(data.filePageCounts, []);
  if (filePageCounts.length !== files.length) {
    filePageCounts = files.map(() => perFile);
  }

  // Per-file copies: prefer fileCopies array; fall back to global copies for all files
  const globalCopies = Math.max(1, Number(data.copies) || 1);
  let fileCopies: number[] = parseSafeJson<number>(data.fileCopies, []);
  if (fileCopies.length !== files.length) {
    fileCopies = files.map(() => globalCopies);
  }
  fileCopies = fileCopies.map((c) => Math.max(1, c));

  let fileNames: string[] = files.map((f) => f.originalname);
  if (data.fileNames) {
    const parsed = parseSafeJson<string>(data.fileNames, []);
    if (parsed.length === files.length) fileNames = parsed;
  }

  let fileSizes: string[] = files.map((f) => `${(f.size / 1024 / 1024).toFixed(2)} MB`);
  if (data.fileSizes) {
    const parsed = parseSafeJson<string>(data.fileSizes, []);
    if (parsed.length === files.length) fileSizes = parsed;
  }

  // ── Server-side pricing (authoritative) ────────────────────────────────
  const { totalPrice, pricePerPage, totalRawPages, totalWeightedPages, totalCopies } =
    calcPerFilePricing({
      filePageCounts,
      fileCopies,
      printSide:   data.printSide,
      colorType:   data.colorType,
      bindingType: data.bindingType,
      settings,
    });

  const estimatedMinutes = calculateEstimatedMinutes(totalWeightedPages);

  // ── Upload all PDFs to Cloudinary ────────────────────────────────────────
  const uploadedFiles = await Promise.all(
    files.map((file, idx) =>
      uploadImage(file, "print-orders").then((r) => ({
        fileUrl:      r.url,
        filePublicId: r.publicId,
        originalName: fileNames[idx] ?? file.originalname,
        fileSize:     fileSizes[idx]  ?? `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        pageCount:    filePageCounts[idx] ?? 1,
        copies:       fileCopies[idx]     ?? 1,
        order:        idx,
      })),
    ),
  );

  // ── Create order + files atomically ─────────────────────────────────────
  const order = await prisma.printOrder.create({
    data: {
      userId,
      fileUrl:          uploadedFiles[0]?.fileUrl      ?? "",
      filePublicId:     uploadedFiles[0]?.filePublicId ?? "",
      colorType:        data.colorType,
      printSide:        data.printSide,
      orientation:      data.orientation,
      bindingType:      data.bindingType,
      pageCount:        totalRawPages,
      copies:           totalCopies,   // sum of all per-file copies (for backward compat)
      totalPrice,
      estimatedMinutes,
      status:           "PENDING",
      paymentMethod:    "ONLINE",
      customerEmail:    data.customerEmail,
      customerName:     data.customerName,
      customerPhone:    data.customerPhone,
      customerAddress:  data.customerAddress,
      colorPrice:       pricePerPage,
      files: { create: uploadedFiles },
    },
    include: { files: { orderBy: { order: "asc" } } },
  });

  // ── Notifications ─────────────────────────────────────────────────────────
  const emailPayload = {
    orderId:          order.id,
    colorType:        data.colorType,
    printSide:        data.printSide,
    orientation:      data.orientation,
    bindingType:      data.bindingType,
    pageCount:        totalRawPages,
    copies:           totalCopies,
    estimatedMinutes,
    total:            Number(totalPrice),
    paymentMethod:    "ONLINE",
    customerEmail:    data.customerEmail,
    customerName:     data.customerName,
    customerPhone:    data.customerPhone,
    customerAddress:  data.customerAddress,
    fileNames,
    fileItems: fileNames.map((name, i) => ({
      name,
      copies:    fileCopies[i]     ?? 1,
      pageCount: filePageCounts[i] ?? 0,
    })),
    createdAt: order.createdAt.toISOString(),
  };

  console.log(`[PRINT ORDER] Created #${order.id.slice(0, 8).toUpperCase()} | User: ${userId} | ₹${totalPrice} | Files: ${fileNames.length} | Customer: ${data.customerName} <${data.customerEmail}>`);

  if (data.customerEmail) {
    sendPrintOrderInvoice(data.customerEmail, emailPayload).catch((err) => {
      console.error("[PRINT ORDER] Customer invoice email failed:", (err as Error).message);
    });
  }
  sendAdminPrintOrderNotification(emailPayload).catch((err) => {
    console.error("[PRINT ORDER] Admin notification email failed:", (err as Error).message);
  });

  sendInvoiceNotification({
    orderId:       order.id,
    orderType:     "PRINT",
    customerName:  data.customerName,
    customerEmail: data.customerEmail,
    total:         Number(totalPrice),
    paymentMethod: "ONLINE",
  }).catch(() => {});

  return order;
};

// ─── User Print Orders ────────────────────────────────────────────────────────

export const getUserPrintOrders = async (userId: string) =>
  prisma.printOrder.findMany({
    where:   { userId },
    include: { files: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

// ─── Admin ────────────────────────────────────────────────────────────────────

export const getAllPrintOrders = async () =>
  prisma.printOrder.findMany({
    include: {
      user:  { select: { id: true, name: true, email: true, phone: true } },
      files: { orderBy: { order: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

export const updatePrintOrderStatus = async (id: string, status: string) =>
  prisma.printOrder.update({ where: { id }, data: { status } });

export const deletePrintOrder = async (id: string) => {
  // Fetch order + files so we can clean up Cloudinary assets
  const order = await prisma.printOrder.findUnique({
    where:   { id },
    include: { files: true },
  });
  if (!order) throw new AppError("Print order not found", 404, "NOT_FOUND");

  // Delete every uploaded PDF from Cloudinary (fire-and-forget; DB delete still proceeds)
  const cloudinaryDeletes = [
    // Legacy single-file field
    order.filePublicId ? deleteImage(order.filePublicId) : Promise.resolve(),
    // Per-file records
    ...order.files.map((f) => (f.filePublicId ? deleteImage(f.filePublicId) : Promise.resolve())),
  ];
  await Promise.allSettled(cloudinaryDeletes);

  // Delete the order — PrintFile rows cascade-delete via the FK relation
  await prisma.printOrder.delete({ where: { id } });
};
