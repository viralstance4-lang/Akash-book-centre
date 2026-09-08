import { Router } from "express";
import multer from "multer";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import validate from "../../middleware/validate";
import * as ctrl from "./category-sections.controller";
import { createCategorySectionSchema, updateCategorySectionSchema } from "./category-sections.schema";

const upload = multer({ storage: multer.memoryStorage() });

// Public
export const categorySectionsRouter = Router();
categorySectionsRouter.get("/", ctrl.listSections);
categorySectionsRouter.get("/:id", ctrl.getSectionWithBooks);

// Admin (must be registered under /api/v1/admin/category-sections)
export const adminCategorySectionsRouter = Router();
adminCategorySectionsRouter.use(authMiddleware, requireAdmin);
adminCategorySectionsRouter.get("/", ctrl.adminListSections);
// multer parses the multipart body into req.body (strings) + req.file before
// validate() coerces/checks it against the schema.
adminCategorySectionsRouter.post("/", upload.single("image"), validate(createCategorySectionSchema), ctrl.createSection);
// reorder must come before /:id so it isn't swallowed as an id param
adminCategorySectionsRouter.patch("/reorder", ctrl.reorderSections);
adminCategorySectionsRouter.patch("/:id", upload.single("image"), validate(updateCategorySectionSchema), ctrl.updateSection);
adminCategorySectionsRouter.delete("/:id", ctrl.deleteSection);
