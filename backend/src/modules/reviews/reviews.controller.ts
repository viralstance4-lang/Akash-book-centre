import type { Request, Response, NextFunction } from "express";
import * as reviewsService from "./reviews.service";

export const createReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const bookId = req.params["bookId"] as string;
    const review = await reviewsService.createReview(userId, bookId, req.body);
    res.status(201).json({ success: true, message: "Review submitted for approval", data: review });
  } catch (err) { next(err); }
};

export const getBookReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookId = req.params["bookId"] as string;
    const reviews = await reviewsService.getBookReviews(bookId);
    const rating = await reviewsService.getBookRating(bookId);
    res.json({ success: true, message: "Reviews fetched", data: { reviews, rating } });
  } catch (err) { next(err); }
};

export const getAllReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reviews = await reviewsService.getAllReviews();
    res.json({ success: true, message: "Reviews fetched", data: reviews });
  } catch (err) { next(err); }
};

export const approveReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params["id"] as string;
    const review = await reviewsService.approveReview(id);
    res.json({ success: true, message: "Review approved", data: review });
  } catch (err) { next(err); }
};

export const deleteReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params["id"] as string;
    await reviewsService.deleteReview(id);
    res.json({ success: true, message: "Review deleted", data: null });
  } catch (err) { next(err); }
};
