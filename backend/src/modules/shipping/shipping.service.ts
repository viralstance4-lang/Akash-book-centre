import prisma from "../../lib/prisma";
import type { StateRate, UpdateShippingConfigInput } from "./shipping.schema";

// ─── Zone maps ───────────────────────────────────────────────────────────────

/** Cities/areas that belong to the Delhi NCR zone (matched against city field). */
const DELHI_NCR_AREAS = new Set([
  "delhi", "new delhi",
  "noida", "greater noida",
  "gurugram", "gurgaon",
  "faridabad", "ghaziabad",
]);

/** States that belong to the North East zone (matched against state field). */
const NORTH_EAST_STATES = new Set([
  "arunachal pradesh", "assam", "manipur",
  "meghalaya", "mizoram", "nagaland", "tripura", "sikkim",
]);

/**
 * Pincode-based zone fallback — used when city/state text matching can't
 * resolve a zone (e.g. Google reverse-geocoding a remote/rural coordinate
 * returns only a Plus Code with no administrative_area_level_1 component).
 * Indian PIN codes are geographically assigned, so the first 3 digits
 * reliably identify the postal region regardless of what address text (if
 * any) came back.
 */
const DELHI_NCR_PINCODE_PREFIXES = new Set([
  "110", // Delhi (all Delhi PINs start 110)
  "121", // Faridabad
  "122", // Gurugram / Gurgaon
  "201", // Ghaziabad, Noida, Greater Noida
]);

/** Assam, Arunachal Pradesh, Meghalaya, Manipur, Mizoram, Nagaland, Tripura all fall in the 780–799 range. */
function isNorthEastPincodePrefix(prefix3: string): boolean {
  if (prefix3 === "737") return true; // Sikkim — numerically under the West Bengal postal circle, geographically North East
  const n = Number(prefix3);
  return n >= 780 && n <= 799;
}

export type ShippingZone = "LOCAL_DELHI_NCR" | "NORTH_EAST" | "ALL_INDIA";

export const ZONE_LABELS: Record<ShippingZone, string> = {
  LOCAL_DELHI_NCR: "Delhi NCR",
  NORTH_EAST:      "North East",
  ALL_INDIA:       "All India",
};

// ─── Domain types ────────────────────────────────────────────────────────────

export interface ShippingConfig {
  isShippingEnabled:     boolean;
  distanceThreshold:     number;   // km — radius for local distance-based delivery; beyond this, weight-based zone pricing applies
  perKmRate:             number;   // ₹/km for local delivery
  freeDeliveryThreshold: number;   // order value above which local delivery is free
  defaultKgRate:         number;   // ₹/kg fallback (All India)
  localZoneRate:         number;   // ₹/kg for Delhi NCR zone
  northEastRate:         number;   // ₹/kg for North East zone
  localZoneAreaCharge:   number;   // flat area charge for Delhi NCR (added to weight charge)
  northEastAreaCharge:   number;   // flat area charge for North East
  defaultAreaCharge:     number;   // flat area charge for All India
  stateRates:            StateRate[];
}

export interface ShippingInput {
  distanceInKm: number;
  orderValue:   number;
  weightInKg:   number;
  state?:       string;
  city?:        string;  // used for Delhi NCR zone detection
  /** Fallback zone signal, used when city/state can't be resolved (e.g. a remote-coordinate reverse-geocode with no administrative_area component). */
  pincode?:     string;
  /**
   * Print orders bill weight in whole-kg slabs (ceil), unlike regular book
   * orders which bill exact fractional weight. Only affects the WEIGHT_BASED
   * (beyond-threshold) path — distance-based/free delivery is unaffected.
   */
  isPrintOrder?: boolean;
}

export type ShippingType = "FREE" | "DISTANCE_BASED" | "WEIGHT_BASED" | "DISABLED";

export interface ShippingResult {
  charge:      number;
  areaCharge?: number;    // flat zone fee (for WEIGHT_BASED only)
  weightCharge?: number;  // weight × rate component (for WEIGHT_BASED only)
  type:        ShippingType;
  zone?:       string;    // human-readable zone name for display
  breakdown: {
    distance?:         number;
    orderValue?:       number;
    rate?:             number;
    weight?:           number;
    chargeableWeight?: number;  // print orders only — weight after ceiling to whole kg
    areaCharge?:       number;
    weightCharge?:     number;
    usedFallback?:     boolean;
    matchedState?:     string;
    zone?:             string;
  };
}

// ─── Packaging weight ─────────────────────────────────────────────────────────

/** Fixed packaging weight added to every order before shipping is calculated. */
export const PACKAGING_WEIGHT_KG = 0.15;

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  isShippingEnabled:     true,
  distanceThreshold:     3.0,
  perKmRate:             8,
  freeDeliveryThreshold: 199,
  defaultKgRate:         70,   // All India
  localZoneRate:         50,   // Delhi NCR
  northEastRate:         80,   // North East
  localZoneAreaCharge:   0,    // flat area charge Delhi NCR (default 0)
  northEastAreaCharge:   0,    // flat area charge North East
  defaultAreaCharge:     0,    // flat area charge All India
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
   * Detect shipping zone from city/state strings, falling back to pincode
   * prefix when city/state don't resolve a zone (see DELHI_NCR_PINCODE_PREFIXES
   * / isNorthEastPincodePrefix above).
   * Priority order: Delhi NCR → North East → All India
   */
  static detectZone(city?: string, state?: string, pincode?: string): ShippingZone {
    const c  = (city    ?? "").toLowerCase().trim();
    const s  = (state   ?? "").toLowerCase().trim();
    const p3 = (pincode ?? "").trim().slice(0, 3);

    if (DELHI_NCR_AREAS.has(c) || s === "delhi" || s === "new delhi" || s === "delhi ncr" || DELHI_NCR_PINCODE_PREFIXES.has(p3)) {
      return "LOCAL_DELHI_NCR";
    }
    if (NORTH_EAST_STATES.has(s) || (p3.length === 3 && isNorthEastPincodePrefix(p3))) {
      return "NORTH_EAST";
    }
    return "ALL_INDIA";
  }

  /**
   * Core calculation — pure function, no DB access.
   *
   * Priority:
   *  1. DISABLED  — shipping kill-switch off
   *  2. FREE      — within distanceThreshold AND order ≥ freeDeliveryThreshold
   *  3. DISTANCE_BASED — within distanceThreshold, charged ₹/km (distance rounded UP
   *     to the next whole km before multiplying — e.g. 2km → ₹16, 3.2km would be ₹32
   *     if the threshold were wider)
   *  4. WEIGHT_BASED (zone-aware) — beyond distanceThreshold:
   *       Delhi NCR → localZoneRate
   *       North East → northEastRate
   *       stateRates match → custom per-state rate (legacy overrides)
   *       fallback → defaultKgRate (All India)
   */
  static calculateShipping(raw: ShippingInput, config: ShippingConfig): ShippingResult {
    const input = ShippingService.sanitize(raw);
    const { distanceInKm, orderValue, weightInKg, city, state, pincode, isPrintOrder } = input;

    if (!config.isShippingEnabled) {
      return { charge: 0, type: "DISABLED", breakdown: {} };
    }

    // Distance billed in whole kilometers, rounded UP (2.9km and 3.0km bill the
    // same 3km; 3.2km bills as 4km).
    const chargeableKm = Math.ceil(distanceInKm);

    // ── Step 1: Within the local distance-based radius ────────────────────────
    if (distanceInKm <= config.distanceThreshold) {
      if (orderValue >= config.freeDeliveryThreshold) {
        return {
          charge:    0,
          type:      "FREE",
          zone:      "Local",
          breakdown: { distance: distanceInKm, orderValue },
        };
      }
      const charge = Math.round(chargeableKm * config.perKmRate);
      return {
        charge,
        type:      "DISTANCE_BASED",
        zone:      "Local",
        breakdown: { distance: distanceInKm, rate: config.perKmRate },
      };
    }

    // ── Step 2: Beyond the radius → zone-based weight + area pricing ─────────
    const zone      = ShippingService.detectZone(city, state, pincode);
    const zoneLabel = ZONE_LABELS[zone];

    let rate:         number;
    let areaCharge:   number;
    let usedFallback: boolean;
    let matchedState: string | undefined;

    if (zone === "LOCAL_DELHI_NCR") {
      rate         = config.localZoneRate;
      areaCharge   = config.localZoneAreaCharge;
      usedFallback = false;
    } else if (zone === "NORTH_EAST") {
      rate         = config.northEastRate;
      areaCharge   = config.northEastAreaCharge;
      usedFallback = false;
    } else {
      // ALL_INDIA — check per-state overrides first (backward compat), then defaultKgRate
      const matched = state
        ? config.stateRates.find((r) => r.state.toLowerCase() === state.toLowerCase())
        : undefined;
      rate         = matched?.rate ?? config.defaultKgRate;
      areaCharge   = config.defaultAreaCharge;
      usedFallback = !matched;
      matchedState = matched?.state;
    }

    // Print orders bill in whole-kg slabs: 1g–1000g → 1kg, 1001g–2000g → 2kg, etc.
    // Regular book orders keep billing exact fractional weight, unchanged.
    const chargeableWeightKg = isPrintOrder ? Math.ceil(weightInKg) : weightInKg;
    const weightCharge = Math.round(chargeableWeightKg * rate);
    const charge       = areaCharge + weightCharge;

    return {
      charge,
      areaCharge,
      weightCharge,
      type:      "WEIGHT_BASED",
      zone:      matchedState ?? zoneLabel,
      breakdown: {
        weight:           weightInKg,
        chargeableWeight: isPrintOrder ? chargeableWeightKg : undefined,
        rate,
        areaCharge,
        weightCharge,
        usedFallback,
        matchedState,
        zone:             zoneLabel,
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

  /** @deprecated Use calculateDeliveryCharge({ distanceInKm, orderValue, weightInKg, city, state }) */
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
      weightInKg:   Math.max(1, input.weightInKg), // minimum billable weight: 1 kg
      state:        input.state?.trim()   ?? "",
      city:         input.city?.trim()    ?? "",
      pincode:      input.pincode?.trim() ?? "",
      isPrintOrder: input.isPrintOrder === true,
    };
  }

  private static toConfig(row: any): ShippingConfig {
    return {
      isShippingEnabled:     row.isShippingEnabled,
      distanceThreshold:     Number(row.distanceThreshold),
      perKmRate:             Number(row.perKmRate),
      freeDeliveryThreshold: Number(row.freeDeliveryThreshold),
      defaultKgRate:         Number(row.defaultKgRate),
      localZoneRate:         Number(row.localZoneRate        ?? DEFAULT_SETTINGS.localZoneRate),
      northEastRate:         Number(row.northEastRate        ?? DEFAULT_SETTINGS.northEastRate),
      localZoneAreaCharge:   Number(row.localZoneAreaCharge  ?? 0),
      northEastAreaCharge:   Number(row.northEastAreaCharge  ?? 0),
      defaultAreaCharge:     Number(row.defaultAreaCharge    ?? 0),
      stateRates:            Array.isArray(row.stateRates) ? (row.stateRates as StateRate[]) : [],
    };
  }
}
