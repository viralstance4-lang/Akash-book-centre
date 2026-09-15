import type { Request, Response, NextFunction } from "express";
import * as svc from "./category-sections.service";
import type { CreateCategorySectionInput, UpdateCategorySectionInput } from "./category-sections.schema";

// ── Public ───────────────────────────────────────────────────────────────────

export const listSections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.listSections();
    res.json({ success: true, message: "OK", data });
  } catch (err) { next(err); }
};

export const getSectionWithBooks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.getSectionWithBooks(req.params.id as string);
    if (!data) return res.status(404).json({ success: false, message: "Section not found", code: "NOT_FOUND" });
    res.json({ success: true, message: "OK", data });
  } catch (err) { next(err); }
};

// ── Admin ────────────────────────────────────────────────────────────────────

export const adminListSections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.adminListSections();
    res.json({ success: true, message: "OK", data });
  } catch (err) { next(err); }
};

export const createSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // req.body has already been coerced + validated by createCategorySectionSchema
    // (booleans/numbers/JSON id-arrays parsed out of the multipart string fields).
    const body = req.body as CreateCategorySectionInput;
    const data = await svc.createSection(
      {
        heading: body.heading,
        contentType: body.contentType ?? "category",
        categoryId: body.categoryId ?? null,
        subcategoryIds: body.subcategoryIds ?? [],
        bookIds: body.bookIds ?? [],
        sortOrder: body.sortOrder,
      },
      req.file,
    );
    res.status(201).json({ success: true, message: "Section created", data });
  } catch (err) { next(err); }
};

export const updateSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // req.body has already been coerced + validated by updateCategorySectionSchema.
    const body = req.body as UpdateCategorySectionInput;
    const data = await svc.updateSection(
      req.params.id as string,
      {
        heading: body.heading,
        contentType: body.contentType,
        categoryId: body.categoryId,
        subcategoryIds: body.subcategoryIds,
        bookIds: body.bookIds,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
        removeImage: body.removeImage,
      },
      req.file,
    );
    res.json({ success: true, message: "Section updated", data });
  } catch (err) { next(err); }
};

export const deleteSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.deleteSection(req.params.id as string);
    res.json({ success: true, message: "Section deleted" });
  } catch (err) { next(err); }
};

export const reorderSections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = req.body as { items: { id: string; sortOrder: number }[] };
    await svc.reorderSections(items);
    res.json({ success: true, message: "Reordered" });
  } catch (err) { next(err); }
};
