import api from "./axios";

// ── Legacy shape (still used by CheckoutPage & AdminSettingsPage) ─────────────
export interface ShippingSettings {
  id: string;
  freeRadius: number;
  baseCharge: number;
  perKmCharge: number;
  maxCharge: number | null;
  prepaidDiscountType: "PERCENT" | "FLAT";
  prepaidDiscountValue: number;
  isShippingEnabled: boolean;
  freeDeliveryThreshold: number;
  // Regional zone rates (added for checkout estimate)
  localZoneRate: number;
  northEastRate: number;
  defaultKgRate: number;
  updatedAt: string;
}

/** Maps new public config → legacy ShippingSettings shape so existing checkout keeps working. */
export const getShippingSettings = async (): Promise<ShippingSettings> => {
  const r = await api.get<any>("/shipping/config");
  const c = r.data;
  return {
    id:                    c.id ?? "",
    freeRadius:            c.distanceThreshold,
    baseCharge:            0,
    perKmCharge:           c.perKmRate,
    maxCharge:             null,
    prepaidDiscountType:   (c.prepaidDiscountType as "PERCENT" | "FLAT") ?? "PERCENT",
    prepaidDiscountValue:  c.prepaidDiscountValue ?? 0,
    isShippingEnabled:     c.isShippingEnabled,
    freeDeliveryThreshold: c.freeDeliveryThreshold,
    localZoneRate:         c.localZoneRate  ?? 50,
    northEastRate:         c.northEastRate  ?? 80,
    defaultKgRate:         c.defaultKgRate  ?? 70,
    updatedAt:             c.updatedAt ?? "",
  };
};

/** No-op kept for backward compat — shipping config now managed via AdminShippingPage. */
export const updateShippingSettings = async (_data: any): Promise<ShippingSettings> => {
  return getShippingSettings();
};

// ── New admin API ─────────────────────────────────────────────────────────────

export interface StateRate {
  state: string;
  rate:  number;
}

export interface ShippingConfig {
  id:                    string;
  isShippingEnabled:     boolean;
  distanceThreshold:     number;
  perKmRate:             number;
  freeDeliveryThreshold: number;
  defaultKgRate:         number;
  localZoneRate:         number;
  northEastRate:         number;
  stateRates:            StateRate[];
  updatedAt:             string;
}

export interface ShippingResult {
  charge:    number;
  type:      "FREE" | "DISTANCE_BASED" | "WEIGHT_BASED" | "DISABLED";
  zone?:     string;
  breakdown: {
    distance?:     number;
    orderValue?:   number;
    rate?:         number;
    weight?:       number;
    usedFallback?: boolean;
    matchedState?: string;
    zone?:         string;
  };
}

export const getAdminShippingConfig = async (): Promise<ShippingConfig> => {
  const r = await api.get<ShippingConfig>("/admin/shipping/config");
  return r.data;
};

export const updateAdminShippingConfig = async (
  data: Partial<Omit<ShippingConfig, "id" | "updatedAt">>,
): Promise<ShippingConfig> => {
  const r = await api.put<ShippingConfig>("/admin/shipping/config", data);
  return r.data;
};

export const testShippingCalculation = async (input: {
  distanceInKm: number;
  orderValue:   number;
  weightInKg:   number;
  state?:       string;
  city?:        string;
}): Promise<ShippingResult> => {
  const r = await api.post<ShippingResult>("/admin/shipping/calculate", input);
  return r.data;
};
