import type { Request, Response, NextFunction } from "express";
import AppError from "../../lib/AppError";
import * as mediaService from "./media.service";

const parseResourceType = (raw: unknown): "image" | "video" => (raw === "video" ? "video" : "image");
const str = (raw: unknown): string | undefined => (typeof raw === "string" && raw ? raw : undefined);

export const listMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resourceType = parseResourceType(req.query.type);
    const cursor   = str(req.query.cursor);
    const sort     = req.query.sort === "desc" ? "desc" : "asc";
    const dateFrom = str(req.query.from);
    const dateTo   = str(req.query.to);

    const [{ resources, nextCursor, totalCount }, inUseIds] = await Promise.all([
      mediaService.listMedia({ resourceType, nextCursor: cursor, sort, dateFrom, dateTo }),
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

    res.json({ success: true, message: "Media fetched", data: { items, nextCursor, totalCount } });
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
