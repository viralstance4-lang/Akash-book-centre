import { z } from "zod";

export const stateRateSchema = z.object({
  state: z.string().min(1, "State name required").max(100).trim(),
  rate:  z.number().positive("Rate must be positive").max(100_000),
});

export const updateShippingConfigSchema = z.object({
  isShippingEnabled:     z.boolean().optional(),
  distanceThreshold:     z.number().min(0).max(500).optional(),
  perKmRate:             z.number().min(0).max(100_000).optional(),
  freeDeliveryThreshold: z.number().min(0).max(1_000_000).optional(),
  defaultKgRate:         z.number().positive().max(100_000).optional(),  // All India
  localZoneRate:         z.number().positive().max(100_000).optional(),  // Delhi NCR
  northEastRate:         z.number().positive().max(100_000).optional(),  // North East
  localZoneAreaCharge:   z.number().min(0).max(100_000).optional(),      // flat area fee Delhi NCR
  northEastAreaCharge:   z.number().min(0).max(100_000).optional(),      // flat area fee North East
  defaultAreaCharge:     z.number().min(0).max(100_000).optional(),      // flat area fee All India
  stateRates:            z.array(stateRateSchema).max(100).optional(),
});

export const calculateShippingSchema = z.object({
  distanceInKm: z.number().min(0, "Distance cannot be negative").max(20_000),
  orderValue:   z.number().min(0, "Order value cannot be negative"),
  weightInKg:   z.number().min(0, "Weight cannot be negative").max(10_000),
  state:        z.string().trim().optional(),
  city:         z.string().trim().optional(),
});

export type UpdateShippingConfigInput = z.infer<typeof updateShippingConfigSchema>;
export type CalculateShippingInput    = z.infer<typeof calculateShippingSchema>;
export type StateRate                 = z.infer<typeof stateRateSchema>;
