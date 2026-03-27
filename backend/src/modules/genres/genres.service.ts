import AppError from "../../lib/AppError";
import prisma from "../../lib/prisma";

const createSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getAllGenres = async () =>
  prisma.genre.findMany({
    orderBy: {
      name: "asc",
    },
  });

export const createGenre = async (name: string) => {
  const trimmedName = name.trim();
  const slug = createSlug(trimmedName);

  const existingGenre = await prisma.genre.findFirst({
    where: {
      OR: [
        {
          name: trimmedName,
        },
        {
          slug,
        },
      ],
    },
  });

  if (existingGenre) {
    throw new AppError("Genre already exists", 409, "GENRE_ALREADY_EXISTS");
  }

  return prisma.genre.create({
    data: {
      name: trimmedName,
      slug,
    },
  });
};

export const deleteGenre = async (id: string) => {
  const existingGenre = await prisma.genre.findUnique({
    where: {
      id,
    },
  });

  if (!existingGenre) {
    throw new AppError("Genre not found", 404, "GENRE_NOT_FOUND");
  }

  const bookCount = await prisma.book.count({
    where: {
      genreId: id,
    },
  });

  if (bookCount > 0) {
    throw new AppError(
      "Cannot delete genre with assigned books",
      400,
      "GENRE_HAS_BOOKS",
    );
  }

  await prisma.genre.delete({
    where: {
      id,
    },
  });
};
