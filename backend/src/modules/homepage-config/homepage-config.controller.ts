import type { Request, Response, NextFunction } from "express";
import * as service from "./homepage-config.service";
import type { HomepageSection } from "./homepage-config.schema";

export const getConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getHomepageConfig();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const updateConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("[HomepageConfig] updateConfig called");
    console.log("[HomepageConfig] Request body:", req.body);
    
    const { sections } = req.body as { sections: HomepageSection[] };
    
    if (!sections || !Array.isArray(sections)) {
      console.error("[HomepageConfig] Invalid sections payload:", sections);
      return res.status(400).json({ success: false, message: "sections must be an array", code: "INVALID_PAYLOAD" });
    }
    
    console.log(`[HomepageConfig] Updating ${sections.length} sections...`);
    const data = await service.updateHomepageConfig(sections);
    console.log("[HomepageConfig] Update successful, returning:", data);
    
    res.json({ success: true, message: "Homepage configuration saved.", data });
  } catch (err) {
    console.error("[HomepageConfig] updateConfig error:", err);
    next(err);
  }
};
