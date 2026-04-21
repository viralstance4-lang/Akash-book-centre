import { type RequestHandler } from "express";
import AppError from "../../lib/AppError";
import {
  createReturnRequest as createReturnRequestService,
  getUserReturns as getUserReturnsService,
  getAdminReturns as getAdminReturnsService,
  getReturnById as getReturnByIdService,
  updateReturnStatus as updateReturnStatusService,
} from "./returns.service";

const getUserIdOrThrow = (userId?: string) => {
  if (!userId) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  return userId;
};

export const createReturn: RequestHandler = async (req, res, next) => {
  try {
    const { email, orderId, reason } = req.body;
    const userId = getUserIdOrThrow(req.user?.id);
    console.log(`[RETURNS] Create request | userId=${userId} orderId=${orderId} email=${email}`);
    const returnRequest = await createReturnRequestService(orderId, userId, email, reason);
    console.log(`[RETURNS] Created #${returnRequest.id.slice(0, 8).toUpperCase()} for order ${orderId}`);
    res.status(201).json({
      success: true,
      message: "Return request created successfully. Your return is under verification.",
      data: returnRequest,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserReturns: RequestHandler = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const returns = await getUserReturnsService(getUserIdOrThrow(req.user?.id), page, limit);
    res.status(200).json({ success: true, message: "Returns fetched successfully", data: returns });
  } catch (error) {
    next(error);
  }
};

export const getReturn: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const returnRequest = await getReturnByIdService(req.params.id);

    // Verify user owns this return
    if (returnRequest.userId !== req.user?.id) {
      throw new AppError("You don't have permission to view this return", 403, "PERMISSION_DENIED");
    }

    res.status(200).json({ success: true, message: "Return fetched successfully", data: returnRequest });
  } catch (error) {
    next(error);
  }
};

export const getAdminReturns: RequestHandler = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const status = req.query.status as string | undefined;
    console.log(`[RETURNS] Admin list | page=${page} limit=${limit} status=${status ?? "all"}`);
    const returns = await getAdminReturnsService(page, limit, status);
    res.status(200).json({ success: true, message: "Admin returns fetched successfully", data: returns });
  } catch (error) {
    next(error);
  }
};

export const getAdminReturnDetail: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const returnRequest = await getReturnByIdService(req.params.id);
    res.status(200).json({ success: true, message: "Return detail fetched successfully", data: returnRequest });
  } catch (error) {
    next(error);
  }
};

export const updateReturnStatus: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    console.log(`[RETURNS] Status update | returnId=${id} newStatus=${status} adminId=${req.user?.id}`);
    const updatedReturn = await updateReturnStatusService(id, status);
    console.log(`[RETURNS] Status updated | returnId=${id} status=${status}`);
    res.status(200).json({
      success: true,
      message: `Return status updated to ${status}`,
      data: updatedReturn,
    });
  } catch (error) {
    next(error);
  }
};
