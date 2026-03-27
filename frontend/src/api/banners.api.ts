import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type Banner = {
  id: string;
  imageUrl: string;
  publicId: string;
  redirectUrl: string;
  title?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
};

export const getBanners = async () => {
  const response = await api.get<ApiSuccessResponse<Banner[]>>("/banners");
  return response.data;
};

export const createBanner = async (formData: FormData) => {
  const response = await api.post<ApiSuccessResponse<Banner>>("/admin/banners", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const updateBanner = async (id: string, data: Partial<{ redirectUrl: string; title: string; isActive: boolean; order: number }>) => {
  const response = await api.patch<ApiSuccessResponse<Banner>>(`/admin/banners/${id}`, data);
  return response.data;
};

export const deleteBanner = async (id: string) => {
  const response = await api.delete(`/admin/banners/${id}`);
  return response.data;
};
