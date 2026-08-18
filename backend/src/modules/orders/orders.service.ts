import { Prisma } from "@prisma/client";
import razorpay from "../../config/razorpay";
import AppError from "../../lib/AppError";
import logger from "../../config/logger";
import prisma from "../../lib/prisma";
import { sendAdminOrderNotification, sendInvoiceNotification, sendOrderInvoice } from "../../lib/email";
import { generateInvoiceNumber, generateInvoicePdf } from "../../lib/invoice";
import { ShippingService, PACKAGING_WEIGHT_KG } from "../shipping/shipping.service";
import { DistanceService, STORE_LOCATION } from "../shipping/distance.service";
import { validateCoupon } from "../coupons/coupons.service";

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
  customerLatitude?: number,
  customerLongitude?: number,
  couponCode?: string,
) => {
  const cart = await getCartWithItems(userId);
  if (!cart || cart.items.length === 0) throw new AppError("Cart is empty", 400, "CART_EMPTY");

  for (const item of cart.items) {
    if (item.book.stock < item.quantity) throw new AppError("Insufficient stock", 400, "INSUFFICIENT_STOCK");
  }

  const hasPrintBook    = cart.items.some((item) => (item.book as any).isPrintBook === true);
  const hasSpiralBinding = cart.items.some((item) => item.bindingType === "SPIRAL");

  if ((hasPrintBook || hasSpiralBinding) && paymentMethod === "COD") {
    const reason = hasPrintBook
      ? "Cash on Delivery is not available for Print Books. Please use online payment."
      : "Cash on Delivery is not available for Spiral Binding orders. Please use online payment.";
    throw new AppError(reason, 400, "COD_NOT_ALLOWED");
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

  // Sum actual book weights from cart items (minimum 1 kg enforced inside ShippingService)
  const totalWeightKg = cart.items.reduce((sum, item) => {
    const w = Number((item.book as any).weight ?? 0);
    return sum + w * item.quantity;
  }, 0);

  // Add fixed packaging weight so every order includes 150 g of packaging material
  const shippingWeightKg = totalWeightKg + PACKAGING_WEIGHT_KG;

  // Server-side authoritative distance calculation — never trust a client-supplied
  // distance (a tampered request could otherwise claim 0km for free delivery).
  let deliveryDistance: number | undefined;
  let calculationMethod = "UNAVAILABLE";
  if (typeof customerLatitude === "number" && typeof customerLongitude === "number") {
    try {
      const distanceResult = await DistanceService.calculateDistance(customerLatitude, customerLongitude);
      deliveryDistance = Math.round(distanceResult.distanceKm * 100) / 100;
      calculationMethod = distanceResult.method;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "[ORDERS] Distance calculation failed — falling back to zone-based shipping");
    }
  }

  // Calculate delivery charge — always runs so zone-based pricing is applied even when
  // the customer's distance couldn't be determined.
  // distanceInKm: use actual distance if known, otherwise 99_999 → forces beyond-range
  // path and lets zone detection (city/state) determine the rate.
  const deliveryResult = await ShippingService.calculateDeliveryCharge({
    distanceInKm: deliveryDistance ?? 99_999,
    orderValue:   totalAmount.toNumber(),
    weightInKg:   shippingWeightKg,
    city:         shippingAddress.city,
    state:        shippingAddress.state,
  });
  const deliveryCharge         = new Prisma.Decimal(deliveryResult.charge);
  const calculatedDeliveryType = deliveryResult.type === "FREE" ? "FREE" : "PAID";

  // Structured shipping details stored with the order for audit / display purposes
  const shippingDetails = {
    zone:        deliveryResult.zone     ?? "Unknown",
    weightKg:    shippingWeightKg,
    ratePerKg:   deliveryResult.breakdown.rate ?? 0,
    totalCharge: deliveryResult.charge,
    type:        deliveryResult.type,
  };

  // ── Coupon ─────────────────────────────────────────────────────────────
  // Re-validated here (not trusted from an earlier /coupons/validate preview call)
  // so a stale, expired, or since-exhausted code can't be smuggled into an order.
  let appliedCoupon: Awaited<ReturnType<typeof validateCoupon>>["coupon"] | undefined;
  let couponDiscount = new Prisma.Decimal(0);
  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, totalAmount.toNumber(), userId);
    appliedCoupon = couponResult.coupon;
    couponDiscount = new Prisma.Decimal(couponResult.discount);
  }

  // Calculate prepaid discount
  let prepaidDiscount = new Prisma.Decimal(0);
  if (paymentMethod === "ONLINE") {
    prepaidDiscount = new Prisma.Decimal(await ShippingService.calculatePrepaidDiscount(totalAmount.toNumber()));
  }

  const discountAmount = couponDiscount.plus(prepaidDiscount);
  const finalAmount = totalAmount.plus(deliveryCharge).minus(discountAmount);

  let razorpayOrder: any = null;
  if (paymentMethod === "ONLINE") {
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: Math.round(finalAmount.mul(100).toNumber()),
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      });
    } catch (err: any) {
      logger.error(
        { err: err?.message ?? err, statusCode: err?.statusCode, description: err?.error?.description },
        "[RAZORPAY] Order creation failed",
      );
      throw new AppError(
        "Online payment is not available right now. Please use Cash on Delivery.",
        400,
        "PAYMENT_GATEWAY_ERROR",
      );
    }
  }

  const invNum = generateInvoiceNumber();

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
        couponCode: appliedCoupon?.code ?? null,
        deliveryType: calculatedDeliveryType,
        deliveryDistance,
        customerLatitude,
        customerLongitude,
        calculationMethod,
        storeLocation: STORE_LOCATION,
        shippingDetails,
        invoiceNumber: invNum,
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
      const updated = await tx.book.updateMany({
        where: { id: item.bookId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (updated.count === 0) {
        throw new AppError(`Insufficient stock for "${item.book.title}"`, 400, "INSUFFICIENT_STOCK");
      }
    }

    if (appliedCoupon) {
      // Guarded by usedCount < maxUses (re-checked here, not just at the earlier
      // validateCoupon call) so two concurrent orders can't both slip through on
      // the coupon's last remaining use.
      const couponUpdate = await tx.coupon.updateMany({
        where: {
          id: appliedCoupon.id,
          ...(appliedCoupon.maxUses != null ? { usedCount: { lt: appliedCoupon.maxUses } } : {}),
        },
        data: { usedCount: { increment: 1 } },
      });
      if (couponUpdate.count === 0) {
        throw new AppError("Coupon usage limit reached", 400, "COUPON_LIMIT_REACHED");
      }
      // Unique([couponId, userId]) constraint is the real guard against a
      // concurrent double-submit both passing the earlier alreadyUsed check;
      // this catches that race instead of letting the same coupon apply twice.
      try {
        await tx.couponUse.create({
          data: { couponId: appliedCoupon.id, userId, orderId: order.id },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new AppError("You have already used this coupon", 400, "COUPON_ALREADY_USED");
        }
        throw err;
      }
    }

    // For COD orders the payment is final at this point — clear cart immediately.
    // For ONLINE orders the payment is still pending; cart is cleared only after
    // Razorpay payment verification succeeds (see payments.service.ts).
    if (paymentMethod === "COD") {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

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
      total: Number(finalAmount),
      deliveryCharge: Number(deliveryCharge),
      discount: Number(discountAmount),
      paymentMethod: "COD",
      shippingAddress,
      createdAt: result.createdAt.toISOString(),
      customerEmail,
      invoiceNumber: invNum,
    };
    sendAdminOrderNotification(orderData).catch(() => {});
    sendInvoiceNotification({
      orderId:       result.id,
      orderType:     "BOOK",
      customerName:  shippingAddress.name,
      customerEmail,
      total:         Number(finalAmount),
      paymentMethod: "COD",
    }).catch(() => {});
    if (customerEmail) {
      const sendWithPdf = async () => {
        try {
          const pdfBuffer = await generateInvoicePdf({
            invoiceNumber: invNum,
            orderId:       result.id,
            createdAt:     result.createdAt,
            customerName:  shippingAddress.name,
            customerEmail,
            shippingAddress,
            items: result.items.map((i) => ({
              name:        i.book.title,
              quantity:    i.quantity,
              unitPrice:   Number(i.priceAtPurchase),
              bindingType: (i as any).bindingType ?? "NONE",
              bindingExtra: Number((i as any).bindingExtra ?? 0),
            })),
            subtotal:      Number(totalAmount),
            deliveryCharge: Number(deliveryCharge),
            discount:      Number(discountAmount),
            total:         Number(finalAmount),
            paymentMethod: "COD",
          });
          await sendOrderInvoice(customerEmail, orderData, pdfBuffer);
          await prisma.order.update({
            where: { id: result.id },
            data:  { invoiceSent: true, invoiceSentAt: new Date() },
          });
        } catch (err) {
          logger.error({ err: (err as Error).message, orderId: result.id }, "[INVOICE] COD invoice failed");
        }
      };
      sendWithPdf().catch(() => {});
    }
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

  const payment = order.payment;
  // Money only actually moved for a captured online payment — COD orders and
  // ONLINE orders that never completed checkout (payment still PENDING) have
  // nothing to refund.
  const needsRefund = !!payment && payment.method === "ONLINE" && payment.status === "SUCCESS" && !!payment.razorpayPaymentId;

  let refundId: string | undefined;
  let refundStatus: string | undefined;

  // Refund is called BEFORE the DB transaction, and any failure throws here —
  // the DB is never touched in that case, so the order stays CONFIRMED/paid
  // instead of being marked cancelled while the customer's money is still stuck.
  if (needsRefund) {
    try {
      const refund = await razorpay.payments.refund(payment!.razorpayPaymentId!, {
        amount: Math.round(Number(payment!.amount) * 100),
      });
      if (refund.status === "failed") {
        throw new Error(`Razorpay returned refund status "failed" for refund ${refund.id}`);
      }
      refundId = refund.id;
      refundStatus = refund.status;
      logger.info({ orderId, paymentId: payment!.id, refundId, refundStatus }, "[ORDERS] Razorpay refund initiated for cancelled order");
    } catch (err: any) {
      logger.error(
        { err: err?.message ?? err, orderId, razorpayPaymentId: payment!.razorpayPaymentId },
        "[ORDERS] Razorpay refund failed — order left CONFIRMED, not cancelled",
      );
      throw new AppError(
        "Refund could not be initiated. The order has not been cancelled — please try again or contact support.",
        502,
        "REFUND_FAILED",
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.book.update({ where: { id: item.bookId }, data: { stock: { increment: item.quantity } } });
    }
    await tx.payment.updateMany({
      where: { orderId },
      data: needsRefund
        ? { status: "REFUNDED", razorpayRefundId: refundId, refundStatus, refundedAt: new Date() }
        : { status: "FAILED" },
    });
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
  if (!order.adminSeen) {
    prisma.order.update({ where: { id: orderId }, data: { adminSeen: true } }).catch(() => {});
  }
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

export const resendOrderInvoice = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user:    { select: { name: true, email: true } },
      items:   { include: { book: { select: { id: true, title: true, author: true, coverImageUrl: true } } } },
      payment: true,
    },
  });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");

  const recipient = (order as any).customerEmail ?? order.user?.email;
  if (!recipient) throw new AppError("No customer email on this order", 400, "NO_EMAIL");

  const invNum = (order as any).invoiceNumber ?? generateInvoiceNumber();
  const shippingAddress: any = order.shippingAddress ?? {};

  const finalAmount    = Number((order as any).finalAmount ?? order.totalAmount);
  const deliveryCharge = Number((order as any).deliveryCharge ?? 0);
  const discount       = Number((order as any).discountAmount ?? 0);
  const subtotal       = Number(order.totalAmount);

  const pdfBuffer = await generateInvoicePdf({
    invoiceNumber:  invNum,
    orderId:        order.id,
    createdAt:      order.createdAt,
    customerName:   shippingAddress.name ?? order.user?.name ?? "Customer",
    customerEmail:  recipient,
    shippingAddress,
    items: (order.items as any[]).map((i) => ({
      name:         i.book.title,
      quantity:     i.quantity,
      unitPrice:    Number(i.priceAtPurchase),
      bindingType:  i.bindingType ?? "NONE",
      bindingExtra: Number(i.bindingExtra ?? 0),
    })),
    subtotal,
    deliveryCharge,
    discount,
    total:         finalAmount,
    paymentMethod: (order as any).paymentMethod ?? "ONLINE",
  });

  const orderData = {
    orderId:       order.id,
    items: (order.items as any[]).map((i) => ({
      title:        i.book.title,
      quantity:     i.quantity,
      price:        Number(i.priceAtPurchase),
      bindingType:  i.bindingType ?? "NONE",
      bindingExtra: Number(i.bindingExtra ?? 0),
    })),
    total:         finalAmount,
    deliveryCharge,
    discount,
    paymentMethod: (order as any).paymentMethod ?? "ONLINE",
    shippingAddress,
    createdAt:     order.createdAt.toISOString(),
    customerEmail: recipient,
    invoiceNumber: invNum,
  };

  await sendOrderInvoice(recipient, orderData, pdfBuffer);

  return prisma.order.update({
    where: { id: orderId },
    data:  { invoiceNumber: invNum, invoiceSent: true, invoiceSentAt: new Date() },
  });
};
