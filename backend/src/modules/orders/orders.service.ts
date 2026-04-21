import { Prisma } from "@prisma/client";
import razorpay from "../../config/razorpay";
import AppError from "../../lib/AppError";
import prisma from "../../lib/prisma";
import { sendAdminOrderNotification, sendOrderInvoice } from "../../lib/email";
import { ShippingService } from "../shipping/shipping.service";

type ShippingAddress = { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };

const getCartWithItems = async (userId: string) =>
  prisma.cart.findUnique({ where: { userId }, include: { items: { include: { book: true } } } });

const getOrderWithDetails = async (orderId: string) =>
  prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { book: { select: { id: true, title: true, author: true, coverImageUrl: true, stock: true } } } }, payment: true },
  });

export const placeOrder = async (
  userId: string,
  shippingAddress: ShippingAddress,
  paymentMethod: "ONLINE" | "COD" = "ONLINE",
  customerEmail?: string,
  deliveryType?: "FREE" | "PAID",
  deliveryDistance?: number,
) => {
  const cart = await getCartWithItems(userId);
  if (!cart || cart.items.length === 0) throw new AppError("Cart is empty", 400, "CART_EMPTY");

  for (const item of cart.items) {
    if (item.book.stock < item.quantity) throw new AppError("Insufficient stock", 400, "INSUFFICIENT_STOCK");
  }

  const hasPrintItems = cart.items.some((item) => item.bindingType !== "NONE");
  if (hasPrintItems && paymentMethod === "COD") {
    throw new AppError(
      "Cash on Delivery is not available for orders with binding. Please use online payment.",
      400,
      "COD_NOT_ALLOWED_FOR_PRINT",
    );
  }

  const siteSettings = await prisma.siteSettings.findFirst();
  const spiralBindingPrice = Number(siteSettings?.spiralBindingPrice ?? 30);

  const totalAmount = cart.items.reduce(
    (total, item) => {
      const bindingExtra = item.bindingType === "SPIRAL" ? spiralBindingPrice : 0;
      return total
        .plus(new Prisma.Decimal(item.book.price).mul(item.quantity))
        .plus(new Prisma.Decimal(bindingExtra));
    },
    new Prisma.Decimal(0),
  );

  // Calculate delivery charge
  let deliveryCharge = new Prisma.Decimal(0);
  let calculatedDeliveryType: "FREE" | "PAID" = "FREE";
  if (deliveryDistance) {
    const deliveryResult = await ShippingService.calculateDeliveryCharge(deliveryDistance);
    deliveryCharge = new Prisma.Decimal(deliveryResult.deliveryCharge);
    calculatedDeliveryType = deliveryResult.deliveryType === "FREE" ? "FREE" : "PAID";
  }

  // Calculate prepaid discount
  let discountAmount = new Prisma.Decimal(0);
  if (paymentMethod === "ONLINE") {
    discountAmount = new Prisma.Decimal(await ShippingService.calculatePrepaidDiscount(totalAmount.toNumber()));
  }

  const finalAmount = totalAmount.plus(deliveryCharge).minus(discountAmount);

  let razorpayOrder: any = null;
  if (paymentMethod === "ONLINE") {
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: finalAmount.mul(100).toNumber(),
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      });
    } catch (err: any) {
      throw new AppError(
        "Online payment is not available right now. Please use Cash on Delivery.",
        400,
        "PAYMENT_GATEWAY_ERROR",
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: { 
        userId, 
        totalAmount, 
        deliveryCharge, 
        discountAmount, 
        finalAmount, 
        shippingAddress, 
        paymentMethod, 
        customerEmail, 
        deliveryType: calculatedDeliveryType, 
        deliveryDistance 
      },
    });

    await tx.orderItem.createMany({
      data: cart.items.map((item) => ({
        orderId: order.id,
        bookId: item.bookId,
        quantity: item.quantity,
        priceAtPurchase: item.book.price,
        bindingType: item.bindingType ?? "NONE",
        bindingExtra: item.bindingType === "SPIRAL" ? spiralBindingPrice : 0,
      })),
    });

    await tx.payment.create({
      data: {
        orderId: order.id,
        razorpayOrderId: razorpayOrder?.id ?? null,
        status: "PENDING",
        amount: finalAmount,
        method: paymentMethod,
      },
    });

    for (const item of cart.items) {
      await tx.book.update({ where: { id: item.bookId }, data: { stock: { decrement: item.quantity } } });
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    const createdOrder = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: { include: { book: { select: { id: true, title: true, author: true, coverImageUrl: true } } } }, payment: true },
    });

    return { ...createdOrder, razorpayOrderId: razorpayOrder?.id };
  });

  if (paymentMethod === "COD") {
    const orderData = {
      orderId: result.id,
      items: result.items.map((i) => ({
        title: i.book.title,
        quantity: i.quantity,
        price: Number(i.priceAtPurchase),
        bindingType: (i as any).bindingType ?? "NONE",
        bindingExtra: Number((i as any).bindingExtra ?? 0),
      })),
      total: Number(totalAmount),
      paymentMethod: "COD",
      shippingAddress,
      createdAt: result.createdAt.toISOString(),
      customerEmail,
    };
    if (customerEmail) sendOrderInvoice(customerEmail, orderData).catch(() => {});
    sendAdminOrderNotification(orderData).catch(() => {});
  }

  return result;
};

export const getUserOrders = async (userId: string, page: number, limit: number) => {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      include: { _count: { select: { items: true } }, payment: { select: { status: true, method: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where: { userId } }),
  ]);
  return {
    orders: orders.map((o) => ({ ...o, itemCount: o._count.items, paymentStatus: o.payment?.status ?? "PENDING", paymentMethod: o.payment?.method ?? "ONLINE" })),
    total, page, limit, totalPages: Math.ceil(total / limit),
  };
};

export const getOrderById = async (userId: string, orderId: string) => {
  const order = await getOrderWithDetails(orderId);
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (order.userId !== userId) throw new AppError("Forbidden", 403, "FORBIDDEN");
  return order;
};

export const cancelOrder = async (userId: string, orderId: string) => {
  const order = await getOrderById(userId, orderId);
  if (!["PENDING", "CONFIRMED"].includes(order.status)) throw new AppError("Order cannot be cancelled", 400, "ORDER_NOT_CANCELLABLE");
  return prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.book.update({ where: { id: item.bookId }, data: { stock: { increment: item.quantity } } });
    }
    await tx.payment.updateMany({ where: { orderId }, data: { status: "FAILED" } });
    return tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" }, include: { items: { include: { book: { select: { id: true, title: true, author: true, coverImageUrl: true, stock: true } } } }, payment: true } });
  });
};

export const requestReturn = async (userId: string, orderId: string) => {
  const order = await getOrderById(userId, orderId);
  if (order.status !== "DELIVERED") throw new AppError("Only delivered orders can be returned", 400, "NOT_DELIVERED");
  return prisma.order.update({ where: { id: orderId }, data: { status: "RETURN_REQUESTED" } });
};

export const getAdminOrders = async (page: number, limit: number, status?: string, userId?: string, dateFrom?: Date, dateTo?: Date) => {
  const where: any = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;
  if (dateFrom || dateTo) { where.createdAt = {}; if (dateFrom) where.createdAt.gte = dateFrom; if (dateTo) where.createdAt.lte = dateTo; }
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, include: { user: { select: { name: true, email: true } }, _count: { select: { items: true } }, payment: { select: { status: true, method: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.order.count({ where }),
  ]);
  return { orders: orders.map((o) => ({ ...o, itemCount: o._count.items, paymentStatus: o.payment?.status ?? "PENDING" })), total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getAdminOrderById = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      items: { include: { book: { select: { id: true, title: true, author: true, coverImageUrl: true, stock: true } } } },
      payment: true,
    },
  });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  return order;
};

export const updateOrderStatus = async (orderId: string, status: string) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  return prisma.order.update({ where: { id: orderId }, data: { status: status as any }, include: { user: { select: { id: true, name: true, email: true, role: true } }, items: { include: { book: { select: { id: true, title: true, author: true, coverImageUrl: true, stock: true } } } }, payment: true } });
};

export const deleteOrder = async (orderId: string) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  return prisma.order.delete({ where: { id: orderId } });
};
