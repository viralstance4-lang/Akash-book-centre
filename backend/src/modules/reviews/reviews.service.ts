import prisma from "../../lib/prisma";
import AppError from "../../lib/AppError";

export const createReview = async (userId: string, bookId: string, data: { rating: number; title?: string; comment: string }) => {
  const existing = await prisma.review.findFirst({ where: { userId, bookId } });
  if (existing) throw new AppError("You have already reviewed this book", 409, "REVIEW_EXISTS");
  return prisma.review.create({ data: { userId, bookId, rating: data.rating, title: data.title, comment: data.comment, isApproved: false } });
};

export const getBookReviews = async (bookId: string) => {
  return prisma.review.findMany({
    where: { bookId, isApproved: true },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const getAllReviews = async () => {
  return prisma.review.findMany({
    include: { user: { select: { name: true, email: true } }, book: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const approveReview = async (id: string) => {
  return prisma.review.update({ where: { id }, data: { isApproved: true } });
};

export const deleteReview = async (id: string) => {
  return prisma.review.delete({ where: { id } });
};

export const getBookRating = async (bookId: string) => {
  const reviews = await prisma.review.findMany({ where: { bookId, isApproved: true }, select: { rating: true } });
  if (!reviews.length) return { average: 0, count: 0 };
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return { average: Math.round(avg * 10) / 10, count: reviews.length };
};
