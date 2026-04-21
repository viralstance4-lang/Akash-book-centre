import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type SiteSettings = {
  id: string;
  storeName: string;
  tagline: string;
  logoUrl?: string;
  logoPublicId?: string;
  logoWidth?: number;
  logoHeight?: number;
  spiralBindingPrice: number;
};

export const getSettings = async () => {
  const response = await api.get<ApiSuccessResponse<SiteSettings>>("/settings");
  return response.data;
};

export const updateSettings = async (formData: FormData) => {
  console.log("[DEBUG] updateSettings API call with FormData");
  try {
    const response = await api.patch<ApiSuccessResponse<SiteSettings>>("/settings", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    console.log("[DEBUG] updateSettings API response:", response.data);
    return response.data;
  } catch (error) {
    console.error("[DEBUG] updateSettings API error:", error);
    throw error;
  }
};
