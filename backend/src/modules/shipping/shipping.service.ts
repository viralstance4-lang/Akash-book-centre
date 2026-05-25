import prisma from "../../lib/prisma";
import type { StateRate, UpdateShippingConfigInput } from "./shipping.schema";

// ─── Domain types ────────────────────────────────────────────────────────────

export interface ShippingConfig {
  isShippingEnabled:     boolean;
  distanceThreshold:     number;   // km
  perKmRate:             number;   // ₹ per km
  freeDeliveryThreshold: number;   // order value above which local delivery is free
  defaultKgRate:         number;   // ₹ per kg (fallback when state not found)
  stateRates:            StateRate[];
}

export interface ShippingInput {
  distanceInKm: number;
  orderValue:   number;
  weightInKg:   number;
  state?:       string;
}

export type ShippingType = "FREE" | "DISTANCE_BASED" | "WEIGHT_BASED" | "DISABLED";

export interface ShippingResult {
  charge:    number;
  type:      ShippingType;
  breakdown: {
    distance?:       number;
    orderValue?:     number;
    rate?:           number;
    weight?:         number;
    usedFallback?:   boolean;
    matchedState?:   string;
  };
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  isShippingEnabled:     true,
  distanceThreshold:     3.0,
  perKmRate:             8,
  freeDeliveryThreshold: 199,
  defaultKgRate:         50,
  stateRates:            [] as StateRate[],
  // legacy fields
  freeRadius:            5.0,
  baseCharge:            50,
  perKmCharge:           10,
  prepaidDiscountType:   "PERCENT",
  prepaidDiscountValue:  5,
} as const;

// ─── Service ─────────────────────────────────────────────────────────────────

export class ShippingService {
  /**
   * Core calculation — pure function, no DB access.
   * Call this directly in tests or when you already have the config.
   */
  static calculateShipping(raw: ShippingInput, config: ShippingConfig): ShippingResult {
    const input = ShippingService.sanitize(raw);
    const { distanceInKm, orderValue, weightInKg, state } = input;

    if (!config.isShippingEnabled) {
      return { charge: 0, type: "DISABLED", breakdown: {} };
    }

    // ── Within distance threshold ─────────────────────────────────────────
    if (distanceInKm <= config.distanceThreshold) {
      if (orderValue >= config.freeDeliveryThreshold) {
        return {
          charge: 0,
          type: "FREE",
          breakdown: { distance: distanceInKm, orderValue },
        };
      }
      const charge = Math.round(distanceInKm * config.perKmRate);
      return {
        charge,
        type: "DISTANCE_BASED",
        breakdown: { distance: distanceInKm, rate: config.perKmRate },
      };
    }

    // ── Beyond threshold — weight-based ───────────────────────────────────
    const matched = state
      ? config.stateRates.find(
          (r) => r.state.toLowerCase() === state.toLowerCase(),
        )
      : undefined;

    const rate         = matched?.rate ?? config.defaultKgRate;
    const usedFallback = !matched;
    const charge       = Math.round(weightInKg * rate);

    return {
      charge,
      type: "WEIGHT_BASED",
      breakdown: {
        weight:       weightInKg,
        rate,
        usedFallback,
        matchedState: matched?.state,
      },
    };
  }

  // ── DB helpers ─────────────────────────────────────────────────────────────

  static async getShippingSettings() {
    let row = await prisma.shippingSettings.findFirst();
    if (!row) {
      row = await prisma.shippingSettings.create({ data: DEFAULT_SETTINGS as any });
    }
    return row;
  }

  static async updateShippingSettings(data: UpdateShippingConfigInput) {
    const row = await ShippingService.getShippingSettings();
    return prisma.shippingSettings.update({
      where: { id: row.id },
      data:  { ...data, stateRates: data.stateRates as any },
    });
  }

  /** Convenience method: fetch config from DB then run calculation. */
  static async calculateDeliveryCharge(input: ShippingInput): Promise<ShippingResult> {
    const row    = await ShippingService.getShippingSettings();
    const config = ShippingService.toConfig(row);
    return ShippingService.calculateShipping(input, config);
  }

  // ── Legacy compat (used by orders/payments modules) ────────────────────────

  /** @deprecated Use calculateDeliveryCharge({ distanceInKm, orderValue, weightInKg }) */
  static async calculateDeliveryChargeByDistance(distance: number) {
    const row     = await ShippingService.getShippingSettings();
    const config  = ShippingService.toConfig(row);
    const result  = ShippingService.calculateShipping(
      { distanceInKm: distance, orderValue: 0, weightInKg: 1 },
      config,
    );
    return { deliveryCharge: result.charge, deliveryType: result.type };
  }

  static async calculatePrepaidDiscount(totalAmount: number) {
    const row      = await ShippingService.getShippingSettings();
    const type     = row.prepaidDiscountType;
    const value    = Number(row.prepaidDiscountValue);
    return type === "PERCENT" ? totalAmount * (value / 100) : value;
  }

  static calculateFinalAmount(total: number, delivery: number, discount: number) {
    return Math.max(total + delivery - discount, 0);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private static sanitize(input: ShippingInput): Required<ShippingInput> {
    return {
      distanceInKm: Math.max(0, input.distanceInKm),
      orderValue:   Math.max(0, input.orderValue),
      // Business rule: minimum billable weight is 1 kg
      weightInKg:   Math.max(1, input.weightInKg),
      state:        input.state?.trim() ?? "",
    };
  }

  private static toConfig(row: any): ShippingConfig {
    return {
      isShippingEnabled:     row.isShippingEnabled,
      distanceThreshold:     Number(row.distanceThreshold),
      perKmRate:             Number(row.perKmRate),
      freeDeliveryThreshold: Number(row.freeDeliveryThreshold),
      defaultKgRate:         Number(row.defaultKgRate),
      stateRates:            Array.isArray(row.stateRates) ? (row.stateRates as StateRate[]) : [],
    };
  }
}
