import prisma from "../../lib/prisma";
import { uploadImage } from "../../lib/cloudinary";
import AppError from "../../lib/AppError";
import { sendAdminPrintOrderNotification, sendPrintOrderInvoice } from "../../lib/email";

export const getPrintSettings = async () => prisma.printSettings.findFirst();

export const upsertPrintSettings = async (data: any) => {
  const existing = await prisma.printSettings.findFirst();
  if (existing) return prisma.printSettings.update({ where: { id: existing.id }, data });
  return prisma.printSettings.create({ data });
};

export const createPrintOrder = async (userId: string, data: any, file: any) => {
  if (!file) throw new AppError("PDF file is required", 400, "FILE_REQUIRED");
  const uploaded = await uploadImage(file, "print-orders");
  const order = await prisma.printOrder.create({
    data: {
      userId,
      fileUrl: uploaded.url,
      filePublicId: uploaded.publicId,
      colorType: data.colorType,
      printSide: data.printSide,
      orientation: data.orientation,
      bindingType: data.bindingType,
      pageCount: Number(data.pageCount),
      totalPrice: Number(data.totalPrice),
      status: "PENDING",
      paymentMethod: data.paymentMethod ?? "ONLINE",
      customerEmail: data.customerEmail ?? null,
      colorPrice: data.colorPrice ? Number(data.colorPrice) : null,
      bwPrice: data.bwPrice ? Number(data.bwPrice) : null,
      bindingExtra: data.bindingExtra ? Number(data.bindingExtra) : null,
      sideExtra: data.sideExtra ? Number(data.sideExtra) : null,
    },
  });

  // Build shared email payload
  const emailData = {
    orderId: order.id,
    colorType: data.colorType,
    printSide: data.printSide,
    orientation: data.orientation,
    bindingType: data.bindingType,
    pageCount: Number(data.pageCount),
    total: Number(data.totalPrice),
    paymentMethod: data.paymentMethod ?? "ONLINE",
    customerEmail: data.customerEmail ?? undefined,
  };

  // Send customer invoice for COD orders (online payment confirmed separately)
  if (data.customerEmail && data.paymentMethod === "COD") {
    sendPrintOrderInvoice(data.customerEmail, emailData).catch(() => {});
  }

  // Always notify admin
  sendAdminPrintOrderNotification(emailData).catch(() => {});

  return order;
};

export const getUserPrintOrders = async (userId: string) =>
  prisma.printOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });

export const getAllPrintOrders = async () =>
  prisma.printOrder.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

export const updatePrintOrderStatus = async (id: string, status: string) =>
  prisma.printOrder.update({ where: { id }, data: { status } });
