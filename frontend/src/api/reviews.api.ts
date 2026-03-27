import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type Review = {
  id: string;
  bookId: string;
  userId: string;
  rating: number;
  title?: string;
  comment: string;
  isApproved: boolean;
  createdAt: string;
  user?: { name: string; email?: string };
  book?: { title: string };
};

export type BookRating = { average: number; count: number };

export const getBookReviews = async (bookId: string) => {
  const res = await api.get<ApiSuccessResponse<{ reviews: Review[]; rating: BookRating }>>(`/reviews/${bookId}`);
  return res.data;
};

export const createReview = async (bookId: string, data: { rating: number; title?: string; comment: string }) => {
  const res = await api.post<ApiSuccessResponse<Review>>(`/reviews/${bookId}`, data);
  return res.data;
};

export const getAdminReviews = async () => {
  const res = await api.get<ApiSuccessResponse<Review[]>>("/admin/reviews");
  return res.data;
};

export const approveReview = async (id: string) => {
  const res = await api.patch(`/admin/reviews/${id}/approve`);
  return res.data;
};

export const deleteReview = async (id: string) => {
  const res = await api.delete(`/admin/reviews/${id}`);
  return res.data;
};
