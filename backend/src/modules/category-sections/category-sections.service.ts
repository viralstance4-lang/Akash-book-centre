import prisma from "../../lib/prisma";
import { uploadImage, deleteImage } from "../../lib/cloudinary";

const SUBCATEGORY_FIELDS = {
  id: true, name: true, slug: true, categoryId: true, imageUrl: true,
} as const;

// ── Public ───────────────────────────────────────────────────────────────────

export const listSections = async () => {
  const rows = await prisma.categorySection.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      heading: true,
      contentType: true,
      sortOrder: true,
      categoryId: true,
      subcategoryId: true,
      subcategory: { select: SUBCATEGORY_FIELDS },
      sectionSubcategories: {
        select: { subcategory: { select: SUBCATEGORY_FIELDS } },
      },
      sectionBooks: {
        orderBy: { sortOrder: "asc" },
        select: {
          book: {
            select: {
              id: true, title: true, author: true,
              price: true, comparePrice: true, coverImageUrl: true, stock: true,
            },
          },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    heading: r.heading,
    contentType: r.contentType as "category" | "manual",
    sortOrder: r.sortOrder,
    categoryId: r.categoryId,
    // junction table takes priority; fall back to legacy single subcategory
    subcategories:
      r.sectionSubcategories.length > 0
        ? r.sectionSubcategories.map((ss) => ss.subcategory)
        : r.subcategory
        ? [r.subcategory]
        : [],
    books: r.contentType === "manual" ? r.sectionBooks.map((sb) => sb.book) : [],
  }));
};

export const getSectionWithBooks = async (id: string) => {
  const section = await prisma.categorySection.findUnique({
    where: { id },
    include: {
      category:    { select: { id: true, name: true, slug: true } },
      subcategory: { select: { id: true, name: true, slug: true } },
      sectionSubcategories: {
        select: { subcategory: { select: SUBCATEGORY_FIELDS } },
      },
      sectionBooks: {
        orderBy: { sortOrder: "asc" },
        include: {
          book: {
            select: {
              id: true, title: true, author: true, price: true,
              comparePrice: true, coverImageUrl: true, stock: true,
              categoryId: true, subcategoryId: true, isbn: true,
              createdAt: true, updatedAt: true,
            },
          },
        },
      },
    },
  });

  if (!section) return null;

  let books: any[] = [];

  if (section.contentType === "manual") {
    books = section.sectionBooks.map((sb) => sb.book);
  } else {
    const subcategoryIds =
      section.sectionSubcategories.length > 0
        ? section.sectionSubcategories.map((ss) => ss.subcategory.id)
        : section.subcategoryId
        ? [section.subcategoryId]
        : [];

    const where: any = {};
    if (subcategoryIds.length > 0) {
      where.OR = [
        { subcategoryId: { in: subcategoryIds } },
        { bookSubcategories: { some: { subcategoryId: { in: subcategoryIds } } } },
      ];
    } else if (section.categoryId) {
      where.OR = [
        { categoryId: section.categoryId },
        { bookCategories: { some: { categoryId: section.categoryId } } },
      ];
    }
    if (Object.keys(where).length > 0) {
      books = await prisma.book.findMany({
        where,
        select: {
          id: true, title: true, author: true, price: true,
          comparePrice: true, coverImageUrl: true, stock: true,
          categoryId: true, subcategoryId: true, isbn: true,
          createdAt: true, updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  return { ...section, books };
};

// ── Admin ────────────────────────────────────────────────────────────────────

export const adminListSections = async () => {
  return prisma.categorySection.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      category:    { select: { id: true, name: true, slug: true } },
      subcategory: { select: { id: true, name: true, slug: true } },
      sectionSubcategories: {
        select: { subcategory: { select: SUBCATEGORY_FIELDS } },
      },
      sectionBooks: {
        orderBy: { sortOrder: "asc" },
        select: {
          bookId: true,
          book: { select: { id: true, title: true, coverImageUrl: true } },
        },
      },
      _count: { select: { sectionBooks: true } },
    },
  });
};

export const createSection = async (
  data: {
    heading: string;
    contentType: string;
    categoryId?: string | null;
    subcategoryIds?: string[];
    bookIds?: string[];
    sortOrder?: number;
  },
  file?: any,
) => {
  let imageUrl: string | null = null;
  let imagePublicId: string | null = null;
  if (file) {
    const uploaded = await uploadImage(file, "category-sections");
    imageUrl = uploaded.url;
    imagePublicId = uploaded.publicId;
  }

  const maxOrder = await prisma.categorySection.aggregate({ _max: { sortOrder: true } });
  const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  const subcategoryIds = data.subcategoryIds ?? [];

  return prisma.categorySection.create({
    data: {
      heading: data.heading,
      contentType: data.contentType ?? "category",
      categoryId: data.categoryId ?? null,
      subcategoryId: null,
      sortOrder: data.sortOrder ?? nextOrder,
      imageUrl,
      imagePublicId,
      sectionBooks:
        data.contentType === "manual" && data.bookIds?.length
          ? { create: data.bookIds.map((bookId, i) => ({ bookId, sortOrder: i })) }
          : undefined,
      sectionSubcategories:
        subcategoryIds.length > 0
          ? { create: subcategoryIds.map((subcategoryId) => ({ subcategoryId })) }
          : undefined,
    },
    include: {
      category:    { select: { id: true, name: true, slug: true } },
      subcategory: { select: { id: true, name: true, slug: true } },
      sectionSubcategories: { select: { subcategory: { select: SUBCATEGORY_FIELDS } } },
      sectionBooks: {
        select: {
          bookId: true,
          book: { select: { id: true, title: true, coverImageUrl: true } },
        },
      },
      _count: { select: { sectionBooks: true } },
    },
  });
};

export const updateSection = async (
  id: string,
  data: {
    heading?: string;
    contentType?: string;
    categoryId?: string | null;
    subcategoryIds?: string[];
    bookIds?: string[];
    sortOrder?: number;
    isActive?: boolean;
    removeImage?: boolean;
  },
  file?: any,
) => {
  const existing = await prisma.categorySection.findUnique({ where: { id } });
  if (!existing) throw new Error("Section not found");

  const updateData: any = { subcategoryId: null };
  if (data.heading !== undefined)     updateData.heading = data.heading;
  if (data.contentType !== undefined) updateData.contentType = data.contentType;
  if (data.categoryId !== undefined)  updateData.categoryId = data.categoryId;
  if (data.sortOrder !== undefined)   updateData.sortOrder = data.sortOrder;
  if (data.isActive !== undefined)    updateData.isActive = data.isActive;

  if (data.removeImage === true) {
    if (existing.imagePublicId) await deleteImage(existing.imagePublicId).catch(() => {});
    updateData.imageUrl = null;
    updateData.imagePublicId = null;
  }
  if (file) {
    if (existing.imagePublicId) await deleteImage(existing.imagePublicId).catch(() => {});
    const uploaded = await uploadImage(file, "category-sections");
    updateData.imageUrl = uploaded.url;
    updateData.imagePublicId = uploaded.publicId;
  }

  return prisma.$transaction(async (tx) => {
    if (data.bookIds !== undefined) {
      await tx.categorySectionBook.deleteMany({ where: { sectionId: id } });
      if (data.contentType === "manual" && data.bookIds.length > 0) {
        await tx.categorySectionBook.createMany({
          data: data.bookIds.map((bookId, i) => ({ sectionId: id, bookId, sortOrder: i })),
        });
      }
    }
    if (data.subcategoryIds !== undefined) {
      await tx.categorySectionSubcategory.deleteMany({ where: { sectionId: id } });
      if (data.subcategoryIds.length > 0) {
        await tx.categorySectionSubcategory.createMany({
          data: data.subcategoryIds.map((subcategoryId) => ({ sectionId: id, subcategoryId })),
        });
      }
    }
    return tx.categorySection.update({
      where: { id },
      data: updateData,
      include: {
        category:    { select: { id: true, name: true, slug: true } },
        subcategory: { select: { id: true, name: true, slug: true } },
        sectionSubcategories: { select: { subcategory: { select: SUBCATEGORY_FIELDS } } },
        sectionBooks: {
          select: {
            bookId: true,
            book: { select: { id: true, title: true, coverImageUrl: true } },
          },
        },
        _count: { select: { sectionBooks: true } },
      },
    });
  });
};

export const deleteSection = async (id: string) => {
  const existing = await prisma.categorySection.findUnique({ where: { id } });
  if (!existing) throw new Error("Section not found");
  if (existing.imagePublicId) await deleteImage(existing.imagePublicId).catch(() => {});
  return prisma.categorySection.delete({ where: { id } });
};

export const reorderSections = async (items: { id: string; sortOrder: number }[]) => {
  return prisma.$transaction(
    items.map(({ id, sortOrder }) =>
      prisma.categorySection.update({ where: { id }, data: { sortOrder } }),
    ),
  );
};
