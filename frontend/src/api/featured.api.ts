import api from "./axios";
import type { ApiSuccessResponse } from "../types";
import type { Book } from "../types";

export const getFeaturedBooks = async () => {
  const res = await api.get<ApiSuccessResponse<Book[]>>("/featured");
  return res.data;
};

export const addFeaturedBook = async (bookId: string, order: number) => {
  const res = await api.post("/admin/featured", { bookId, order });
  return res.data;
};

export const removeFeaturedBook = async (bookId: string) => {
  const res = await api.delete(`/admin/featured/${bookId}`);
  return res.data;
};
