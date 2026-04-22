import api from "./axios";
import type { ApiSuccessResponse, PaginatedResponse } from "../types";

export interface ReturnRequest {
  id: string;
  orderId: string;
  userId: string;
  email: string;
  reason?: string;
  status: "VERIFYING" | "APPROVED" | "REJECTED" | "COMPLETED";
  createdAt: string;
  updatedAt: string;
  order?: any;
  user?: any;
}

export type PaginatedReturns = PaginatedResponse<never> & { returns: ReturnRequest[] };

export const createReturn = async (orderId: string, email: string, reason?: string) => {
  const response = await api.post<ApiSuccessResponse<ReturnRequest>>("/returns", {
    orderId,
    email,
    reason,
  });
  return response.data;
};

export const getUserReturns = async (page: number = 1, limit: number = 10) => {
  const response = await api.get<ApiSuccessResponse<PaginatedReturns>>("/returns", {
    params: { page, limit },
  });
  return response.data;
};

export const getReturnDetail = async (id: string) => {
  const response = await api.get<ApiSuccessResponse<ReturnRequest>>(`/returns/${id}`);
  return response.data;
};

export const getAdminReturns = async (page: number = 1, limit: number = 10, status?: string) => {
  const response = await api.get<ApiSuccessResponse<PaginatedReturns>>("/admin/returns", {
    params: { page, limit, status },
  });
  return response.data;
};

export const getAdminReturnDetail = async (id: string) => {
  const response = await api.get<ApiSuccessResponse<ReturnRequest>>(`/admin/returns/${id}`);
  return response.data;
};

export const updateReturnStatus = async (id: string, status: "VERIFYING" | "APPROVED" | "REJECTED" | "COMPLETED") => {
  const response = await api.patch<ApiSuccessResponse<ReturnRequest>>(`/admin/returns/${id}/status`, {
    status,
  });
  return response.data;
};
