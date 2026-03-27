import type { Request, Response, NextFunction } from "express";
import * as pagesService from "./pages.service";

export const getAllPages = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, message: "Pages fetched", data: await pagesService.getAllPages() }); } catch (err) { next(err); }
};
export const getPage = async (req: Request, res: Response, next: NextFunction) => {
  try { const slug = req.params["slug"] as string; res.json({ success: true, message: "Page fetched", data: await pagesService.getActivePage(slug) }); } catch (err) { next(err); }
};
export const getFooterPages = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, message: "Footer pages fetched", data: await pagesService.getFooterPages() }); } catch (err) { next(err); }
};
export const createPage = async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json({ success: true, message: "Page created", data: await pagesService.createPage(req.body) }); } catch (err) { next(err); }
};
export const updatePage = async (req: Request, res: Response, next: NextFunction) => {
  try { const id = req.params["id"] as string; res.json({ success: true, message: "Page updated", data: await pagesService.updatePage(id, req.body) }); } catch (err) { next(err); }
};
export const deletePage = async (req: Request, res: Response, next: NextFunction) => {
  try { const id = req.params["id"] as string; await pagesService.deletePage(id); res.json({ success: true, message: "Page deleted", data: null }); } catch (err) { next(err); }
};
