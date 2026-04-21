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

export const createPrintOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    console.log(`[PRINT ORDER] Incoming request from user ${userId}:`, {
      body:  { ...req.body, filePageCounts: req.body.filePageCounts, fileCopies: req.body.fileCopies },
      files: Array.isArray(req.files) ? req.files.map((f) => ({ name: f.originalname, size: f.size })) : [],
    });
    const data   = createPrintOrderSchema.parse(req.body);
    // Accept either multiple files (new flow) or single file (legacy)
    const files  = (req.files as Express.Multer.File[] | undefined)
      ?? (req.file ? [req.file] : []);
    const order  = await printService.createPrintOrder(userId, data, files);
    console.log(`[PRINT ORDER] Order created successfully: #${order.id.slice(0, 8).toUpperCase()}`);
    res.status(201).json({ success: true, message: "Print order placed successfully", data: order });
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
