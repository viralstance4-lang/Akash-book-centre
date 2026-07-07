import api from "./axios";
import type { ApiSuccessResponse, Book } from "../types";

// ── Shared sub-types ─────────────────────────────────────────────────────────

export type SectionSubcategory = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  imageUrl?: string | null;
};

export type SectionBookMini = {
  id: string;
  title: string;
  coverImageUrl: string;
};

// ── Public type (returned by GET /category-sections) ─────────────────────────

export type CategorySectionPublic = {
  id: string;
  heading: string;
  contentType: "category" | "manual";
  sortOrder: number;
  categoryId?: string | null;
  subcategories: SectionSubcategory[];
  books: (Pick<Book, "id" | "title" | "author" | "price" | "coverImageUrl" | "stock"> &
    { comparePrice?: number | string | null })[];
};

// ── Admin type (returned by GET /admin/category-sections) ─────────────────────

export type CategorySection = {
  id: string;
  heading: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  contentType: "category" | "manual";
  categoryId?: string | null;
  subcategoryId?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; slug: string } | null;
  subcategory?: { id: string; name: string; slug: string; categoryId: string } | null;
  sectionSubcategories?: { subcategory: SectionSubcategory }[];
  sectionBooks?: { bookId: string; book: SectionBookMini }[];
  _count?: { sectionBooks: number };
};

export type CategorySectionWithBooks = CategorySection & { books: Book[] };

// ── Public API ────────────────────────────────────────────────────────────────

export const getCategorySections = async () => {
  const r = await api.get<ApiSuccessResponse<CategorySectionPublic[]>>("/category-sections");
  return r.data;
};

export const getCategorySectionWithBooks = async (id: string) => {
  const r = await api.get<ApiSuccessResponse<CategorySectionWithBooks>>(`/category-sections/${id}`);
  return r.data;
};

// ── Admin API ─────────────────────────────────────────────────────────────────

export const adminGetCategorySections = async () => {
  const r = await api.get<ApiSuccessResponse<CategorySection[]>>("/admin/category-sections");
  return r.data;
};

export const adminCreateCategorySection = async (formData: FormData) => {
  const r = await api.post<ApiSuccessResponse<CategorySection>>("/admin/category-sections", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data;
};

export const adminUpdateCategorySection = async (id: string, formData: FormData) => {
  const r = await api.patch<ApiSuccessResponse<CategorySection>>(`/admin/category-sections/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data;
};

export const adminDeleteCategorySection = async (id: string) => {
  const r = await api.delete<ApiSuccessResponse<null>>(`/admin/category-sections/${id}`);
  return r.data;
};

export const adminReorderCategorySections = async (items: { id: string; sortOrder: number }[]) => {
  const r = await api.patch<ApiSuccessResponse<null>>("/admin/category-sections/reorder", { items });
  return r.data;
};
