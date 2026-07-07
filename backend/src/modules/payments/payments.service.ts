import crypto from "crypto";

import env from "../../config/env";
import AppError from "../../lib/AppError";
import logger from "../../config/logger";
import { sendAdminOrderNotification, sendInvoiceNotification, sendOrderInvoice } from "../../lib/email";
import { generateInvoicePdf } from "../../lib/invoice";
import prisma from "../../lib/prisma";

export const verifyPayment = async (
  userId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
) => {
  const payment = await prisma.payment.findFirst({
    where: {
      razorpayOrderId,
    },
    include: {
      order: {
        include: {
          items: {
            include: {
              book: {
                select: {
                  id: true,
                  title: true,
                  author: true,
                  coverImageUrl: true,
                  stock: true,
                },
              },
            },
          },
          payment: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError("Payment not found", 404, "PAYMENT_NOT_FOUND");
  }

  if (payment.order.userId !== userId) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "FAILED",
          razorpayPaymentId,
          razorpaySignature,
        },
      });

      if (payment.order.status !== "CANCELLED") {
        for (const item of payment.order.items) {
          await tx.book.update({
            where: {
              id: item.bookId,
            },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }

        await tx.order.update({
          where: {
            id: payment.orderId,
          },
          data: {
            status: "CANCELLED",
          },
        });
      }
    });

    throw new AppError(
      "Payment verification failed",
      400,
      "PAYMENT_VERIFICATION_FAILED",
    );
  }

  const [, updatedOrder] = await prisma.$transaction([
    prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: "SUCCESS",
        razorpayPaymentId,
        razorpaySignature,
      },
    }),
    prisma.order.update({
      where: {
        id: payment.orderId,
      },
      data: {
        status: "CONFIRMED",
      },
      include: {
        items: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                author: true,
                coverImageUrl: true,
                stock: true,
              },
            },
          },
        },
        payment: true,
      },
    }),
  ]);

  // Send invoice emails after successful payment
  const customerEmail   = (updatedOrder as any).customerEmail ?? undefined;
  const shippingAddress = (updatedOrder as any).shippingAddress ?? {};
  const invNum          = (updatedOrder as any).invoiceNumber as string | undefined;
  const finalAmt        = Number(updatedOrder.payment?.amount ?? 0);
  const subtotal        = Number((updatedOrder as any).totalAmount ?? finalAmt);
  const deliveryCharge  = Number((updatedOrder as any).deliveryCharge ?? 0);
  const discount        = Number((updatedOrder as any).discountAmount ?? 0);

  const orderData = {
    orderId:       updatedOrder.id,
    items: updatedOrder.items.map((i) => ({
      title:        i.book.title,
      quantity:     i.quantity,
      price:        Number(i.priceAtPurchase),
      bindingType:  (i as any).bindingType  ?? "NONE",
      bindingExtra: Number((i as any).bindingExtra ?? 0),
    })),
    total:         finalAmt,
    deliveryCharge,
    discount,
    paymentMethod: "ONLINE",
    shippingAddress,
    createdAt:     updatedOrder.createdAt.toISOString(),
    customerEmail,
    invoiceNumber: invNum,
  };

  // Payment confirmed — now safe to clear the cart
  prisma.cart.findUnique({ where: { userId } })
    .then((cart) => cart ? prisma.cartItem.deleteMany({ where: { cartId: cart.id } }) : null)
    .catch(() => {});

  sendAdminOrderNotification(orderData).catch(() => {});
  sendInvoiceNotification({
    orderId:       updatedOrder.id,
    orderType:     "BOOK",
    customerName:  shippingAddress.name ?? "Customer",
    customerEmail,
    total:         finalAmt,
    paymentMethod: "ONLINE",
  }).catch(() => {});

  if (customerEmail) {
    const sendWithPdf = async () => {
      try {
        const pdfBuffer = invNum ? await generateInvoicePdf({
          invoiceNumber:  invNum,
          orderId:        updatedOrder.id,
          createdAt:      updatedOrder.createdAt,
          customerName:   shippingAddress.name ?? "Customer",
          customerEmail,
          shippingAddress,
          items: updatedOrder.items.map((i) => ({
            name:         i.book.title,
            quantity:     i.quantity,
            unitPrice:    Number(i.priceAtPurchase),
            bindingType:  (i as any).bindingType  ?? "NONE",
            bindingExtra: Number((i as any).bindingExtra ?? 0),
          })),
          subtotal,
          deliveryCharge,
          discount,
          total:         finalAmt,
          paymentMethod: "ONLINE",
        }) : undefined;
        await sendOrderInvoice(customerEmail, orderData, pdfBuffer);
        await prisma.order.update({
          where: { id: updatedOrder.id },
          data:  { invoiceSent: true, invoiceSentAt: new Date() },
        });
      } catch (err) {
        logger.error({ err: (err as Error).message, orderId: updatedOrder.id }, "[INVOICE] Online order invoice failed");
      }
    };
    sendWithPdf().catch(() => {});
  }

  return updatedOrder;
};
