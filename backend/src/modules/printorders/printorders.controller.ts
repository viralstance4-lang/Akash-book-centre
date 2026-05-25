import type { Request, Response, NextFunction } from "express";
import * as printService from "./printorders.service";
import { createPrintOrderSchema, createPrintSettingsSchema } from "./printorders.schema";

export const getPrintSettings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await printService.getPrintSettings();
    res.json({ success: true, message: "Settings fetched", data: settings });
  } catch (err) { next(err); }
};

export const upsertPrintSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createPrintSettingsSchema.parse(req.body);
    const settings = await printService.upsertPrintSettings(data);
    res.json({ success: true, message: "Settings updated", data: settings });
  } catch (err) { next(err); }
};

// Phase 1: upload PDFs + create pending order + create Razorpay order
export const createPrintOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const data   = createPrintOrderSchema.parse(req.body);
    const files  = (req.files as Express.Multer.File[] | undefined)
      ?? (req.file ? [req.file] : []);
    const result = await printService.createPrintOrder(userId, data, files);
    res.status(201).json({ success: true, message: "Print order initiated", data: result });
  } catch (err) { next(err); }
};

// Phase 2: verify Razorpay signature + confirm order + send emails
export const verifyPrintPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId       = req.user!.id;
    const printOrderId = req.params["id"] as string;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body as {
      razorpayOrderId:   string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    };

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      res.status(400).json({ success: false, message: "Missing payment fields", code: "MISSING_PAYMENT_FIELDS" });
      return;
    }

    const order = await printService.verifyPrintOrderPayment(
      userId,
      printOrderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );

    res.json({ success: true, message: "Payment verified. Order confirmed.", data: order });
  } catch (err) { next(err); }
};

export const getUserPrintOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await printService.getUserPrintOrders(req.user!.id);
    res.json({ success: true, message: "Orders fetched", data: orders });
  } catch (err) { next(err); }
};

export const getAllPrintOrders = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await printService.getAllPrintOrders();
    res.json({ success: true, message: "Orders fetched", data: orders });
  } catch (err) { next(err); }
};

export const updatePrintOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id     = req.params["id"] as string;
    const { status } = req.body as { status: string };
    const order  = await printService.updatePrintOrderStatus(id, status);
    res.json({ success: true, message: "Status updated", data: order });
  } catch (err) { next(err); }
};

export const deletePrintOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params["id"] as string;
    await printService.deletePrintOrder(id);
    res.json({ success: true, message: "Print order deleted" });
  } catch (err) { next(err); }
};

export const resendPrintInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id    = req.params["id"] as string;
    const order = await printService.resendPrintInvoice(id);
    res.json({ success: true, message: "Invoice sent successfully", data: order });
  } catch (err) { next(err); }
};
