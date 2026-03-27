import { type RequestHandler } from "express";

import AppError from "../../lib/AppError";
import { verifyPayment as verifyPaymentService } from "./payments.service";

const getUserIdOrThrow = (userId?: string) => {
  if (!userId) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }

  return userId;
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
