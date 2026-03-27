import type { Request, Response, NextFunction } from "express";
import * as featuredService from "./featured.service";

export const getFeatured = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, message: "Featured books", data: await featuredService.getFeaturedBooks() }); } catch (err) { next(err); }
};
export const addFeatured = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookId, order } = req.body;
    res.json({ success: true, message: "Book added to featured", data: await featuredService.addFeaturedBook(bookId, order ?? 0) });
  } catch (err) { next(err); }
};
export const removeFeatured = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookId = req.params["bookId"] as string;
    await featuredService.removeFeaturedBook(bookId);
    res.json({ success: true, message: "Book removed from featured", data: null });
  } catch (err) { next(err); }
};
