import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type PrintSettings = {
  id: string;
  // ── New independent B&W / Color pricing fields ────────────────────────────
  bwSingleSide:         number;
  bwBothSideUnder20:    number;
  bwBothSideAbove20:    number;
  colorSingleSide:      number;
  colorBothSideUnder20: number;
  colorBothSideAbove20: number;
  colorAbove99:         number;
  // ── Shared ────────────────────────────────────────────────────────────────
  spiralExtra:    number;
  staplerExtra:   number;
  maxPdfsPerOrder: number;
  // ── Legacy (still returned by API for old-data backward compat) ───────────
  singleSideBasePrice: number;
  singleSideBulkPrice: number;
  doubleSidePrice: number;
  bulkThreshold: number;
  colorSurcharge: number;
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
  fileUrl: string;
  colorType: string;
  printSide: string;
  orientation: string;
  bindingType: string;
  pageCount: number;
  copies: number;
  totalPrice: number;
  estimatedMinutes: number;
  status: string;
  paymentMethod: "COD" | "ONLINE";
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  razorpaySignature?: string | null;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  createdAt: string;
  user?: { name: string; email: string; phone?: string | null };
  files?: PrintFile[];
};

/** Response from Phase 1 (create pending order) */
export type PrintOrderInitiated = {
  printOrderId:    string;
  razorpayOrderId: string;
  amount:          number;
  customerName:    string;
  customerEmail:   string;
};

export const getPrintSettings = async () => {
  const response = await api.get<ApiSuccessResponse<PrintSettings>>("/print/settings");
  return response.data;
};

/** Phase 1: upload PDFs, create pending order, get Razorpay order ID back */
export const createPrintOrder = async (formData: FormData) => {
  const response = await api.post<ApiSuccessResponse<PrintOrderInitiated>>("/print", formData);
  return response.data;
};

/** Phase 2: verify Razorpay signature and confirm the print order */
export const verifyPrintPayment = async (
  printOrderId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
) => {
  const response = await api.post<ApiSuccessResponse<PrintOrder>>(
    `/print/${printOrderId}/verify-payment`,
    { razorpayOrderId, razorpayPaymentId, razorpaySignature },
  );
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
