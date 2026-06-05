import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type SectionType    = "books" | "banner" | "categories" | "printCta" | "allBooks";
export type LayoutType     = "horizontal" | "grid" | "carousel";
export type BookFilterType = "newArrivals" | "bestSellers" | "featured" | "all";

export interface SectionConfig {
  limit?:                 number;
  showAll?:               boolean;
  selectedCategoryIds?:   string[];
  selectedSubcategoryIds?: string[];
  useManual?:             boolean;
  selectedProductIds?:    string[];
}

export interface HomepageSection {
  id:            string;
  title:         string;
  subtitle?:     string | null;
  description?:  string | null;
  type:          SectionType;
  layoutType:    LayoutType;
  bookFilter:    BookFilterType;
  categoryId?:   string | null;
  subcategoryId?: string | null;
  isEnabled:     boolean;
  order:         number;
  config:        SectionConfig;
  createdAt:     string;
  updatedAt:     string;
}

export type CreateSectionPayload = Omit<HomepageSection, "id" | "createdAt" | "updatedAt">;
export type UpdateSectionPayload = Partial<CreateSectionPayload>;

// Public
export const getHomepageSections = async (): Promise<HomepageSection[]> => {
  const res = await api.get<ApiSuccessResponse<HomepageSection[]>>("/homepage-sections");
  return res.data.data;
};

// Admin
export const adminGetAllSections = async (): Promise<HomepageSection[]> => {
  const res = await api.get<ApiSuccessResponse<HomepageSection[]>>("/admin/homepage-sections");
  return res.data.data;
};

export const adminCreateSection = async (data: CreateSectionPayload): Promise<HomepageSection> => {
  const res = await api.post<ApiSuccessResponse<HomepageSection>>("/admin/homepage-sections", data);
  return res.data.data;
};

export const adminUpdateSection = async (id: string, data: UpdateSectionPayload): Promise<HomepageSection> => {
  const res = await api.put<ApiSuccessResponse<HomepageSection>>(`/admin/homepage-sections/${id}`, data);
  return res.data.data;
};

export const adminDeleteSection = async (id: string): Promise<void> => {
  await api.delete(`/admin/homepage-sections/${id}`);
};

export const adminDuplicateSection = async (id: string): Promise<HomepageSection> => {
  const res = await api.post<ApiSuccessResponse<HomepageSection>>(`/admin/homepage-sections/${id}/duplicate`);
  return res.data.data;
};

export const adminReorderSections = async (orderedIds: string[]): Promise<HomepageSection[]> => {
  const res = await api.put<ApiSuccessResponse<HomepageSection[]>>("/admin/homepage-sections/reorder", { orderedIds });
  return res.data.data;
};
