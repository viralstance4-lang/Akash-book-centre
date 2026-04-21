import AppError from "../../lib/AppError";
import prisma from "../../lib/prisma";

const createSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ─── Category ─────────────────────────────────────────────────────────────────

export const getAllCategories = () =>
  prisma.category.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      subcategories: {
        orderBy: [{ order: "asc" }, { name: "asc" }],
      },
    },
  });

export const getCategoryBySlug = async (slug: string) => {
  const cat = await prisma.category.findUnique({
    where: { slug },
    include: {
      subcategories: {
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      },
    },
  });
  if (!cat) throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  return cat;
};

export const createCategory = async (
  name: string,
  opts?: { imageUrl?: string; imagePublicId?: string; isActive?: boolean; order?: number },
) => {
  const trimmed = name.trim();
  const slug    = createSlug(trimmed);

  const existing = await prisma.category.findFirst({
    where: { OR: [{ name: trimmed }, { slug }] },
  });
  if (existing) throw new AppError("Category already exists", 409, "CATEGORY_EXISTS");

  return prisma.category.create({
    data: {
      name:          trimmed,
      slug,
      imageUrl:      opts?.imageUrl      ?? null,
      imagePublicId: opts?.imagePublicId ?? null,
      isActive:      opts?.isActive      ?? true,
      order:         opts?.order         ?? 0,
    },
    include: { subcategories: { orderBy: [{ order: "asc" }, { name: "asc" }] } },
  });
};

export const updateCategory = async (
  id: string,
  data: {
    name?:          string;
    imageUrl?:      string | null;
    imagePublicId?: string | null;
    isActive?:      boolean;
    order?:         number;
  },
) => {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");

  const payload: typeof data & { slug?: string } = { ...data };

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    const newSlug = createSlug(trimmed);
    if (trimmed !== existing.name) {
      const dup = await prisma.category.findFirst({
        where: { OR: [{ name: trimmed }, { slug: newSlug }], id: { not: id } },
      });
      if (dup) throw new AppError("Category name already exists", 409, "CATEGORY_EXISTS");
    }
    payload.name = trimmed;
    payload.slug = newSlug;
  }

  return prisma.category.update({
    where: { id },
    data:  payload,
    include: { subcategories: { orderBy: [{ order: "asc" }, { name: "asc" }] } },
  });
};

export const deleteCategory = async (id: string) => {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  await prisma.category.delete({ where: { id } });
};

export const getSubcategoriesByCategoryId = (categoryId: string) =>
  prisma.subcategory.findMany({
    where: { categoryId, isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

// ─── Subcategory ──────────────────────────────────────────────────────────────

export const createSubcategory = async (
  categoryId: string,
  name: string,
  opts?: { isActive?: boolean; order?: number },
) => {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");

  const trimmed = name.trim();
  const slug    = `${category.slug}-${createSlug(trimmed)}`;

  const existing = await prisma.subcategory.findFirst({
    where: { categoryId, name: trimmed },
  });
  if (existing) throw new AppError("Subcategory already exists in this category", 409, "SUB_EXISTS");

  return prisma.subcategory.create({
    data: {
      categoryId,
      name:     trimmed,
      slug,
      isActive: opts?.isActive ?? true,
      order:    opts?.order    ?? 0,
    },
  });
};

export const updateSubcategory = async (
  id: string,
  data: { name?: string; isActive?: boolean; order?: number },
) => {
  const existing = await prisma.subcategory.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!existing) throw new AppError("Subcategory not found", 404, "SUB_NOT_FOUND");

  const payload: { name?: string; slug?: string; isActive?: boolean; order?: number } = {};

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    const newSlug = `${existing.category.slug}-${createSlug(trimmed)}`;
    if (trimmed !== existing.name) {
      const dup = await prisma.subcategory.findFirst({
        where: { categoryId: existing.categoryId, name: trimmed, id: { not: id } },
      });
      if (dup) throw new AppError("Subcategory name already exists", 409, "SUB_EXISTS");
    }
    payload.name = trimmed;
    payload.slug = newSlug;
  }
  if (data.isActive !== undefined) payload.isActive = data.isActive;
  if (data.order    !== undefined) payload.order    = data.order;

  return prisma.subcategory.update({ where: { id }, data: payload });
};

export const deleteSubcategory = async (id: string) => {
  const existing = await prisma.subcategory.findUnique({ where: { id } });
  if (!existing) throw new AppError("Subcategory not found", 404, "SUB_NOT_FOUND");
  await prisma.subcategory.delete({ where: { id } });
};
