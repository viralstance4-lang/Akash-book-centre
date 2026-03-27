import prisma from "../../lib/prisma";

export const getFeaturedBooks = async () => {
  const featured = await prisma.featuredSection.findMany({ orderBy: { order: "asc" } });
  if (!featured.length) return [];
  const bookIds = featured.map((f) => f.bookId);
  const books = await prisma.book.findMany({ where: { id: { in: bookIds } }, include: { genre: true } });
  return featured.map((f) => books.find((b) => b.id === f.bookId)).filter(Boolean);
};

export const addFeaturedBook = async (bookId: string, order: number) => {
  const existing = await prisma.featuredSection.findFirst({ where: { bookId } });
  if (existing) return existing;
  return prisma.featuredSection.create({ data: { bookId, order } });
};

export const removeFeaturedBook = async (bookId: string) => {
  await prisma.featuredSection.deleteMany({ where: { bookId } });
};

export const reorderFeatured = async (items: { bookId: string; order: number }[]) => {
  await Promise.all(items.map((item) =>
    prisma.featuredSection.updateMany({ where: { bookId: item.bookId }, data: { order: item.order } })
  ));
};
