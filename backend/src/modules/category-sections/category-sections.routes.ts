import { Router } from "express";
import multer from "multer";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import * as ctrl from "./category-sections.controller";

const upload = multer({ storage: multer.memoryStorage() });

// Public
export const categorySectionsRouter = Router();
categorySectionsRouter.get("/", ctrl.listSections);
categorySectionsRouter.get("/:id", ctrl.getSectionWithBooks);

// Admin (must be registered under /api/v1/admin/category-sections)
export const adminCategorySectionsRouter = Router();
adminCategorySectionsRouter.use(authMiddleware, requireAdmin);
adminCategorySectionsRouter.get("/", ctrl.adminListSections);
adminCategorySectionsRouter.post("/", upload.single("image"), ctrl.createSection);
// reorder must come before /:id so it isn't swallowed as an id param
adminCategorySectionsRouter.patch("/reorder", ctrl.reorderSections);
adminCategorySectionsRouter.patch("/:id", upload.single("image"), ctrl.updateSection);
adminCategorySectionsRouter.delete("/:id", ctrl.deleteSection);
