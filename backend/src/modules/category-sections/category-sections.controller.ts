import type { Request, Response, NextFunction } from "express";
import * as svc from "./category-sections.service";

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
    const body = req.body;
    const bookIds = body.bookIds ? JSON.parse(body.bookIds) : [];
    const subcategoryIds = body.subcategoryIds ? JSON.parse(body.subcategoryIds) : [];
    const data = await svc.createSection(
      {
        heading: body.heading,
        contentType: body.contentType ?? "category",
        categoryId: body.categoryId || null,
        subcategoryIds,
        bookIds,
        sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
      },
      req.file,
    );
    res.status(201).json({ success: true, message: "Section created", data });
  } catch (err) { next(err); }
};

export const updateSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const bookIds = body.bookIds !== undefined ? JSON.parse(body.bookIds) : undefined;
    const subcategoryIds = body.subcategoryIds !== undefined ? JSON.parse(body.subcategoryIds) : undefined;
    const data = await svc.updateSection(
      req.params.id as string,
      {
        heading: body.heading,
        contentType: body.contentType,
        categoryId: body.categoryId !== undefined ? (body.categoryId || null) : undefined,
        subcategoryIds,
        bookIds,
        sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
        isActive: body.isActive !== undefined ? body.isActive === "true" : undefined,
        removeImage: body.removeImage === "true",
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
