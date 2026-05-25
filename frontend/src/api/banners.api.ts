import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type Banner = {
  id: string;
  /** Legacy field — equals desktopImageUrl for new banners; used as fallback for old ones. */
  imageUrl: string;
  publicId: string;
  desktopImageUrl: string | null;
  desktopPublicId: string | null;
  mobileImageUrl: string | null;
  mobilePublicId: string | null;
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

export const getAdminBanners = async () => {
  const response = await api.get<ApiSuccessResponse<Banner[]>>("/admin/banners");
  return response.data;
};

/** Create — FormData must include desktopImage + mobileImage files. */
export const createBanner = async (formData: FormData) => {
  const response = await api.post<ApiSuccessResponse<Banner>>("/admin/banners", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

/** Update — FormData may optionally include desktopImage / mobileImage files for re-upload. */
export const updateBanner = async (id: string, formData: FormData) => {
  const response = await api.patch<ApiSuccessResponse<Banner>>(`/admin/banners/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const deleteBanner = async (id: string) => {
  const response = await api.delete(`/admin/banners/${id}`);
  return response.data;
};
