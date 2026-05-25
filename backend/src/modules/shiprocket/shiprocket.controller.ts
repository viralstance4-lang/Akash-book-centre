import { type RequestHandler } from "express";
import env from "../../config/env";
import logger from "../../config/logger";
import * as ShiprocketService from "./shiprocket.service";

// ── Admin: Create Shipment ────────────────────────────────────────────────────

export const createShipment: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const order = await ShiprocketService.createShipment(req.params.orderId);
    res.status(201).json({ success: true, message: "Shipment created in Shiprocket", data: order });
  } catch (error) { next(error); }
};

// ── Admin: Generate AWB ───────────────────────────────────────────────────────

export const generateAWB: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const order = await ShiprocketService.generateAWB(req.params.orderId);
    res.json({ success: true, message: "AWB generated successfully", data: order });
  } catch (error) { next(error); }
};

// ── Admin: Generate Shipping Label ────────────────────────────────────────────

export const generateLabel: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const result = await ShiprocketService.generateLabel(req.params.orderId);
    res.json({ success: true, message: "Label generated", data: result });
  } catch (error) { next(error); }
};

// ── Admin: Generate Shipping Invoice (Shiprocket invoice) ─────────────────────

export const generateInvoice: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const result = await ShiprocketService.generateShippingInvoice(req.params.orderId);
    res.json({ success: true, message: "Invoice generated", data: result });
  } catch (error) { next(error); }
};

// ── Admin: Generate Manifest ──────────────────────────────────────────────────

export const generateManifest: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const result = await ShiprocketService.generateManifest(req.params.orderId);
    res.json({ success: true, message: "Manifest generated", data: result });
  } catch (error) { next(error); }
};

// ── Admin: Track Shipment ─────────────────────────────────────────────────────

export const trackShipment: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const data = await ShiprocketService.trackShipment(req.params.orderId);
    res.json({ success: true, message: "Tracking data fetched", data });
  } catch (error) { next(error); }
};

// ── Admin: Cancel Shipment ────────────────────────────────────────────────────

export const cancelShipment: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const result = await ShiprocketService.cancelShipment(req.params.orderId);
    res.json({ success: true, message: "Shipment cancelled", data: result });
  } catch (error) { next(error); }
};

// ── Admin: Sync Status from Shiprocket ────────────────────────────────────────

export const syncStatus: RequestHandler<{ orderId: string }> = async (req, res, next) => {
  try {
    const result = await ShiprocketService.syncStatus(req.params.orderId);
    res.json({ success: true, message: "Status synced from Shiprocket", data: result });
  } catch (error) { next(error); }
};

// ── Admin: Fetch Pickup Locations ─────────────────────────────────────────────

export const getPickupLocations: RequestHandler = async (_req, res, next) => {
  try {
    const locations = await ShiprocketService.getPickupLocations();
    res.json({ success: true, message: "Pickup locations fetched", data: locations });
  } catch (error) { next(error); }
};

// ── Admin: Test Auth (diagnostic) ────────────────────────────────────────────

export const testAuthHandler: RequestHandler = async (_req, res, next) => {
  try {
    const result = await ShiprocketService.testAuth();
    res.status(result.ok ? 200 : 502).json({ success: result.ok, message: result.message });
  } catch (error) { next(error); }
};

// ── Public: Webhook ───────────────────────────────────────────────────────────

export const handleWebhook: RequestHandler = async (req, res, next) => {
  try {
    // Optional token-based security: check ?token=<SHIPROCKET_WEBHOOK_TOKEN>
    if (env.SHIPROCKET_WEBHOOK_TOKEN) {
      const supplied = (req.query.token as string | undefined) ??
        req.headers["x-shiprocket-token"] as string | undefined;
      if (supplied !== env.SHIPROCKET_WEBHOOK_TOKEN) {
        res.status(401).json({ success: false, message: "Unauthorized webhook" });
        return;
      }
    }

    const payload = req.body as Record<string, unknown>;
    logger.info({ awb: payload.awb, status: payload.current_status }, "Shiprocket webhook received");

    // Process asynchronously — respond immediately so Shiprocket doesn't retry
    void ShiprocketService.processWebhook(payload).catch((err) =>
      logger.error({ err }, "Shiprocket webhook processing error"),
    );

    res.status(200).json({ success: true, message: "Webhook received" });
  } catch (error) { next(error); }
};
