import type { Request, Response, NextFunction } from "express";
import * as bannersService from "./banners.service";
import { createBannerSchema, updateBannerSchema } from "./banners.schema";

export const getBanners = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const banners = await bannersService.getAllBanners(true);
    res.json({ success: true, message: "Banners fetched", data: banners });
  } catch (err) { next(err); }
};

export const getAdminBanners = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const banners = await bannersService.getAllBanners(false);
    res.json({ success: true, message: "Banners fetched", data: banners });
  } catch (err) { next(err); }
};

export const createBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createBannerSchema.parse(req.body);
    const file = req.file as any;
    if (!file) { res.status(400).json({ success: false, message: "Image is required", code: "IMAGE_REQUIRED" }); return; }
    const banner = await bannersService.createBanner(data, file);
    res.status(201).json({ success: true, message: "Banner created", data: banner });
  } catch (err) { next(err); }
};

export const updateBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params["id"]);
    const data = updateBannerSchema.parse(req.body);
    const banner = await bannersService.updateBanner(id, data);
    res.json({ success: true, message: "Banner updated", data: banner });
  } catch (err) { next(err); }
};

export const deleteBanner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params["id"]);
    await bannersService.deleteBanner(id);
    res.json({ success: true, message: "Banner deleted", data: null });
  } catch (err) { next(err); }
};
