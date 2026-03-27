import { Prisma } from "@prisma/client";
import type { infer as ZodInfer } from "zod";
import AppError from "../../lib/AppError";
import { deleteImage, uploadImage } from "../../lib/cloudinary";
import prisma from "../../lib/prisma";
import type { getBooksQuerySchema } from "./books.schema";

type CreateBookInput = {
  title: string; author: string; isbn: string; description?: string;
  price: number; comparePrice?: number; genreId: string; stock: number;
  language?: string; publication?: string;
};
type UpdateBookInput = Partial<CreateBookInput>;
type UpdateStockInput = { quantity: number; type: "absolute" | "delta" };
type GetBooksQueryInput = ZodInfer<typeof getBooksQuerySchema>;
type FileLike = { buffer: Buffer };

const getGenreOrThrow = async (genreId: string) => {
  const genre = await prisma.genre.findUnique({ where: { id: genreId } });
  if (!genre) throw new AppError("Genre not found", 404, "GENRE_NOT_FOUND");
  return genre;
};

const getBookOrThrow = async (id: string) => {
  const book = await prisma.book.findUnique({
    where: { id },
    include: { genre: true, images: { orderBy: { order: "asc" } } },
  });
  if (!book) throw new AppError("Book not found", 404, "BOOK_NOT_FOUND");
  return book;
};

export const getAllBooks = async (query: Partial<GetBooksQueryInput> = {}) => {
  const { q, genre, author, minPrice, maxPrice, page = 1, limit = 10 } = query;
  const where: Prisma.BookWhereInput = {};
  if (q?.trim()) {
    where.OR = [
      { title: { contains: q.trim(), mode: "insensitive" } },
      { author: { contains: q.trim(), mode: "insensitive" } },
      { isbn: { contains: q.trim(), mode: "insensitive" } },
      { description: { contains: q.trim(), mode: "insensitive" } },
      { genre: { name: { contains: q.trim(), mode: "insensitive" } } },
    ];
  }
  if (genre) where.genre = { is: { slug: genre } };
  if (author) where.author = { contains: author, mode: "insensitive" };
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) (where.price as any).gte = minPrice;
    if (maxPrice !== undefined) (where.price as any).lte = maxPrice;
  }
  const [books, total] = await prisma.$transaction([
    prisma.book.findMany({ where, include: { genre: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.book.count({ where }),
  ]);
  return { books, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getBookById = async (id: string) => getBookOrThrow(id);

export const createBook = async (data: CreateBookInput, file?: FileLike) => {
  if (!file) throw new AppError("Cover image is required", 400, "COVER_IMAGE_REQUIRED");
  await getGenreOrThrow(data.genreId);
  const existingBook = await prisma.book.findFirst({ where: { isbn: data.isbn } });
  if (existingBook) throw new AppError("Book already exists", 409, "BOOK_ALREADY_EXISTS");
  const uploadedImage = await uploadImage(file);
  try {
    return await prisma.book.create({
      data: {
        title: data.title, author: data.author, isbn: data.isbn, description: data.description,
        price: data.price, comparePrice: data.comparePrice ?? null,
        genreId: data.genreId, stock: data.stock,
        language: data.language ?? "English", publication: data.publication ?? null,
        coverImageUrl: uploadedImage.url, coverPublicId: uploadedImage.publicId,
      },
      include: { genre: true },
    });
  } catch (error) {
    await deleteImage(uploadedImage.publicId);
    throw error;
  }
};

export const updateBook = async (id: string, data: UpdateBookInput, file?: FileLike) => {
  const existingBook = await getBookOrThrow(id);
  if (data.genreId) await getGenreOrThrow(data.genreId);
  if (data.isbn && data.isbn !== existingBook.isbn) {
    const dup = await prisma.book.findFirst({ where: { isbn: data.isbn, NOT: { id } } });
    if (dup) throw new AppError("Book already exists", 409, "BOOK_ALREADY_EXISTS");
  }
  let uploadedImage: { url: string; publicId: string } | undefined;
  if (file) uploadedImage = await uploadImage(file);
  try {
    const updatedBook = await prisma.book.update({
      where: { id },
      data: {
        title: data.title, author: data.author, isbn: data.isbn, description: data.description,
        price: data.price,
        ...(data.comparePrice !== undefined ? { comparePrice: data.comparePrice } : {}),
        genreId: data.genreId, stock: data.stock,
        language: data.language, publication: data.publication,
        coverImageUrl: uploadedImage?.url, coverPublicId: uploadedImage?.publicId,
      },
      include: { genre: true },
    });
    if (uploadedImage) await deleteImage(existingBook.coverPublicId);
    return updatedBook;
  } catch (error) {
    if (uploadedImage) await deleteImage(uploadedImage.publicId);
    throw error;
  }
};

export const deleteBook = async (id: string) => {
  const existingBook = await getBookOrThrow(id);
  const [cartItemCount, orderItemCount] = await prisma.$transaction([
    prisma.cartItem.count({ where: { bookId: id } }),
    prisma.orderItem.count({ where: { bookId: id } }),
  ]);
  if (cartItemCount > 0 || orderItemCount > 0) throw new AppError("Cannot delete a book that is present in carts or orders", 400, "BOOK_IN_USE");
  await prisma.book.delete({ where: { id } });
  await deleteImage(existingBook.coverPublicId);
};

export const updateBookStock = async (id: string, data: UpdateStockInput) => {
  const existingBook = await getBookOrThrow(id);
  const nextStock = data.type === "absolute" ? data.quantity : existingBook.stock + data.quantity;
  if (nextStock < 0) throw new AppError("Stock cannot be negative", 400, "INVALID_STOCK");
  return prisma.book.update({ where: { id }, data: { stock: nextStock }, include: { genre: true, images: { orderBy: { order: "asc" } } } });
};

// ─── Multi-image support ────────────────────────────────────────────────────

export const addBookImages = async (id: string, files: FileLike[]) => {
  await getBookOrThrow(id);
  const uploaded = await Promise.all(files.map((f) => uploadImage(f, "books")));
  // Get current max order
  const existing = await prisma.bookImage.findMany({ where: { bookId: id }, orderBy: { order: "asc" } });
  const startOrder = existing.length;
  await prisma.bookImage.createMany({
    data: uploaded.map((img, i) => ({
      bookId: id,
      imageUrl: img.url,
      publicId: img.publicId,
      order: startOrder + i,
    })),
  });
  return getBookWithImages(id);
};

export const deleteBookImage = async (bookId: string, imageId: string) => {
  const image = await prisma.bookImage.findFirst({ where: { id: imageId, bookId } });
  if (!image) throw new AppError("Image not found", 404, "IMAGE_NOT_FOUND");
  await prisma.bookImage.delete({ where: { id: imageId } });
  await deleteImage(image.publicId).catch(() => {});
  // If this was cover image (order 0), promote next image to cover
  if (image.order === 0) {
    const book = await prisma.book.findUnique({ where: { id: bookId } });
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
  // Update cover image to be the one with order=0
  const coverImage = imageOrders.find((i) => i.order === 0);
  if (coverImage) {
    const img = await prisma.bookImage.findUnique({ where: { id: coverImage.id } });
    if (img) {
      await prisma.book.update({ where: { id: bookId }, data: { coverImageUrl: img.imageUrl, coverPublicId: img.publicId } });
    }
  }
  return getBookWithImages(bookId);
};

const getBookWithImages = async (id: string) => {
  return prisma.book.findUnique({
    where: { id },
    include: { genre: true, images: { orderBy: { order: "asc" } } },
  });
};
