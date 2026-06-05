import type { Request, Response, NextFunction } from "express";
import * as service from "./homepage-sections.service";

export const getPublic = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sections = await service.getEnabledSections();
    res.json({ success: true, data: sections });
  } catch (err) { next(err); }
};

export const getAll = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sections = await service.getAllSections();
    res.json({ success: true, data: sections });
  } catch (err) { next(err); }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const section = await service.createSection(req.body);
    res.status(201).json({ success: true, data: section });
  } catch (err) { next(err); }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const section = await service.updateSection(req.params.id as string, req.body);
    res.json({ success: true, data: section });
  } catch (err) { next(err); }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteSection(req.params.id as string);
    res.json({ success: true, message: "Section deleted" });
  } catch (err) { next(err); }
};

export const duplicate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const section = await service.duplicateSection(req.params.id as string);
    res.status(201).json({ success: true, data: section });
  } catch (err) { next(err); }
};

export const reorder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sections = await service.reorderSections(req.body.orderedIds);
    res.json({ success: true, data: sections });
  } catch (err) { next(err); }
};
