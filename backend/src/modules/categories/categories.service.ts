import AppError from "../../lib/AppError";
import { deleteImage } from "../../lib/cloudinary";
import prisma from "../../lib/prisma";

const createSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ─── Category ─────────────────────────────────────────────────────────────────

/**
 * `includeInactive` must only ever be set to `true` by admin-authenticated callers
 * — public storefront requests should never see a category/subcategory an admin
 * has hidden.
 */
export const getAllCategories = (includeInactive = false) =>
  prisma.category.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      subcategories: {
        where: includeInactive ? undefined : { isActive: true },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      },
    },
  });

export const getCategoryBySlug = async (slug: string, includeInactive = false) => {
  const cat = await prisma.category.findUnique({
    where: { slug },
    include: {
      subcategories: {
        where: includeInactive ? undefined : { isActive: true },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      },
    },
  });
  // Treat a hidden category as not-found for public requests (same 404 as a
  // genuinely missing slug) rather than exposing that it exists but is inactive.
  if (!cat || (!includeInactive && !cat.isActive)) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }
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

  // Replacing the image: a new one has already been uploaded (imagePublicId
  // differs from what's on file) — clean up the old Cloudinary asset once the
  // swap is saved, and roll back the freshly uploaded one if the DB write fails.
  const isNewImage = data.imagePublicId !== undefined && data.imagePublicId !== existing.imagePublicId;

  let updated;
  try {
    updated = await prisma.category.update({
      where: { id },
      data:  payload,
      include: { subcategories: { orderBy: [{ order: "asc" }, { name: "asc" }] } },
    });
  } catch (error) {
    if (isNewImage && data.imagePublicId) await deleteImage(data.imagePublicId);
    throw error;
  }

  if (isNewImage && existing.imagePublicId) await deleteImage(existing.imagePublicId);
  return updated;
};

export const deleteCategory = async (id: string) => {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");

  // Subcategories cascade-delete at the DB level (schema onDelete: Cascade) —
  // grab their images first so Cloudinary cleanup still happens after the cascade.
  const subcategories = await prisma.subcategory.findMany({
    where: { categoryId: id },
    select: { imagePublicId: true },
  });

  await prisma.category.delete({ where: { id } });

  if (existing.imagePublicId) await deleteImage(existing.imagePublicId);
  await Promise.all(
    subcategories
      .filter((s): s is { imagePublicId: string } => !!s.imagePublicId)
      .map((s) => deleteImage(s.imagePublicId)),
  );
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
  opts?: { imageUrl?: string; imagePublicId?: string; isActive?: boolean; order?: number },
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
      name:          trimmed,
      slug,
      imageUrl:      opts?.imageUrl      ?? null,
      imagePublicId: opts?.imagePublicId ?? null,
      isActive:      opts?.isActive      ?? true,
      order:         opts?.order         ?? 0,
    },
  });
};

export const updateSubcategory = async (
  id: string,
  data: { name?: string; imageUrl?: string; imagePublicId?: string; isActive?: boolean; order?: number },
) => {
  const existing = await prisma.subcategory.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!existing) throw new AppError("Subcategory not found", 404, "SUB_NOT_FOUND");

  const payload: {
    name?: string; slug?: string;
    imageUrl?: string; imagePublicId?: string;
    isActive?: boolean; order?: number;
  } = {};

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
  if (data.imageUrl      !== undefined) payload.imageUrl      = data.imageUrl;
  if (data.imagePublicId !== undefined) payload.imagePublicId = data.imagePublicId;
  if (data.isActive      !== undefined) payload.isActive      = data.isActive;
  if (data.order         !== undefined) payload.order         = data.order;

  const isNewImage = data.imagePublicId !== undefined && data.imagePublicId !== existing.imagePublicId;

  let updated;
  try {
    updated = await prisma.subcategory.update({ where: { id }, data: payload });
  } catch (error) {
    if (isNewImage && data.imagePublicId) await deleteImage(data.imagePublicId);
    throw error;
  }

  if (isNewImage && existing.imagePublicId) await deleteImage(existing.imagePublicId);
  return updated;
};

export const deleteSubcategory = async (id: string) => {
  const existing = await prisma.subcategory.findUnique({ where: { id } });
  if (!existing) throw new AppError("Subcategory not found", 404, "SUB_NOT_FOUND");
  await prisma.subcategory.delete({ where: { id } });
  if (existing.imagePublicId) await deleteImage(existing.imagePublicId);
};
