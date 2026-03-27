import type { Request, Response, NextFunction } from "express";
import * as printService from "./printorders.service";
import { createPrintOrderSchema, createPrintSettingsSchema } from "./printorders.schema";

export const getPrintSettings = async (req: Request, res: Response, next: NextFunction) => {
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
    const data = createPrintOrderSchema.parse(req.body);
    const file = req.file as any;
    const order = await printService.createPrintOrder(userId, data, file);
    res.status(201).json({ success: true, message: "Print order created", data: order });
  } catch (err) { next(err); }
};

export const getUserPrintOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const orders = await printService.getUserPrintOrders(userId);
    res.json({ success: true, message: "Orders fetched", data: orders });
  } catch (err) { next(err); }
};

export const getAllPrintOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await printService.getAllPrintOrders();
    res.json({ success: true, message: "Orders fetched", data: orders });
  } catch (err) { next(err); }
};

export const updatePrintOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params["id"] as string;
    const { status } = req.body;
    const order = await printService.updatePrintOrderStatus(id, status);
    res.json({ success: true, message: "Status updated", data: order });
  } catch (err) { next(err); }
};
