import type { Request, Response, NextFunction } from "express";
import AppError from "../../lib/AppError";
import * as mediaService from "./media.service";

const parseResourceType = (raw: unknown): "image" | "video" => (raw === "video" ? "video" : "image");

export const listMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resourceType = parseResourceType(req.query.type);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const [{ resources, nextCursor }, inUseIds] = await Promise.all([
      mediaService.listMedia(resourceType, cursor),
      mediaService.getInUsePublicIds(),
    ]);

    const items = resources.map((r) => ({
      publicId:     r.public_id,
      url:          r.secure_url,
      resourceType: r.resource_type,
      format:       r.format,
      bytes:        r.bytes,
      width:        r.width ?? null,
      height:       r.height ?? null,
      createdAt:    r.created_at,
      inUse:        inUseIds.has(r.public_id),
    }));

    res.json({ success: true, message: "Media fetched", data: { items, nextCursor } });
  } catch (err) { next(err); }
};

export const deleteMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const publicId = req.params.publicId as string;
    if (!publicId) throw new AppError("Missing publicId", 400, "MISSING_PUBLIC_ID");
    const resourceType = parseResourceType(req.query.type);

    await mediaService.deleteMediaAsset(publicId, resourceType);
    res.json({ success: true, message: "Media deleted" });
  } catch (err) { next(err); }
};
