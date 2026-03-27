import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type PrintSettings = {
  id: string;
  colorPrice: number;
  bwPrice: number;
  singleSideExtra: number;
  bothSideDiscount: number;
  spiralExtra: number;
  staplerExtra: number;
};

export type PrintOrder = {
  id: string;
  userId: string;
  fileUrl: string;
  colorType: string;
  printSide: string;
  orientation: string;
  bindingType: string;
  pageCount: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  user?: { name: string; email: string };
};

export const getPrintSettings = async () => {
  const response = await api.get<ApiSuccessResponse<PrintSettings>>("/print/settings");
  return response.data;
};

export const createPrintOrder = async (formData: FormData) => {
  const response = await api.post<ApiSuccessResponse<PrintOrder>>("/print", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const getMyPrintOrders = async () => {
  const response = await api.get<ApiSuccessResponse<PrintOrder[]>>("/print/my-orders");
  return response.data;
};

export const getAdminPrintOrders = async () => {
  const response = await api.get<ApiSuccessResponse<PrintOrder[]>>("/admin/print");
  return response.data;
};

export const updatePrintSettings = async (data: Partial<PrintSettings>) => {
  const response = await api.put<ApiSuccessResponse<PrintSettings>>("/admin/print/settings", data);
  return response.data;
};

export const updatePrintOrderStatus = async (id: string, status: string) => {
  const response = await api.patch<ApiSuccessResponse<PrintOrder>>(`/admin/print/${id}/status`, { status });
  return response.data;
};
