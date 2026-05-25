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
  updatedAt: string;
}

/** Maps new public config → old ShippingSettings shape so existing pages keep working. */
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
  stateRates:            StateRate[];
  updatedAt:             string;
}

export interface ShippingResult {
  charge:    number;
  type:      "FREE" | "DISTANCE_BASED" | "WEIGHT_BASED" | "DISABLED";
  breakdown: {
    distance?:     number;
    orderValue?:   number;
    rate?:         number;
    weight?:       number;
    usedFallback?: boolean;
    matchedState?: string;
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
}): Promise<ShippingResult> => {
  const r = await api.post<ShippingResult>("/admin/shipping/calculate", input);
  return r.data;
};
