import crypto from "crypto";
import { type RequestHandler } from "express";

import AppError from "../../lib/AppError";
import env from "../../config/env";
import logger from "../../config/logger";
import { verifyPayment as verifyPaymentService, confirmCapturedPayment } from "./payments.service";
import prisma from "../../lib/prisma";

const getUserIdOrThrow = (userId?: string) => {
  if (!userId) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }

  return userId;
};

// Razorpay sends raw body — must be parsed as Buffer for signature verification
export const handleWebhook: RequestHandler = async (req, res) => {
  const secret    = env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  const rawBody   = (req as any).rawBody as Buffer | undefined;

  if (!secret) {
    logger.error("[WEBHOOK] RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook");
    res.status(401).json({ success: false, message: "Webhook not configured" });
    return;
  }

  if (!signature || !rawBody) {
    logger.warn("[WEBHOOK] Missing signature or raw body — rejected");
    res.status(401).json({ success: false, message: "Missing signature" });
    return;
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected !== signature) {
    logger.warn("[WEBHOOK] Razorpay signature mismatch — rejected");
    res.status(401).json({ success: false, message: "Invalid signature" });
    return;
  }

  const event   = req.body?.event as string | undefined;
  const payload = req.body?.payload;

  logger.info({ event }, "[WEBHOOK] Razorpay event received");

  if (event === "payment.captured") {
    const paymentEntity = payload?.payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id as string | undefined;
    const razorpayPaymentId = paymentEntity?.id as string | undefined;
    if (razorpayOrderId && razorpayPaymentId) {
      try {
        await confirmCapturedPayment(razorpayOrderId, razorpayPaymentId);
      } catch (err) {
        logger.error({ err, razorpayOrderId }, "[WEBHOOK] Failed to confirm order for payment.captured");
      }
    } else {
      logger.warn({ event }, "[WEBHOOK] payment.captured missing order_id/payment id");
    }
  } else if (event === "payment.failed") {
    const paymentEntity = payload?.payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id as string | undefined;
    if (razorpayOrderId) {
      try {
        await prisma.payment.updateMany({
          where: { razorpayOrderId, status: "PENDING" },
          data:  { status: "FAILED" },
        });
        logger.info({ razorpayOrderId }, "[WEBHOOK] Marked payment FAILED via webhook");
      } catch (err) {
        logger.error({ err, razorpayOrderId }, "[WEBHOOK] Failed to update payment status");
      }
    }
  }

  // Always 200 — Razorpay retries on non-2xx
  res.status(200).json({ success: true });
};

export const verifyPayment: RequestHandler = async (req, res, next) => {
  try {
    const order = await verifyPaymentService(
      getUserIdOrThrow(req.user?.id),
      req.body.razorpayOrderId,
      req.body.razorpayPaymentId,
      req.body.razorpaySignature,
    );

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
