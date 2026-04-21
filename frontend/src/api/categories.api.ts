import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type Subcategory = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  subcategories: Subcategory[];
};

// ─── Public ───────────────────────────────────────────────────────────────────

export const getCategories = async () => {
  const r = await api.get<ApiSuccessResponse<Category[]>>("/categories");
  return r.data;
};

export const getSubcategories = async (categoryId: string) => {
  const r = await api.get<ApiSuccessResponse<Subcategory[]>>("/categories/subcategories", {
    params: { categoryId },
  });
  return r.data;
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const createCategory = async (data: { name: string; imageFile?: File; isActive?: boolean; order?: number }) => {
  const form = new FormData();
  form.append("name", data.name);
  if (data.imageFile)              form.append("image",    data.imageFile);
  if (data.isActive  !== undefined) form.append("isActive", String(data.isActive));
  if (data.order     !== undefined) form.append("order",    String(data.order));
  const r = await api.post<ApiSuccessResponse<Category>>("/admin/categories", form);
  return r.data;
};

export const updateCategory = async (id: string, data: { name?: string; imageFile?: File; isActive?: boolean; order?: number }) => {
  const form = new FormData();
  if (data.name      !== undefined) form.append("name",     data.name);
  if (data.imageFile)               form.append("image",    data.imageFile);
  if (data.isActive  !== undefined) form.append("isActive", String(data.isActive));
  if (data.order     !== undefined) form.append("order",    String(data.order));
  const r = await api.patch<ApiSuccessResponse<Category>>(`/admin/categories/${id}`, form);
  return r.data;
};

export const deleteCategory = async (id: string) => {
  const r = await api.delete<ApiSuccessResponse<null>>(`/admin/categories/${id}`);
  return r.data;
};

export const createSubcategory = async (categoryId: string, data: { name: string; order?: number }) => {
  const r = await api.post<ApiSuccessResponse<Subcategory>>(
    `/admin/categories/${categoryId}/subcategories`,
    data,
  );
  return r.data;
};

export const updateSubcategory = async (id: string, data: { name?: string; isActive?: boolean; order?: number }) => {
  const r = await api.patch<ApiSuccessResponse<Subcategory>>(
    `/admin/categories/subcategories/${id}`,
    data,
  );
  return r.data;
};

export const deleteSubcategory = async (id: string) => {
  const r = await api.delete<ApiSuccessResponse<null>>(
    `/admin/categories/subcategories/${id}`,
  );
  return r.data;
};
