import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type Page = {
  id: string;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
  showInFooter: boolean;
  createdAt: string;
  updatedAt: string;
};

export const getPage = async (slug: string) => {
  const res = await api.get<ApiSuccessResponse<Page>>(`/pages/${slug}`);
  return res.data;
};

export const getFooterPages = async () => {
  const res = await api.get<ApiSuccessResponse<{ id: string; title: string; slug: string }[]>>("/pages/footer");
  return res.data;
};

export const getAdminPages = async () => {
  const res = await api.get<ApiSuccessResponse<Page[]>>("/admin/pages");
  return res.data;
};

export const createPage = async (data: Partial<Page>) => {
  const res = await api.post<ApiSuccessResponse<Page>>("/admin/pages", data);
  return res.data;
};

export const updatePage = async (id: string, data: Partial<Page>) => {
  const res = await api.patch<ApiSuccessResponse<Page>>(`/admin/pages/${id}`, data);
  return res.data;
};

export const deletePage = async (id: string) => {
  const res = await api.delete(`/admin/pages/${id}`);
  return res.data;
};
