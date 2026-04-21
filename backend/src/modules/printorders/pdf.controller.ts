import { type RequestHandler } from "express";
import prisma from "../../lib/prisma";
import AppError from "../../lib/AppError";

type Disposition = "inline" | "attachment";

/**
 * Fetches a PrintFile from Cloudinary (using the stored URL) and pipes it
 * to the client with proper Content-Type and Content-Disposition headers.
 *
 * The Cloudinary raw/image URL alone often serves the file as
 * application/octet-stream (no extension), causing browsers to download
 * it as ".file". By proxying here we can force application/pdf.
 */
const serveFile = async (
  fileId: string,
  disposition: Disposition,
  req: Express.Request & { user?: { id: string; role: string } },
  res: any,
  next: any,
) => {
  try {
    const file = await prisma.printFile.findUnique({
      where:   { id: fileId },
      include: { printOrder: { select: { userId: true } } },
    });

    if (!file) throw new AppError("File not found", 404, "FILE_NOT_FOUND");

    // Authorization: user owns the order OR is ADMIN
    const userId  = req.user?.id;
    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin && file.printOrder.userId !== userId) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }

    // Fetch the file from Cloudinary — follow redirects, buffer whole body
    const cloudRes = await fetch(file.fileUrl, { redirect: "follow" });
    if (!cloudRes.ok) {
      throw new AppError("Could not retrieve file from storage", 502, "FETCH_FAILED");
    }

    const buffer = Buffer.from(await cloudRes.arrayBuffer());

    // Sanitize filename: ensure .pdf extension
    const rawName   = file.originalName.trim() || "document";
    const fileName  = rawName.toLowerCase().endsWith(".pdf") ? rawName : `${rawName}.pdf`;
    const encoded   = encodeURIComponent(fileName);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${encoded}"; filename*=UTF-8''${encoded}`);
    res.setHeader("Content-Length", buffer.byteLength);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(buffer);
  } catch (error) {
    next(error);
  }
};

/** GET /api/v1/pdf/view/:fileId — opens PDF inline in browser */
export const viewFile: RequestHandler = (req, res, next) =>
  void serveFile(req.params.fileId, "inline", req as any, res, next);

/** GET /api/v1/pdf/download/:fileId — forces browser save-as dialog */
export const downloadFile: RequestHandler = (req, res, next) =>
  void serveFile(req.params.fileId, "attachment", req as any, res, next);
