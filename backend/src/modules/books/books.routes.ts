import multer from "multer";
import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import validate from "../../middleware/validate";
import {
  createBook, deleteBook, getBook, listBooks,
  updateBook, updateBookStock, addBookImages, deleteBookImage, reorderBookImages,
} from "./books.controller";
import { createBookSchema, updateBookSchema, updateStockSchema } from "./books.schema";

const booksRouter = Router();
export const adminBooksRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

booksRouter.get("/", listBooks);
booksRouter.get("/:id", getBook);

const adminMw = [authMiddleware, requireAdmin] as const;

// Main book CRUD
booksRouter.post("/", ...adminMw, upload.array("images", 10), validate(createBookSchema), createBook);
booksRouter.patch("/:id", ...adminMw, upload.single("coverImage"), validate(updateBookSchema), updateBook);
booksRouter.patch("/:id/stock", ...adminMw, validate(updateStockSchema), updateBookStock);
booksRouter.delete("/:id", ...adminMw, deleteBook);

// Multi-image routes
booksRouter.post("/:id/images", ...adminMw, upload.array("images", 10), addBookImages);
booksRouter.delete("/:id/images/:imageId", ...adminMw, deleteBookImage);
booksRouter.patch("/:id/images/reorder", ...adminMw, reorderBookImages);

adminBooksRouter.use(...adminMw);
adminBooksRouter.post("/", upload.array("images", 10), validate(createBookSchema), createBook);
adminBooksRouter.put("/:id", upload.single("coverImage"), validate(updateBookSchema), updateBook);
adminBooksRouter.patch("/:id", upload.single("coverImage"), validate(updateBookSchema), updateBook);
adminBooksRouter.patch("/:id/stock", validate(updateStockSchema), updateBookStock);
adminBooksRouter.delete("/:id", deleteBook);
adminBooksRouter.post("/:id/images", upload.array("images", 10), addBookImages);
adminBooksRouter.delete("/:id/images/:imageId", deleteBookImage);
adminBooksRouter.patch("/:id/images/reorder", reorderBookImages);

export default booksRouter;
