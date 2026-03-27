import api from "./axios";
import type { ApiSuccessResponse, Cart } from "../types";

export const getCart = async () => {
  const response = await api.get<ApiSuccessResponse<Cart>>("/cart");

  return response.data;
};

export const addToCart = async (bookId: string, quantity: number) => {
  const response = await api.post<ApiSuccessResponse<Cart>>("/cart/items", {
    bookId,
    quantity,
  });

  return response.data;
};

export const updateCartItem = async (bookId: string, quantity: number) => {
  const response = await api.patch<ApiSuccessResponse<Cart>>(`/cart/items/${bookId}`, {
    quantity,
  });

  return response.data;
};

export const removeCartItem = async (bookId: string) => {
  const response = await api.delete<ApiSuccessResponse<Cart>>(`/cart/items/${bookId}`);

  return response.data;
};

export const clearCart = async () => {
  const response = await api.delete<ApiSuccessResponse<Cart>>("/cart/clear");

  return response.data;
};
