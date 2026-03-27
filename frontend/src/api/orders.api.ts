import api from "./axios";
import type { ApiSuccessResponse, Order, PaginatedOrders, ShippingAddress } from "../types";

export const placeOrder = async (
  shippingAddress: ShippingAddress,
  paymentMethod: "ONLINE" | "COD" = "ONLINE",
  customerEmail?: string,
) => {
  const response = await api.post<ApiSuccessResponse<Order>>("/orders", {
    shippingAddress,
    paymentMethod,
    customerEmail,
  });
  return response.data;
};

export const getOrders = async (page?: number, limit?: number) => {
  const response = await api.get<ApiSuccessResponse<PaginatedOrders>>("/orders", { params: { page, limit } });
  return response.data;
};

export const getOrder = async (id: string) => {
  const response = await api.get<ApiSuccessResponse<Order>>(`/orders/${id}`);
  return response.data;
};

export const cancelOrder = async (id: string) => {
  const response = await api.post<ApiSuccessResponse<Order>>(`/orders/${id}/cancel`);
  return response.data;
};

export const verifyPayment = async (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
) => {
  const response = await api.post<ApiSuccessResponse<Order>>("/payments/verify", {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
  return response.data;
};
