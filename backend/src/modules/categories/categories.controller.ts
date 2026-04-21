import type { RequestHandler } from "express";
import { uploadImage } from "../../lib/cloudinary";
import {
  createCategory  as createCategoryService,
  createSubcategory as createSubcategoryService,
  deleteCategory  as deleteCategoryService,
  deleteSubcategory as deleteSubcategoryService,
  getAllCategories,
  getCategoryBySlug as getCategoryBySlugService,
  getSubcategoriesByCategoryId,
  updateCategory  as updateCategoryService,
  updateSubcategory as updateSubcategoryService,
} from "./categories.service";

// ─── Categories ───────────────────────────────────────────────────────────────

export const listCategories: RequestHandler = async (_req, res, next) => {
  try {
    const data = await getAllCategories();
    res.status(200).json({ success: true, message: "Categories fetched", data });
  } catch (err) {
    next(err);
  }
};

export const getCategoryBySlug: RequestHandler = async (req, res, next) => {
  try {
    const data = await getCategoryBySlugService(String(req.params["slug"]));
    res.status(200).json({ success: true, message: "Category fetched", data });
  } catch (err) {
    next(err);
  }
};

export const createCategory: RequestHandler = async (req, res, next) => {
  try {
    const { name, isActive, order } = req.body as {
      name: string;
      isActive?: string | boolean;
      order?: string | number;
    };
    const file = req.file as Express.Multer.File | undefined;

    let imageUrl: string | undefined;
    let imagePublicId: string | undefined;
    if (file) {
      const uploaded = await uploadImage(file, "categories");
      imageUrl      = uploaded.url;
      imagePublicId = uploaded.publicId;
    }

    const data = await createCategoryService(name, {
      imageUrl,
      imagePublicId,
      isActive: isActive === undefined ? true  : String(isActive) !== "false",
      order:    order    === undefined ? 0     : Number(order),
    });
    res.status(201).json({ success: true, message: "Category created", data });
  } catch (err) {
    next(err);
  }
};

export const updateCategory: RequestHandler = async (req, res, next) => {
  try {
    const id = String(req.params["id"]);
    const { name, isActive, order } = req.body as {
      name?: string; isActive?: string | boolean; order?: string | number;
    };
    const file = req.file as Express.Multer.File | undefined;

    let imageUrl: string | undefined;
    let imagePublicId: string | undefined;
    if (file) {
      const uploaded = await uploadImage(file, "categories");
      imageUrl      = uploaded.url;
      imagePublicId = uploaded.publicId;
    }

    const data = await updateCategoryService(id, {
      ...(name     !== undefined && { name }),
      ...(imageUrl !== undefined && { imageUrl, imagePublicId }),
      ...(isActive !== undefined && { isActive: String(isActive) !== "false" }),
      ...(order    !== undefined && { order: Number(order) }),
    });
    res.status(200).json({ success: true, message: "Category updated", data });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory: RequestHandler = async (req, res, next) => {
  try {
    await deleteCategoryService(String(req.params["id"]));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// ─── Subcategories ────────────────────────────────────────────────────────────

export const listSubcategories: RequestHandler = async (req, res, next) => {
  try {
    const { categoryId } = req.query as { categoryId?: string };
    if (!categoryId) {
      res.status(400).json({ success: false, message: "categoryId is required", code: "MISSING_CATEGORY_ID" });
      return;
    }
    const data = await getSubcategoriesByCategoryId(categoryId);
    res.status(200).json({ success: true, message: "Subcategories fetched", data });
  } catch (err) {
    next(err);
  }
};

export const createSubcategory: RequestHandler = async (req, res, next) => {
  try {
    const categoryId = String(req.params["categoryId"]);
    const { name, isActive, order } = req.body as {
      name: string; isActive?: string | boolean; order?: string | number;
    };
    const data = await createSubcategoryService(categoryId, name, {
      isActive: isActive === undefined ? true : String(isActive) !== "false",
      order:    order    === undefined ? 0    : Number(order),
    });
    res.status(201).json({ success: true, message: "Subcategory created", data });
  } catch (err) {
    next(err);
  }
};

export const updateSubcategory: RequestHandler = async (req, res, next) => {
  try {
    const id = String(req.params["id"]);
    const { name, isActive, order } = req.body as {
      name?: string; isActive?: string | boolean; order?: string | number;
    };
    const data = await updateSubcategoryService(id, {
      ...(name     !== undefined && { name }),
      ...(isActive !== undefined && { isActive: String(isActive) !== "false" }),
      ...(order    !== undefined && { order: Number(order) }),
    });
    res.status(200).json({ success: true, message: "Subcategory updated", data });
  } catch (err) {
    next(err);
  }
};

export const deleteSubcategory: RequestHandler = async (req, res, next) => {
  try {
    await deleteSubcategoryService(String(req.params["id"]));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
