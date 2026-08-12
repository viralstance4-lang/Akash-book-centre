import multer from "multer";
import { Router } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  getCategoryBySlug,
  listAdminCategories,
  listCategories,
  listSubcategories,
  updateCategory,
  updateSubcategory,
} from "./categories.controller";

const upload  = multer({ storage: multer.memoryStorage() });
const adminMw = [authMiddleware, requireAdmin] as const;

// ── Public router ─────────────────────────────────────────────────────────────
export const categoriesRouter = Router();
categoriesRouter.get("/",              listCategories);
categoriesRouter.get("/subcategories", listSubcategories);
categoriesRouter.get("/:slug",         getCategoryBySlug);

// ── Admin router ──────────────────────────────────────────────────────────────
export const adminCategoriesRouter = Router();

// Categories CRUD
adminCategoriesRouter.get    ("/",    ...adminMw, listAdminCategories);
adminCategoriesRouter.post   ("/",    ...adminMw, upload.single("image"), createCategory);
adminCategoriesRouter.patch  ("/:id", ...adminMw, upload.single("image"), updateCategory);
adminCategoriesRouter.delete ("/:id", ...adminMw, deleteCategory);

// Subcategories — now accept an optional image file
adminCategoriesRouter.post   ("/:categoryId/subcategories", ...adminMw, upload.single("image"), createSubcategory);
adminCategoriesRouter.patch  ("/subcategories/:id",         ...adminMw, upload.single("image"), updateSubcategory);
adminCategoriesRouter.delete ("/subcategories/:id",         ...adminMw, deleteSubcategory);
