import { type RequestHandler } from "express";
import { Readable } from "stream";
import prisma from "../../lib/prisma";
import AppError from "../../lib/AppError";
import { getFileStream } from "../../lib/s3";

type Disposition = "inline" | "attachment";

/**
 * Fetches a PrintFile's bytes — from S3 (authenticated GetObjectCommand, the
 * bucket is private) or from Cloudinary (legacy pre-migration orders, plain
 * fetch of the stored URL) depending on storageProvider — and pipes it to the
 * client with proper Content-Type and Content-Disposition headers.
 *
 * The Cloudinary raw/image URL alone often serves the file as
 * application/octet-stream (no extension), causing browsers to download
 * it as ".file". By proxying here we can force application/pdf either way.
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

    // Fetch the file's bytes as a stream from wherever it actually lives — piped
    // straight through to the client instead of buffered fully in server memory,
    // so the browser starts receiving bytes as soon as the source does.
    let stream: Readable;
    let contentLength: number | undefined;
    if (file.storageProvider === "S3") {
      const result = await getFileStream(file.filePublicId);
      stream = result.stream;
      contentLength = result.contentLength;
    } else {
      const cloudRes = await fetch(file.fileUrl, { redirect: "follow" });
      if (!cloudRes.ok || !cloudRes.body) {
        throw new AppError("Could not retrieve file from storage", 502, "FETCH_FAILED");
      }
      stream = Readable.fromWeb(cloudRes.body as import("stream/web").ReadableStream);
      const len = cloudRes.headers.get("content-length");
      if (len) contentLength = Number(len);
    }

    // Sanitize filename: ensure .pdf extension
    const rawName   = file.originalName.trim() || "document";
    const fileName  = rawName.toLowerCase().endsWith(".pdf") ? rawName : `${rawName}.pdf`;
    const encoded   = encodeURIComponent(fileName);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${encoded}"; filename*=UTF-8''${encoded}`);
    if (contentLength !== undefined) res.setHeader("Content-Length", contentLength);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");

    stream.on("error", (err) => {
      if (!res.headersSent) next(err);
      else res.destroy(err);
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/** GET /api/v1/pdf/view/:fileId — opens PDF inline in browser */
export const viewFile: RequestHandler = (req, res, next) =>
  void serveFile(req.params.fileId as string, "inline", req as any, res, next);

/** GET /api/v1/pdf/download/:fileId — forces browser save-as dialog */
export const downloadFile: RequestHandler = (req, res, next) =>
  void serveFile(req.params.fileId as string, "attachment", req as any, res, next);
