import { NextFunction, Request, Response } from "express";
import { ShippingService } from "./shipping.service";
import type { CalculateShippingInput, UpdateShippingConfigInput } from "./shipping.schema";

// ─── Public ──────────────────────────────────────────────────────────────────

/** GET /api/v1/shipping/config */
export async function getPublicShippingConfig(_req: Request, res: Response, next: NextFunction) {
  try {
    const row = await ShippingService.getShippingSettings();
    res.json({
      isShippingEnabled:     row.isShippingEnabled,
      distanceThreshold:     Number(row.distanceThreshold),
      perKmRate:             Number(row.perKmRate),
      freeDeliveryThreshold: Number(row.freeDeliveryThreshold),
      // Regional zone rates — used by checkout page for zone-based estimate
      localZoneRate:         Number(row.localZoneRate),
      northEastRate:         Number(row.northEastRate),
      defaultKgRate:         Number(row.defaultKgRate),
      // Legacy fields — still used by checkout page for prepaid discount
      prepaidDiscountType:   row.prepaidDiscountType,
      prepaidDiscountValue:  Number(row.prepaidDiscountValue),
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/shipping/calculate
 *  Body: { distanceInKm, orderValue, weightInKg, state?, city? }
 */
export async function calculateShipping(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CalculateShippingInput;
    const result = await ShippingService.calculateDeliveryCharge(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Admin ───────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/shipping/config */
export async function getAdminShippingConfig(_req: Request, res: Response, next: NextFunction) {
  try {
    const row = await ShippingService.getShippingSettings();
    res.json({
      id:                    row.id,
      isShippingEnabled:     row.isShippingEnabled,
      distanceThreshold:     Number(row.distanceThreshold),
      perKmRate:             Number(row.perKmRate),
      freeDeliveryThreshold: Number(row.freeDeliveryThreshold),
      defaultKgRate:         Number(row.defaultKgRate),
      localZoneRate:         Number(row.localZoneRate),
      northEastRate:         Number(row.northEastRate),
      stateRates:            row.stateRates,
      updatedAt:             row.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/admin/shipping/config
 *  Body: Partial<ShippingConfig> — only send fields you want to update
 */
export async function updateAdminShippingConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.body as UpdateShippingConfigInput;
    const row  = await ShippingService.updateShippingSettings(data);
    res.json({
      id:                    row.id,
      isShippingEnabled:     row.isShippingEnabled,
      distanceThreshold:     Number(row.distanceThreshold),
      perKmRate:             Number(row.perKmRate),
      freeDeliveryThreshold: Number(row.freeDeliveryThreshold),
      defaultKgRate:         Number(row.defaultKgRate),
      localZoneRate:         Number(row.localZoneRate),
      northEastRate:         Number(row.northEastRate),
      stateRates:            row.stateRates,
      updatedAt:             row.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/admin/shipping/calculate
 *  Admin test endpoint — calculate shipping without placing an order.
 *  Body: { distanceInKm, orderValue, weightInKg, state?, city? }
 */
export async function adminTestCalculation(req: Request, res: Response, next: NextFunction) {
  try {
    const input  = req.body as CalculateShippingInput;
    const result = await ShippingService.calculateDeliveryCharge(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
