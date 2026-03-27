import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type Coupon = {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount?: number;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
};

export type CouponValidation = {
  coupon: Coupon;
  discount: number;
  finalAmount: number;
};

export const validateCoupon = async (code: string, orderAmount: number) => {
  const response = await api.post<ApiSuccessResponse<CouponValidation>>("/coupons/validate", { code, orderAmount });
  return response.data;
};

export const getAdminCoupons = async () => {
  const response = await api.get<ApiSuccessResponse<Coupon[]>>("/admin/coupons");
  return response.data;
};

export const createCoupon = async (data: Partial<Coupon> & { discountValue: number }) => {
  const response = await api.post<ApiSuccessResponse<Coupon>>("/admin/coupons", data);
  return response.data;
};

export const updateCoupon = async (id: string, data: Partial<Coupon>) => {
  const response = await api.patch<ApiSuccessResponse<Coupon>>(`/admin/coupons/${id}`, data);
  return response.data;
};

export const deleteCoupon = async (id: string) => {
  const response = await api.delete(`/admin/coupons/${id}`);
  return response.data;
};
