import axios from "./axios";

export interface ShippingSettings {
  id: string;
  freeRadius: number;
  baseCharge: number;
  perKmCharge: number;
  maxCharge: number | null;
  prepaidDiscountType: "PERCENT" | "FLAT";
  prepaidDiscountValue: number;
  updatedAt: string;
}

export const getShippingSettings = async (): Promise<ShippingSettings> => {
  const response = await axios.get("/shipping-settings");
  return response.data;
};

export const updateShippingSettings = async (data: Omit<ShippingSettings, "id" | "updatedAt">): Promise<ShippingSettings> => {
  const response = await axios.put("/admin/shipping-settings", data);
  return response.data;
};