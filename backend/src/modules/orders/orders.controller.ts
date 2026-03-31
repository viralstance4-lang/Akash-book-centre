import { type RequestHandler } from "express";
import AppError from "../../lib/AppError";
import {
  getAdminOrderById,
  getAdminOrders,
  cancelOrder as cancelOrderService,
  getOrderById,
  getUserOrders,
  placeOrder as placeOrderService,
  requestReturn as requestReturnService,
  updateOrderStatus as updateOrderStatusService,
} from "./orders.service";

const getUserIdOrThrow = (userId?: string) => {
  if (!userId) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  return userId;
};

export const placeOrder: RequestHandler = async (req, res, next) => {
  try {
    const { shippingAddress, paymentMethod, customerEmail } = req.body;
    const order = await placeOrderService(
      getUserIdOrThrow(req.user?.id),
      shippingAddress,
      paymentMethod ?? "ONLINE",
      customerEmail,
    );
    res.status(201).json({ success: true, message: "Order placed successfully", data: order });
  } catch (error) { next(error); }
};

export const getOrders: RequestHandler = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const orders = await getUserOrders(getUserIdOrThrow(req.user?.id), page, limit);
    res.status(200).json({ success: true, message: "Orders fetched successfully", data: orders });
  } catch (error) { next(error); }
};

export const getOrder: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const order = await getOrderById(getUserIdOrThrow(req.user?.id), req.params.id);
    res.status(200).json({ success: true, message: "Order fetched successfully", data: order });
  } catch (error) { next(error); }
};

export const cancelOrder: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const order = await cancelOrderService(getUserIdOrThrow(req.user?.id), req.params.id);
    res.status(200).json({ success: true, message: "Order cancelled successfully", data: order });
  } catch (error) { next(error); }
};

export const requestReturn: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const order = await requestReturnService(getUserIdOrThrow(req.user?.id), req.params.id);
    res.status(200).json({ success: true, message: "Return requested successfully", data: order });
  } catch (error) { next(error); }
};

export const getAdminOrdersList: RequestHandler = async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const dateFrom = typeof req.query.dateFrom === "string" ? new Date(req.query.dateFrom) : undefined;
    const dateTo = typeof req.query.dateTo === "string" ? new Date(req.query.dateTo) : undefined;
    const orders = await getAdminOrders(page, limit, status as any, userId,
      dateFrom && !Number.isNaN(dateFrom.getTime()) ? dateFrom : undefined,
      dateTo && !Number.isNaN(dateTo.getTime()) ? dateTo : undefined,
    );
    res.status(200).json({ success: true, message: "Admin orders fetched successfully", data: orders });
  } catch (error) { next(error); }
};

export const getAdminOrder: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const order = await getAdminOrderById(req.params.id);
    res.status(200).json({ success: true, message: "Admin order fetched successfully", data: order });
  } catch (error) { next(error); }
};

export const updateAdminOrderStatus: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const order = await updateOrderStatusService(req.params.id, req.body.status);
    res.status(200).json({ success: true, message: "Order status updated successfully", data: order });
  } catch (error) { next(error); }
};
