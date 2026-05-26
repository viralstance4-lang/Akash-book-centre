import { ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";

import env from "../config/env";
import logger from "../config/logger";
import AppError from "../lib/AppError";

const errorMiddleware: ErrorRequestHandler = (err, req, res, _next) => {
  // ── AppError (our own controlled errors) ─────────────────────────────────────
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(
        { err, method: req.method, url: req.url, statusCode: err.statusCode },
        `[ERROR] ${err.message}`,
      );
    } else {
      logger.warn(
        { code: err.code, method: req.method, url: req.url, statusCode: err.statusCode },
        `[ERROR] ${err.message}`,
      );
    }
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  // ── Zod validation errors ─────────────────────────────────────────────────────
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      errors: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  // ── Multer file-upload errors ─────────────────────────────────────────────────
  if (err instanceof multer.MulterError) {
    res.status(400).json({
      success: false,
      message:
        err.code === "LIMIT_UNEXPECTED_FILE"
          ? `Unexpected file field: "${err.field}". Allowed fields: desktopImage, mobileImage.`
          : err.message,
      code: err.code,
    });
    return;
  }

  // ── CORS errors ───────────────────────────────────────────────────────────────
  if (err instanceof Error && err.message.startsWith("CORS blocked:")) {
    res.status(403).json({
      success: false,
      message: err.message,
      code: "CORS_BLOCKED",
    });
    return;
  }

  // ── JWT / auth library errors ─────────────────────────────────────────────────
  if (err instanceof Error && err.name === "JsonWebTokenError") {
    res.status(401).json({
      success: false,
      message: "Invalid token",
      code: "INVALID_TOKEN",
    });
    return;
  }
  if (err instanceof Error && err.name === "TokenExpiredError") {
    res.status(401).json({
      success: false,
      message: "Token expired",
      code: "TOKEN_EXPIRED",
    });
    return;
  }

  // ── Catch-all: unexpected 500 ─────────────────────────────────────────────────
  // Always log the full stack so Render logs capture the real cause.
  logger.error(
    {
      err,
      stack: err instanceof Error ? err.stack : undefined,
      method: req.method,
      url: req.url,
    },
    "[ERROR] Unhandled server error",
  );

  res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === "production"
        ? "Internal server error"
        : err instanceof Error
          ? err.message
          : "Internal server error",
    code: "INTERNAL_SERVER_ERROR",
  });
};

export default errorMiddleware;
