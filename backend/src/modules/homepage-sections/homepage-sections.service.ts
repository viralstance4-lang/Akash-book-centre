import prisma from "../../lib/prisma";
import type { CreateSectionInput, UpdateSectionInput } from "./homepage-sections.schema";

// ── Public: enabled sections sorted by order ──────────────────────────────────
export const getEnabledSections = () =>
  prisma.homepageSection.findMany({
    where:   { isEnabled: true },
    orderBy: { order: "asc" },
  });

// ── Admin: all sections sorted by order ───────────────────────────────────────
export const getAllSections = () =>
  prisma.homepageSection.findMany({ orderBy: { order: "asc" } });

// ── Create ────────────────────────────────────────────────────────────────────
export const createSection = async (data: CreateSectionInput) => {
  // Auto-assign order as last position if not provided
  if (data.order === undefined) {
    const last = await prisma.homepageSection.findFirst({ orderBy: { order: "desc" } });
    data.order = (last?.order ?? 0) + 1;
  }
  return prisma.homepageSection.create({
    data: {
      title:         data.title,
      subtitle:      data.subtitle ?? null,
      description:   data.description ?? null,
      type:          data.type,
      layoutType:    data.layoutType,
      bookFilter:    data.bookFilter,
      categoryId:    data.categoryId ?? null,
      subcategoryId: data.subcategoryId ?? null,
      isEnabled:     data.isEnabled,
      order:         data.order,
      config:        data.config as any,
    },
  });
};

// ── Update ────────────────────────────────────────────────────────────────────
export const updateSection = async (id: string, data: UpdateSectionInput) => {
  const update: any = {};
  if (data.title        !== undefined) update.title        = data.title;
  if (data.subtitle     !== undefined) update.subtitle     = data.subtitle ?? null;
  if (data.description  !== undefined) update.description  = data.description ?? null;
  if (data.type         !== undefined) update.type         = data.type;
  if (data.layoutType   !== undefined) update.layoutType   = data.layoutType;
  if (data.bookFilter   !== undefined) update.bookFilter   = data.bookFilter;
  if (data.categoryId   !== undefined) update.categoryId   = data.categoryId ?? null;
  if (data.subcategoryId !== undefined) update.subcategoryId = data.subcategoryId ?? null;
  if (data.isEnabled    !== undefined) update.isEnabled    = data.isEnabled;
  if (data.order        !== undefined) update.order        = data.order;
  if (data.config       !== undefined) update.config       = data.config as any;
  return prisma.homepageSection.update({ where: { id }, data: update });
};

// ── Delete ────────────────────────────────────────────────────────────────────
export const deleteSection = (id: string) =>
  prisma.homepageSection.delete({ where: { id } });

// ── Duplicate ─────────────────────────────────────────────────────────────────
export const duplicateSection = async (id: string) => {
  const src = await prisma.homepageSection.findUnique({ where: { id } });
  if (!src) throw new Error("Section not found");
  const last = await prisma.homepageSection.findFirst({ orderBy: { order: "desc" } });
  return prisma.homepageSection.create({
    data: {
      title:         `${src.title} (Copy)`,
      subtitle:      src.subtitle,
      description:   src.description,
      type:          src.type,
      layoutType:    src.layoutType,
      bookFilter:    src.bookFilter,
      categoryId:    src.categoryId,
      subcategoryId: src.subcategoryId,
      isEnabled:     false,
      order:         (last?.order ?? 0) + 1,
      config:        src.config as any,
    },
  });
};

// ── Batch reorder ─────────────────────────────────────────────────────────────
export const reorderSections = async (orderedIds: string[]) => {
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.homepageSection.update({ where: { id }, data: { order: idx + 1 } }),
    ),
  );
  return getAllSections();
};
