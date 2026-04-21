import { type RequestHandler } from "express";

import {
  createBook as createBookService,
  deleteBook as deleteBookService,
  getAllBooks,
  getBookById,
  updateBook as updateBookService,
  updateBookStock as updateBookStockService,
  addBookImages as addBookImagesService,
  deleteBookImage as deleteBookImageService,
  reorderBookImages as reorderBookImagesService,
} from "./books.service";
import { getBooksQuerySchema } from "./books.schema";

export const listBooks: RequestHandler = async (req, res, next) => {
  try {
    const query = getBooksQuerySchema.parse(req.query);
    const books = await getAllBooks(query);

    res.status(200).json({
      success: true,
      message: "Books fetched successfully",
      data: books,
    });
  } catch (error) {
    next(error);
  }
};

export const getBook: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const book = await getBookById(req.params.id);

    res.status(200).json({
      success: true,
      message: "Book fetched successfully",
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

export const createBook: RequestHandler = async (req, res, next) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    const coverIndex = Number(req.body.coverIndex ?? 0);
    const book = await createBookService(req.body, files, coverIndex);

    res.status(201).json({
      success: true,
      message: "Book created successfully",
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBook: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const book = await updateBookService(req.params.id, req.body, req.file);

    res.status(200).json({
      success: true,
      message: "Book updated successfully",
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBook: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    await deleteBookService(req.params.id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const updateBookStock: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const book = await updateBookStockService(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Book stock updated successfully",
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

export const addBookImages: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: "No images provided", code: "NO_IMAGES" });
      return;
    }
    const book = await addBookImagesService(req.params.id, files);
    res.status(201).json({ success: true, message: "Images added", data: book });
  } catch (error) { next(error); }
};

export const deleteBookImage: RequestHandler<{ id: string; imageId: string }> = async (req, res, next) => {
  try {
    const book = await deleteBookImageService(req.params.id, req.params.imageId);
    res.json({ success: true, message: "Image deleted", data: book });
  } catch (error) { next(error); }
};

export const reorderBookImages: RequestHandler<{ id: string }> = async (req, res, next) => {
  try {
    const { images } = req.body; // [{ id, order }]
    const book = await reorderBookImagesService(req.params.id, images);
    res.json({ success: true, message: "Images reordered", data: book });
  } catch (error) { next(error); }
};
