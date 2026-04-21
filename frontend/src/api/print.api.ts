import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type PrintSettings = {
  id: string;
  singleSideBasePrice: number;
  singleSideBulkPrice: number;
  doubleSidePrice: number;
  bulkThreshold: number;
  colorSurcharge: number;
  spiralExtra: number;
  staplerExtra: number;
  maxPdfsPerOrder: number;
  // legacy
  colorPrice: number;
  bwPrice: number;
  singleSideExtra: number;
  bothSideDiscount: number;
};

/** One uploaded PDF within a print order */
export type PrintFile = {
  id: string;
  fileUrl: string;
  originalName: string;
  fileSize: string;
  pageCount: number;
  /** Copies requested specifically for this file */
  copies: number;
  order: number;
};

export type PrintOrder = {
  id: string;
  userId: string;
  fileUrl: string;       // legacy first-file URL
  colorType: string;
  printSide: string;
  orientation: string;
  bindingType: string;
  pageCount: number;     // total raw pages across all files
  copies: number;        // sum of all per-file copies
  totalPrice: number;
  estimatedMinutes: number;
  status: string;
  paymentMethod: "COD" | "ONLINE";
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  createdAt: string;
  user?: { name: string; email: string; phone?: string | null };
  files?: PrintFile[];
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

export const deletePrintOrder = async (id: string) => {
  const response = await api.delete<ApiSuccessResponse<null>>(`/admin/print/${id}`);
  return response.data;
};
