import type { Request, Response, NextFunction } from "express";
import * as settingsService from "./settings.service";

export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsService.getSettings();
    res.json({ success: true, message: "Settings fetched", data: settings });
  } catch (err) { next(err); }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("[DEBUG] updateSettings controller called with body:", req.body);
    const file = req.file as any;
    const settings = await settingsService.updateLogoSettings(req.body, file);
    console.log("[DEBUG] Controller returning settings:", settings);
    res.json({ success: true, message: "Settings updated", data: settings });
  } catch (err) { 
    console.error("[DEBUG] updateSettings error:", err);
    next(err); 
  }
};
