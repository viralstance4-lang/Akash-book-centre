import { Prisma } from "@prisma/client";
import type { infer as ZodInfer } from "zod";
import AppError from "../../lib/AppError";
import { deleteImage, uploadImage } from "../../lib/cloudinary";
import prisma from "../../lib/prisma";
import type { getBooksQuerySchema } from "./books.schema";

type CreateBookInput = {
  title: string; author: string; isbn: string; description?: string;
  price: number; comparePrice?: number;
  categoryIds?: string[];
  subcategoryIds?: string[];
  stock: number; language?: string; publication?: string;
  isPrintBook?: boolean;
  allowStapleBinding?: boolean;
  allowSpiralBinding?: boolean;
  isOutOfStock?: boolean;
  height?: number;
  length?: number;
  breadth?: number;
  weight?: number;
};
type UpdateBookInput = Partial<Omit<CreateBookInput, "categoryIds" | "subcategoryIds">> & {
  categoryIds?: string[] | null;
  subcategoryIds?: string[] | null;
};
type UpdateStockInput = { quantity: number; type: "absolute" | "delta" };
type GetBooksQueryInput = ZodInfer<typeof getBooksQuerySchema>;
type FileLike = { buffer: Buffer };

// Lean include for list queries — skips images (not needed for cards/lists) and
// skips the redundant legacy FK relations (data is already in bookCategories/bookSubcategories).
// Dramatically reduces JOIN cost on paginated and high-limit list queries.
const bookListInclude = {
  bookCategories:    { include: { category: true }, orderBy: { category: { name: "asc" as const } } },
  bookSubcategories: { include: { subcategory: true }, orderBy: { subcategory: { name: "asc" as const } } },
} as const;

// Full include for single-book detail, create, update, stock, and image operations.
const bookInclude = {
  images:            { orderBy: { order: "asc" as const } },
  category:          true,
  subcategory:       true,
  bookCategories:    { include: { category: true }, orderBy: { category: { name: "asc" as const } } },
  bookSubcategories: { include: { subcategory: true }, orderBy: { subcategory: { name: "asc" as const } } },
} as const;

const getBookOrThrow = async (id: string) => {
  const book = await prisma.book.findUnique({ where: { id }, include: bookInclude });
  if (!book) throw new AppError("Book not found", 404, "BOOK_NOT_FOUND");
  return book;
};

const validateCategoryIds = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const found = await prisma.category.count({ where: { id: { in: ids } } });
  if (found !== ids.length)
    throw new AppError("One or more categories not found", 404, "CATEGORY_NOT_FOUND");
};

const validateSubcategoryIds = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const found = await prisma.subcategory.count({ where: { id: { in: ids } } });
  if (found !== ids.length)
    throw new AppError("One or more subcategories not found", 404, "SUBCATEGORY_NOT_FOUND");
};

export const getAllBooks = async (query: Partial<GetBooksQueryInput> = {}) => {
  const { q, category, subcategory, author, minPrice, maxPrice, page = 1, limit = 10 } = query;
  const where: Prisma.BookWhereInput = {};

  if (q?.trim()) {
    where.OR = [
      { title:       { contains: q.trim(), mode: "insensitive" } },
      { author:      { contains: q.trim(), mode: "insensitive" } },
      { isbn:        { contains: q.trim(), mode: "insensitive" } },
      { description: { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  // Filter via M2M join tables so products appear in ALL their assigned categories/subcategories
  if (category)    where.bookCategories    = { some: { category:    { slug: category    } } };
  if (subcategory) where.bookSubcategories = { some: { subcategory: { slug: subcategory } } };

  if (author) where.author = { contains: author, mode: "insensitive" };
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) (where.price as Prisma.DecimalFilter).gte = minPrice;
    if (maxPrice !== undefined) (where.price as Prisma.DecimalFilter).lte = maxPrice;
  }

  const [books, total] = await Promise.all([
    prisma.book.findMany({ where, include: bookListInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.book.count({ where }),
  ]);
  return { books, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getBookById = async (id: string) => getBookOrThrow(id);

export const createBook = async (data: CreateBookInput, files?: FileLike[], coverIndex = 0) => {
  if (!files || files.length === 0) throw new AppError("At least one image is required", 400, "COVER_IMAGE_REQUIRED");

  const categoryIds    = data.categoryIds    ?? [];
  const subcategoryIds = data.subcategoryIds ?? [];

  await validateCategoryIds(categoryIds);
  await validateSubcategoryIds(subcategoryIds);

  const existingBook = await prisma.book.findFirst({ where: { isbn: data.isbn } });
  if (existingBook) throw new AppError("Book already exists", 409, "BOOK_ALREADY_EXISTS");

  const safeIndex = Math.min(Math.max(coverIndex, 0), files.length - 1);
  const uploadedImages = await Promise.all(files.map((f) => uploadImage(f)));

  const reordered = [
    uploadedImages[safeIndex],
    ...uploadedImages.filter((_, i) => i !== safeIndex),
  ];

  try {
    return await prisma.book.create({
      data: {
        title: data.title, author: data.author, isbn: data.isbn, description: data.description,
        price: data.price, comparePrice: data.comparePrice ?? null,
        // Keep legacy FK synced to first selected category for backward compat
        categoryId:    categoryIds[0]    ?? null,
        subcategoryId: subcategoryIds[0] ?? null,
        stock: data.stock,
        language: data.language ?? "English", publication: data.publication ?? null,
        isPrintBook:        data.isPrintBook        ?? false,
        allowStapleBinding: data.allowStapleBinding ?? false,
        allowSpiralBinding: data.allowSpiralBinding ?? false,
        isOutOfStock:       data.isOutOfStock       ?? false,
        height: data.height ?? null,
        length: data.length ?? null,
        breadth: data.breadth ?? null,
        weight: data.weight ?? null,
        coverImageUrl: reordered[0].url, coverPublicId: reordered[0].publicId,
        images: {
          create: reordered.map((img, i) => ({
            imageUrl: img.url, publicId: img.publicId, order: i,
          })),
        },
        bookCategories: {
          create: categoryIds.map((categoryId) => ({ categoryId })),
        },
        bookSubcategories: {
          create: subcategoryIds.map((subcategoryId) => ({ subcategoryId })),
        },
      },
      include: bookInclude,
    });
  } catch (error) {
    await Promise.all(uploadedImages.map((img) => deleteImage(img.publicId).catch(() => {})));
    throw error;
  }
};

export const updateBook = async (id: string, data: UpdateBookInput, file?: FileLike) => {
  const existingBook = await getBookOrThrow(id);

  const categoryIds    = data.categoryIds    !== undefined ? (data.categoryIds    ?? []) : undefined;
  const subcategoryIds = data.subcategoryIds !== undefined ? (data.subcategoryIds ?? []) : undefined;

  if (categoryIds    !== undefined) await validateCategoryIds(categoryIds);
  if (subcategoryIds !== undefined) await validateSubcategoryIds(subcategoryIds);

  if (data.isbn && data.isbn !== existingBook.isbn) {
    const dup = await prisma.book.findFirst({ where: { isbn: data.isbn, NOT: { id } } });
    if (dup) throw new AppError("Book with this ISBN already exists", 409, "BOOK_ALREADY_EXISTS");
  }

  let uploadedImage: { url: string; publicId: string } | undefined;
  if (file) uploadedImage = await uploadImage(file);

  try {
    // Replace M2M category records if new selection was provided
    if (categoryIds !== undefined) {
      await prisma.bookCategory.deleteMany({ where: { bookId: id } });
      if (categoryIds.length > 0) {
        await prisma.bookCategory.createMany({
          data: categoryIds.map((categoryId) => ({ bookId: id, categoryId })),
          skipDuplicates: true,
        });
      }
    }
    if (subcategoryIds !== undefined) {
      await prisma.bookSubcategory.deleteMany({ where: { bookId: id } });
      if (subcategoryIds.length > 0) {
        await prisma.bookSubcategory.createMany({
          data: subcategoryIds.map((subcategoryId) => ({ bookId: id, subcategoryId })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await prisma.book.update({
      where: { id },
      data: {
        ...(data.title        !== undefined && { title:        data.title }),
        ...(data.author       !== undefined && { author:       data.author }),
        ...(data.isbn         !== undefined && { isbn:         data.isbn }),
        ...(data.description  !== undefined && { description:  data.description }),
        ...(data.price        !== undefined && { price:        data.price }),
        ...(data.comparePrice !== undefined && { comparePrice: data.comparePrice }),
        // Keep legacy FK in sync with first selected category
        ...(categoryIds    !== undefined && { categoryId:    categoryIds[0]    ?? null }),
        ...(subcategoryIds !== undefined && { subcategoryId: subcategoryIds[0] ?? null }),
        ...(data.stock        !== undefined && { stock:        data.stock }),
        ...(data.language     !== undefined && { language:     data.language }),
        ...(data.publication  !== undefined && { publication:  data.publication }),
        ...(data.isPrintBook        !== undefined && { isPrintBook:        data.isPrintBook }),
        ...(data.allowStapleBinding !== undefined && { allowStapleBinding: data.allowStapleBinding }),
        ...(data.allowSpiralBinding !== undefined && { allowSpiralBinding: data.allowSpiralBinding }),
        ...(data.isOutOfStock       !== undefined && { isOutOfStock:       data.isOutOfStock }),
        ...(data.height       !== undefined && { height:       data.height }),
        ...(data.length       !== undefined && { length:       data.length }),
        ...(data.breadth      !== undefined && { breadth:      data.breadth }),
        ...(data.weight       !== undefined && { weight:       data.weight }),
        ...(uploadedImage ? { coverImageUrl: uploadedImage.url, coverPublicId: uploadedImage.publicId } : {}),
      },
      include: bookInclude,
    });

    if (uploadedImage) await deleteImage(existingBook.coverPublicId);
    return updated;
  } catch (error) {
    if (uploadedImage) await deleteImage(uploadedImage.publicId);
    throw error;
  }
};

export const deleteBook = async (id: string) => {
  const existingBook = await getBookOrThrow(id);
  const [cartItemCount, orderItemCount] = await Promise.all([
    prisma.cartItem.count({ where: { bookId: id } }),
    prisma.orderItem.count({ where: { bookId: id } }),
  ]);
  if (cartItemCount > 0 || orderItemCount > 0)
    throw new AppError("Cannot delete a book that is present in carts or orders", 400, "BOOK_IN_USE");
  await prisma.book.delete({ where: { id } });
  // FeaturedSection.bookId has no FK/cascade, so it won't clean up on its own.
  await prisma.featuredSection.deleteMany({ where: { bookId: id } });
  await deleteImage(existingBook.coverPublicId);
};

export const updateBookStock = async (id: string, data: UpdateStockInput) => {
  const existingBook = await getBookOrThrow(id);
  const nextStock = data.type === "absolute" ? data.quantity : existingBook.stock + data.quantity;
  if (nextStock < 0) throw new AppError("Stock cannot be negative", 400, "INVALID_STOCK");
  return prisma.book.update({ where: { id }, data: { stock: nextStock }, include: bookInclude });
};

export const addBookImages = async (id: string, files: FileLike[]) => {
  await getBookOrThrow(id);
  const uploaded = await Promise.all(files.map((f) => uploadImage(f, "books")));
  const existing = await prisma.bookImage.findMany({ where: { bookId: id }, orderBy: { order: "asc" } });
  const startOrder = existing.length;
  await prisma.bookImage.createMany({
    data: uploaded.map((img, i) => ({ bookId: id, imageUrl: img.url, publicId: img.publicId, order: startOrder + i })),
  });
  return getBookWithImages(id);
};

export const deleteBookImage = async (bookId: string, imageId: string) => {
  const image = await prisma.bookImage.findFirst({ where: { id: imageId, bookId } });
  if (!image) throw new AppError("Image not found", 404, "IMAGE_NOT_FOUND");
  await prisma.bookImage.delete({ where: { id: imageId } });
  await deleteImage(image.publicId).catch(() => {});
  if (image.order === 0) {
    const nextImage = await prisma.bookImage.findFirst({ where: { bookId }, orderBy: { order: "asc" } });
    if (nextImage) {
      await prisma.book.update({ where: { id: bookId }, data: { coverImageUrl: nextImage.imageUrl, coverPublicId: nextImage.publicId } });
    }
  }
  return getBookWithImages(bookId);
};

export const reorderBookImages = async (bookId: string, imageOrders: { id: string; order: number }[]) => {
  await getBookOrThrow(bookId);
  await Promise.all(
    imageOrders.map((item) =>
      prisma.bookImage.updateMany({ where: { id: item.id, bookId }, data: { order: item.order } })
    )
  );
  const coverImage = imageOrders.find((i) => i.order === 0);
  if (coverImage) {
    const img = await prisma.bookImage.findUnique({ where: { id: coverImage.id } });
    if (img) {
      await prisma.book.update({ where: { id: bookId }, data: { coverImageUrl: img.imageUrl, coverPublicId: img.publicId } });
    }
  }
  return getBookWithImages(bookId);
};

const getBookWithImages = async (id: string) =>
  prisma.book.findUnique({ where: { id }, include: bookInclude });
