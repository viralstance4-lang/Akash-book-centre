import crypto from "crypto";
import prisma from "../../lib/prisma";
import { deleteImage } from "../../lib/cloudinary";
import { uploadFile, deleteFile } from "../../lib/s3";
import AppError from "../../lib/AppError";
import razorpay from "../../config/razorpay";
import env from "../../config/env";
import { ShippingService, PACKAGING_WEIGHT_KG } from "../shipping/shipping.service";
import { DistanceService, STORE_LOCATION } from "../shipping/distance.service";
import {
  sendAdminPrintOrderNotification,
  sendInvoiceNotification,
  sendPrintOrderInvoice,
} from "../../lib/email";
import { generateInvoiceNumber, generateInvoicePdf } from "../../lib/invoice";
import {
  calculateEstimatedMinutes,
  countPdfPagesFromBuffer,
  getPricePerPage,
  type CreatePrintOrderInput,
  type PricingSettings,
} from "./printorders.schema";

/**
 * Deletes a stored print-order file from whichever provider it actually lives
 * on. Shared by this module's own delete/cleanup paths and by
 * users.service.ts's account-deletion cleanup, so both stay in sync as new
 * files start landing on S3 instead of Cloudinary.
 */
export const deleteStoredFile = async (storageProvider: string, publicId: string): Promise<void> => {
  if (!publicId) return;
  if (storageProvider === "S3") await deleteFile(publicId);
  else await deleteImage(publicId);
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getPrintSettings = async () => prisma.printSettings.findFirst();

export const upsertPrintSettings = async (data: any) => {
  const existing = await prisma.printSettings.findFirst();
  if (existing) return prisma.printSettings.update({ where: { id: existing.id }, data });
  return prisma.printSettings.create({ data });
};

const DEFAULT_SETTINGS = {
  bwSingleSide:         1.00,
  bwBothSideUnder20:    2.00,
  bwBothSideAbove20:    1.00,
  colorSingleSide:      8.00,
  colorBothSideUnder20: 10.00,
  colorBothSideAbove20: 8.00,
  colorAbove99:         6.00,
  spiralExtra:     30,
  staplerExtra:    10,
  maxPdfsPerOrder: 20,
};

const getSettings = async (): Promise<PricingSettings & { maxPdfsPerOrder: number }> => {
  const row = await prisma.printSettings.findFirst();
  if (!row) return DEFAULT_SETTINGS;
  return {
    bwSingleSide:         Number((row as any).bwSingleSide         ?? DEFAULT_SETTINGS.bwSingleSide),
    bwBothSideUnder20:    Number((row as any).bwBothSideUnder20    ?? DEFAULT_SETTINGS.bwBothSideUnder20),
    bwBothSideAbove20:    Number((row as any).bwBothSideAbove20    ?? DEFAULT_SETTINGS.bwBothSideAbove20),
    colorSingleSide:      Number((row as any).colorSingleSide      ?? DEFAULT_SETTINGS.colorSingleSide),
    colorBothSideUnder20: Number((row as any).colorBothSideUnder20 ?? DEFAULT_SETTINGS.colorBothSideUnder20),
    colorBothSideAbove20: Number((row as any).colorBothSideAbove20 ?? DEFAULT_SETTINGS.colorBothSideAbove20),
    colorAbove99:         Number((row as any).colorAbove99         ?? DEFAULT_SETTINGS.colorAbove99),
    spiralExtra:          Number(row.spiralExtra),
    staplerExtra:         Number(row.staplerExtra),
    maxPdfsPerOrder:      row.maxPdfsPerOrder,
  };
};

function calcPerFilePricing(params: {
  filePageCounts: number[];
  fileCopies:     number[];
  printSide:      "single" | "both";
  colorType:      "color" | "bw";
  bindingType:    "spiral" | "stapler";
  settings:       PricingSettings & { maxPdfsPerOrder: number };
}) {
  const { filePageCounts, fileCopies, printSide, colorType, bindingType, settings } = params;

  const totalRawPages      = filePageCounts.reduce((s, n) => s + n, 0);
  const totalWeightedPages = filePageCounts.reduce((s, n, i) => s + n * (fileCopies[i] ?? 1), 0);
  const totalCopies        = fileCopies.reduce((s, c) => s + c, 0);

  const pricePerPage = getPricePerPage(totalRawPages, printSide, colorType, settings);
  const printCost    = pricePerPage * totalWeightedPages;
  const bindingCost  = (bindingType === "spiral" ? settings.spiralExtra : settings.staplerExtra) * totalCopies;
  const totalPrice   = Math.round((printCost + bindingCost) * 100) / 100;

  return { pricePerPage, printCost, bindingCost, totalPrice, totalRawPages, totalWeightedPages, totalCopies };
}

// ─── Phase 1: Create pending print order + Razorpay order ────────────────────
//
// Uploads PDFs, creates PrintOrder with status="AWAITING_PAYMENT",
// creates a Razorpay order, stores razorpayOrderId on the print order,
// and returns both IDs to the frontend so it can open Razorpay Checkout.
// Emails are NOT sent at this stage — only after payment is verified.

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

  // ── Authoritative server-side page counting ──────────────────────────────
  // Count pages from actual uploaded buffers — do not trust the frontend count.
  // Falls back to the frontend-reported count only when server detection yields 0
  // (e.g. heavily compressed or encrypted PDF that the regex cannot parse).
  const serverPageCounts: number[] = files.map((f) =>
    countPdfPagesFromBuffer(f.buffer),
  );

  const frontendPageCounts: number[] = (() => {
    const parsed = parseSafeJson<number>(data.filePageCounts, []);
    if (parsed.length === files.length) return parsed.map((n) => Math.max(1, Number(n) || 1));
    // Legacy fallback: distribute total evenly — avoid Math.ceil to prevent inflation
    const rawTotal = Math.max(1, Number(data.pageCount) || 1);
    const perFile  = Math.round(rawTotal / files.length);
    return files.map(() => Math.max(1, perFile));
  })();

  // Prefer server count; use frontend count only when server returns 0
  const filePageCounts: number[] = serverPageCounts.map((srv, i) =>
    srv > 0 ? srv : Math.max(1, frontendPageCounts[i] ?? 1),
  );

  const globalCopies = Math.max(1, Number(data.copies) || 1);
  let fileCopies: number[] = parseSafeJson<number>(data.fileCopies, []);
  if (fileCopies.length !== files.length) {
    fileCopies = files.map(() => globalCopies);
  }
  fileCopies = fileCopies.map((c) => Math.max(1, c));

  console.log("[PRINT PRICING] Server-side page counts :", serverPageCounts.join(", "));
  console.log("[PRINT PRICING] Frontend page counts    :", frontendPageCounts.join(", "));
  console.log("[PRINT PRICING] Final page counts used  :", filePageCounts.join(", "));

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
  const { totalPrice, pricePerPage, printCost, bindingCost, totalRawPages, totalWeightedPages, totalCopies } =
    calcPerFilePricing({
      filePageCounts,
      fileCopies,
      printSide:   data.printSide,
      colorType:   data.colorType,
      bindingType: data.bindingType,
      settings,
    });

  const estimatedMinutes = calculateEstimatedMinutes(totalWeightedPages);

  console.log("[PRINT PRICING] ─────────────────────────────────────────");
  console.log(`[PRINT PRICING] Color type     : ${data.colorType}`);
  console.log(`[PRINT PRICING] Print side     : ${data.printSide}`);
  console.log(`[PRINT PRICING] Binding        : ${data.bindingType}`);
  console.log(`[PRINT PRICING] Total raw pages: ${totalRawPages}`);
  console.log(`[PRINT PRICING] Price per page : ₹${pricePerPage}`);
  console.log(`[PRINT PRICING] Weighted pages : ${totalWeightedPages} (copies applied)`);
  console.log(`[PRINT PRICING] Print cost     : ₹${printCost}`);
  console.log(`[PRINT PRICING] Binding cost   : ₹${bindingCost} (${totalCopies} copies)`);
  console.log(`[PRINT PRICING] Grand total    : ₹${totalPrice}`);
  console.log("[PRINT PRICING] ─────────────────────────────────────────");

  // ── Upload all PDFs to S3 (product images stay on Cloudinary — see s3.ts) ──
  const uploadedFiles = await Promise.all(
    files.map((file, idx) =>
      uploadFile(file, "print-orders").then((r) => ({
        fileUrl:         r.url,
        filePublicId:    r.publicId,
        storageProvider: "S3",
        originalName:    fileNames[idx] ?? file.originalname,
        fileSize:        fileSizes[idx]  ?? `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        pageCount:       filePageCounts[idx] ?? 1,
        copies:          fileCopies[idx]     ?? 1,
        order:           idx,
      })),
    ),
  );

  // ── Delivery charge (same rules as regular orders) ───────────────────
  // Server-side authoritative distance calculation — never trust a client-supplied
  // distance (a tampered request could otherwise claim 0km for free delivery).
  let deliveryDistance: number | undefined;
  let calculationMethod = "UNAVAILABLE";
  if (typeof data.customerLatitude === "number" && typeof data.customerLongitude === "number") {
    try {
      const distanceResult = await DistanceService.calculateDistance(data.customerLatitude, data.customerLongitude);
      deliveryDistance = Math.round(distanceResult.distanceKm * 100) / 100;
      calculationMethod = distanceResult.method;
    } catch (err) {
      console.error("[PRINT ORDER] Distance calculation failed, falling back to zone-based shipping:", (err as Error).message);
    }
  }

  // Estimate weight: ~5 g per page + packaging; minimum 1 kg billable
  const estimatedWeightKg = Math.max(1, (totalWeightedPages * 0.005) + PACKAGING_WEIGHT_KG);
  const deliveryResult    = await ShippingService.calculateDeliveryCharge({
    distanceInKm: deliveryDistance ?? 99_999,
    orderValue:   totalPrice,
    weightInKg:   estimatedWeightKg,
    isPrintOrder: true,
  });
  const deliveryCharge = deliveryResult.charge;
  const deliveryType   = deliveryResult.type === "FREE" ? "FREE" : "PAID";
  const grandTotal     = totalPrice + deliveryCharge;

  console.log(`[PRINT ORDER] Delivery: ₹${deliveryCharge} (${deliveryResult.type}) | Grand total: ₹${grandTotal}`);

  // ── Create Razorpay order ──────────────────────────────────────────────
  let razorpayOrder: any;
  try {
    razorpayOrder = await razorpay.orders.create({
      amount:   Math.round(grandTotal * 100),   // paise — print cost + delivery
      currency: "INR",
      receipt:  `print_${Date.now()}`,
    });
  } catch (err: any) {
    // Clean up just-uploaded S3 files so we don't leak assets
    await Promise.allSettled(uploadedFiles.map((f) => deleteFile(f.filePublicId)));
    throw new AppError(
      "Payment gateway is unavailable. Please try again.",
      502,
      "PAYMENT_GATEWAY_ERROR",
    );
  }

  // ── Create PrintOrder with status AWAITING_PAYMENT ───────────────────
  const order = await prisma.printOrder.create({
    data: {
      userId,
      fileUrl:          uploadedFiles[0]?.fileUrl      ?? "",
      filePublicId:     uploadedFiles[0]?.filePublicId ?? "",
      storageProvider:  "S3",
      colorType:        data.colorType,
      printSide:        data.printSide,
      orientation:      data.orientation,
      bindingType:      data.bindingType,
      pageCount:        totalRawPages,
      copies:           totalCopies,
      totalPrice,
      deliveryCharge,
      deliveryType,
      deliveryDistance: deliveryDistance ?? null,
      customerLatitude:  data.customerLatitude ?? null,
      customerLongitude: data.customerLongitude ?? null,
      calculationMethod,
      storeLocation: STORE_LOCATION as any,
      estimatedMinutes,
      status:           "AWAITING_PAYMENT",
      paymentMethod:    "ONLINE",
      razorpayOrderId:  razorpayOrder.id,
      customerEmail:    data.customerEmail,
      customerName:     data.customerName,
      customerPhone:    data.customerPhone,
      customerAddress:  data.customerAddress,
      colorPrice:       pricePerPage,
      files: { create: uploadedFiles },
    },
    include: { files: { orderBy: { order: "asc" } } },
  });

  console.log(`[PRINT ORDER] Pending #${order.id.slice(0, 8).toUpperCase()} | Print: ₹${totalPrice} | Delivery: ₹${deliveryCharge} | Total: ₹${grandTotal} | Razorpay: ${razorpayOrder.id}`);

  return {
    printOrderId:    order.id,
    razorpayOrderId: razorpayOrder.id,
    amount:          grandTotal,
    deliveryCharge,
    customerName:    data.customerName,
    customerEmail:   data.customerEmail,
  };
};

// ─── Phase 2: Verify Razorpay payment + confirm PrintOrder ───────────────────
//
// Verifies HMAC signature. On success: marks order CONFIRMED, stores payment
// IDs, then fires customer invoice + admin notification emails.
// On failure: marks order PAYMENT_FAILED (PDFs remain in Cloudinary for retry).

export const verifyPrintOrderPayment = async (
  userId: string,
  printOrderId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
) => {
  const order = await prisma.printOrder.findUnique({
    where:   { id: printOrderId },
    include: { files: { orderBy: { order: "asc" } } },
  });

  if (!order) throw new AppError("Print order not found", 404, "PRINT_ORDER_NOT_FOUND");
  if (order.userId !== userId) throw new AppError("Forbidden", 403, "FORBIDDEN");
  if (order.razorpayOrderId !== razorpayOrderId) {
    throw new AppError("Order ID mismatch", 400, "ORDER_ID_MISMATCH");
  }

  // Idempotency: already confirmed (e.g. duplicate webhook)
  if (order.status === "CONFIRMED") return order;

  if (order.status !== "AWAITING_PAYMENT") {
    throw new AppError(
      "This order is no longer awaiting payment",
      400,
      "INVALID_ORDER_STATE",
    );
  }

  // ── Cryptographic signature verification ──────────────────────────────
  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    await prisma.printOrder.update({
      where: { id: printOrderId },
      data:  { status: "PAYMENT_FAILED", razorpayPaymentId, razorpaySignature },
    });
    throw new AppError("Payment verification failed", 400, "PAYMENT_VERIFICATION_FAILED");
  }

  // ── Generate invoice number ───────────────────────────────────────────
  const invNum = generateInvoiceNumber();

  // ── Confirm the order ─────────────────────────────────────────────────
  const confirmed = await prisma.printOrder.update({
    where: { id: printOrderId },
    data: {
      status:            "CONFIRMED",
      razorpayPaymentId,
      razorpaySignature,
      invoiceNumber:     invNum,
    },
    include: { files: { orderBy: { order: "asc" } } },
  });

  console.log(`[PRINT ORDER] Confirmed #${printOrderId.slice(0, 8).toUpperCase()} | Payment: ${razorpayPaymentId}`);

  // ── Send emails now that payment is verified ──────────────────────────
  const fileNames = confirmed.files.map((f) => f.originalName);
  const emailPayload = {
    orderId:          confirmed.id,
    colorType:        confirmed.colorType,
    printSide:        confirmed.printSide,
    orientation:      confirmed.orientation,
    bindingType:      confirmed.bindingType,
    pageCount:        confirmed.pageCount,
    copies:           confirmed.copies,
    estimatedMinutes: confirmed.estimatedMinutes,
    total:            Number(confirmed.totalPrice),
    paymentMethod:    "ONLINE" as const,
    razorpayPaymentId,
    customerEmail:    confirmed.customerEmail ?? "",
    customerName:     confirmed.customerName  ?? "",
    customerPhone:    confirmed.customerPhone ?? "",
    customerAddress:  confirmed.customerAddress ?? "",
    fileNames,
    fileItems: confirmed.files.map((f) => ({
      name:      f.originalName,
      copies:    f.copies,
      pageCount: f.pageCount,
    })),
    createdAt:     confirmed.createdAt.toISOString(),
    invoiceNumber: invNum,
  };

  sendAdminPrintOrderNotification(emailPayload).catch((err) => {
    console.error("[PRINT ORDER] Admin notification failed:", (err as Error).message);
  });
  sendInvoiceNotification({
    orderId:       confirmed.id,
    orderType:     "PRINT",
    customerName:  confirmed.customerName  ?? "",
    customerEmail: confirmed.customerEmail ?? "",
    total:         Number(confirmed.totalPrice),
    paymentMethod: "ONLINE",
  }).catch(() => {});

  if (confirmed.customerEmail) {
    const sendWithPdf = async () => {
      try {
        const pdfBuffer = await generateInvoicePdf({
          invoiceNumber: invNum,
          orderId:       confirmed.id,
          createdAt:     confirmed.createdAt,
          customerName:  confirmed.customerName  ?? "Customer",
          customerEmail: confirmed.customerEmail ?? undefined,
          shippingAddress: {
            name:  confirmed.customerName  ?? undefined,
            phone: confirmed.customerPhone ?? undefined,
            line1: confirmed.customerAddress ?? undefined,
          },
          items: [{ name: `Print Order — ${confirmed.pageCount} pages x ${confirmed.copies} copies`, quantity: 1, unitPrice: Number(confirmed.totalPrice) }],
          subtotal:      Number(confirmed.totalPrice),
          total:         Number(confirmed.totalPrice),
          paymentMethod: "ONLINE",
          isPrintOrder:  true,
          printSpecs: {
            colorType:   confirmed.colorType,
            printSide:   confirmed.printSide,
            orientation: confirmed.orientation,
            bindingType: confirmed.bindingType,
            pageCount:   confirmed.pageCount,
            copies:      confirmed.copies,
          },
        });
        await sendPrintOrderInvoice(confirmed.customerEmail!, emailPayload, pdfBuffer);
        await prisma.printOrder.update({
          where: { id: confirmed.id },
          data:  { invoiceSent: true, invoiceSentAt: new Date() },
        });
      } catch (err) {
        console.error("[INVOICE] Print order invoice failed:", (err as Error).message);
      }
    };
    sendWithPdf().catch(() => {});
  }

  return confirmed;
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
  const order = await prisma.printOrder.findUnique({
    where:   { id },
    include: { files: true },
  });
  if (!order) throw new AppError("Print order not found", 404, "NOT_FOUND");

  const storageDeletes = [
    deleteStoredFile(order.storageProvider, order.filePublicId),
    ...order.files.map((f) => deleteStoredFile(f.storageProvider, f.filePublicId)),
  ];
  await Promise.allSettled(storageDeletes);
  await prisma.printOrder.delete({ where: { id } });
};

export const resendPrintInvoice = async (printOrderId: string) => {
  const order = await prisma.printOrder.findUnique({
    where:   { id: printOrderId },
    include: { files: { orderBy: { order: "asc" } }, user: { select: { email: true, name: true } } },
  });
  if (!order) throw new AppError("Print order not found", 404, "NOT_FOUND");

  const recipient = order.customerEmail ?? (order.user as any)?.email;
  if (!recipient) throw new AppError("No customer email on this order", 400, "NO_EMAIL");

  const invNum = (order as any).invoiceNumber ?? generateInvoiceNumber();

  const pdfBuffer = await generateInvoicePdf({
    invoiceNumber: invNum,
    orderId:       order.id,
    createdAt:     order.createdAt,
    customerName:  order.customerName  ?? "Customer",
    customerEmail: recipient,
    shippingAddress: {
      name:  order.customerName  ?? undefined,
      phone: order.customerPhone ?? undefined,
      line1: order.customerAddress ?? undefined,
    },
    items: [{ name: `Print Order — ${order.pageCount} pages x ${order.copies} copies`, quantity: 1, unitPrice: Number(order.totalPrice) }],
    subtotal:      Number(order.totalPrice),
    total:         Number(order.totalPrice),
    paymentMethod: "ONLINE",
    isPrintOrder:  true,
    printSpecs: {
      colorType:   order.colorType,
      printSide:   order.printSide,
      orientation: order.orientation,
      bindingType: order.bindingType,
      pageCount:   order.pageCount,
      copies:      order.copies,
    },
  });

  const emailPayload = {
    orderId:          order.id,
    colorType:        order.colorType,
    printSide:        order.printSide,
    orientation:      order.orientation,
    bindingType:      order.bindingType,
    pageCount:        order.pageCount,
    copies:           order.copies,
    estimatedMinutes: order.estimatedMinutes,
    total:            Number(order.totalPrice),
    paymentMethod:    "ONLINE" as const,
    customerEmail:    recipient,
    customerName:     order.customerName  ?? "",
    customerPhone:    order.customerPhone ?? "",
    customerAddress:  order.customerAddress ?? "",
    fileItems: order.files.map((f) => ({ name: f.originalName, copies: f.copies, pageCount: f.pageCount })),
    createdAt:     order.createdAt.toISOString(),
    invoiceNumber: invNum,
  };

  await sendPrintOrderInvoice(recipient, emailPayload, pdfBuffer);

  return prisma.printOrder.update({
    where: { id: printOrderId },
    data:  { invoiceNumber: invNum, invoiceSent: true, invoiceSentAt: new Date() },
  });
};


export const markPrintOrderSeen = async (id: string) => {
  await prisma.printOrder.update({ where: { id }, data: { adminSeen: true } });
};
