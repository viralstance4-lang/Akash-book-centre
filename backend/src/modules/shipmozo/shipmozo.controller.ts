import { type RequestHandler } from "express";
import * as ShipmozoService from "./shipmozo.service";

export const createShipment: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const order = await ShipmozoService.createShipment(req.params.orderId);
    res.status(201).json({ success: true, message: "Shipment created in Shipmozo", data: order });
  } catch (error) { next(error); }
};

export const assignCourier: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const order = await ShipmozoService.assignCourier(req.params.orderId);
    res.json({ success: true, message: "Courier assigned and AWB generated", data: order });
  } catch (error) { next(error); }
};

export const getLabel: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const result = await ShipmozoService.getLabel(req.params.orderId);
    res.json({ success: true, message: "Label fetched", data: result });
  } catch (error) { next(error); }
};

export const generateManifest: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const result = await ShipmozoService.generateManifest(req.params.orderId);
    res.json({ success: true, message: "Manifest generated", data: result });
  } catch (error) { next(error); }
};

export const trackShipment: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const data = await ShipmozoService.trackShipment(req.params.orderId);
    res.json({ success: true, message: "Tracking data fetched", data });
  } catch (error) { next(error); }
};

export const cancelShipment: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const result = await ShipmozoService.cancelShipment(req.params.orderId);
    res.json({ success: true, message: "Shipment cancelled", data: result });
  } catch (error) { next(error); }
};

export const checkServiceability: RequestHandler = async (req, res, next) => {
  try {
    const pincode = (req.query.pincode as string | undefined) ?? (req.body.pincode as string | undefined);
    if (!pincode) {
      res.status(400).json({ success: false, message: "pincode is required" });
      return;
    }
    const result = await ShipmozoService.checkServiceability(pincode);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

export const testConnection: RequestHandler = async (_req, res, next) => {
  try {
    const result = await ShipmozoService.testConnection();
    res.status(result.ok ? 200 : 502).json({ success: result.ok, message: result.message });
  } catch (error) { next(error); }
};
