import api from "./axios";
import type {
  ApiSuccessResponse,
  Book,
  Genre,
  PaginatedBooks,
} from "../types";

type GetBooksParams = {
  q?: string;
  genre?: string;
  author?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
};

type UpdateStockType = "absolute" | "delta";

export const getBooks = async (params?: GetBooksParams) => {
  const response = await api.get<ApiSuccessResponse<PaginatedBooks>>("/books", {
    params,
  });

  return response.data;
};

export const getGenres = async () => {
  const response = await api.get<ApiSuccessResponse<Genre[]>>("/genres");

  return response.data;
};

export const getBook = async (id: string) => {
  const response = await api.get<ApiSuccessResponse<Book>>(`/books/${id}`);

  return response.data;
};

export const createBook = async (formData: FormData) => {
  const response = await api.post<ApiSuccessResponse<Book>>("/books", formData);

  return response.data;
};

export const updateBook = async (id: string, formData: FormData) => {
  const response = await api.patch<ApiSuccessResponse<Book>>(`/books/${id}`, formData);

  return response.data;
};

export const deleteBook = async (id: string) => {
  const response = await api.delete(`/books/${id}`);

  return response.data;
};

export const updateStock = async (
  id: string,
  quantity: number,
  type: UpdateStockType,
) => {
  const response = await api.patch<ApiSuccessResponse<Book>>(`/books/${id}/stock`, {
    quantity,
    type,
  });

  return response.data;
};

export const addBookImages = async (bookId: string, files: File[]) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("images", f));
  const response = await api.post(`/books/${bookId}/images`, fd);
  return response.data;
};

export const deleteBookImage = async (bookId: string, imageId: string) => {
  const response = await api.delete(`/books/${bookId}/images/${imageId}`);
  return response.data;
};

export const reorderBookImages = async (bookId: string, images: { id: string; order: number }[]) => {
  const response = await api.patch(`/books/${bookId}/images/reorder`, { images });
  return response.data;
};
