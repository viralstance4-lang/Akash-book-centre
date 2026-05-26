import cors from "cors";
import express, { type RequestHandler } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import env from "./config/env";

import authRouter from "./auth/auth.routes";
import logger from "./config/logger";
import errorMiddleware from "./middleware/error.middleware";
import { globalRateLimiter } from "./middleware/rateLimiter";
import booksRouter, { adminBooksRouter } from "./modules/books/books.routes";
import bannersRouter, { adminBannersRouter } from "./modules/banners/banners.routes";
import { categoriesRouter, adminCategoriesRouter } from "./modules/categories/categories.routes";
import cartRouter from "./modules/cart/cart.routes";
import couponsRouter, { adminCouponsRouter } from "./modules/coupons/coupons.routes";
import featuredRouter, { adminFeaturedRouter } from "./modules/featured/featured.routes";
import homepageConfigRouter, { adminHomepageConfigRouter } from "./modules/homepage-config/homepage-config.routes";
import ordersRouter, { adminOrdersRouter } from "./modules/orders/orders.routes";
import pagesRouter, { adminPagesRouter } from "./modules/pages/pages.routes";
import paymentsRouter from "./modules/payments/payments.routes";
import printRouter, { adminPrintRouter } from "./modules/printorders/printorders.routes";
import pdfRouter from "./modules/printorders/pdf.routes";
import reviewsRouter, { adminReviewsRouter } from "./modules/reviews/reviews.routes";
import settingsRouter from "./modules/settings/settings.routes";
import shippingRouter, { adminShippingRouter } from "./modules/shipping/shipping.routes";
import usersRouter from "./modules/users/users.routes";
import returnsRouter, { adminReturnsRouter } from "./modules/returns/returns.routes";
import adminShiprocketRouter, { shiprocketWebhookRouter } from "./modules/shiprocket/shiprocket.routes";
import adminUtilsRouter from "./modules/admin/admin.routes";
import diagRouter from "./modules/admin/diag.routes";

const app = express();

// ── Minimal cookie parser (no dep) ─────────────────────────────────────────────
const cookieParser: RequestHandler = (req, _res, next) => {
  req.cookies = Object.fromEntries(
    (req.headers.cookie ?? "")
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const i = c.indexOf("=");
        return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
      }),
  );
  next();
};

// ── Request timeout middleware ─────────────────────────────────────────────────
// Prevents hung requests from blocking Render's dyno indefinitely.
// Fires a 503 if a handler doesn't respond within REQUEST_TIMEOUT_MS.
const requestTimeout: RequestHandler = (req, res, next) => {
  const ms = env.REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      logger.warn(
        { method: req.method, url: req.url },
        `[TIMEOUT] Request exceeded ${ms}ms`,
      );
      res.status(503).json({
        success: false,
        message: "Request timed out — please try again",
        code: "REQUEST_TIMEOUT",
      });
    }
  }, ms);

  // Clean up timer when the response completes (success or error)
  res.on("finish", () => clearTimeout(timer));
  res.on("close",  () => clearTimeout(timer));
  next();
};

// ── Middleware stack ───────────────────────────────────────────────────────────
app.use(helmet());
app.use(requestTimeout);
app.use(globalRateLimiter);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.CORS_ORIGIN.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(cookieParser);
app.use(express.json());
app.use(
  pinoHttp({
    logger,
    // Log slow requests as warnings
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    // Add response time to every log line
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} ${res.statusCode}`,
  }),
);

// ── Health & root ──────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Akash Book Centre API is running",
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRouter);

// ── Public / Storefront ───────────────────────────────────────────────────────
app.use("/api/v1/books",            booksRouter);
app.use("/api/v1/cart",             cartRouter);
app.use("/api/v1/orders",           ordersRouter);
app.use("/api/v1/payments",         paymentsRouter);
app.use("/api/v1/banners",          bannersRouter);
app.use("/api/v1/coupons",          couponsRouter);
app.use("/api/v1/print",            printRouter);
app.use("/api/v1/pdf",              pdfRouter);
app.use("/api/v1/settings",         settingsRouter);
app.use("/api/v1/shipping",         shippingRouter);
app.use("/api/v1/reviews",          reviewsRouter);
app.use("/api/v1/pages",            pagesRouter);
app.use("/api/v1/returns",          returnsRouter);
app.use("/api/v1/shiprocket",       shiprocketWebhookRouter);
app.use("/api/v1/featured",         featuredRouter);
app.use("/api/v1/homepage-config",  homepageConfigRouter);
app.use("/api/v1/categories",       categoriesRouter);

// ── Admin ─────────────────────────────────────────────────────────────────────
app.use("/api/v1/admin/books",            adminBooksRouter);
app.use("/api/v1/admin/orders",           adminOrdersRouter);
app.use("/api/v1/admin/users",            usersRouter);
app.use("/api/v1/admin/banners",          adminBannersRouter);
app.use("/api/v1/admin/coupons",          adminCouponsRouter);
app.use("/api/v1/admin/print",            adminPrintRouter);
app.use("/api/v1/admin/reviews",          adminReviewsRouter);
app.use("/api/v1/admin/pages",            adminPagesRouter);
app.use("/api/v1/admin/featured",         adminFeaturedRouter);
app.use("/api/v1/admin/homepage-config",  adminHomepageConfigRouter);
app.use("/api/v1/admin/categories",       adminCategoriesRouter);
app.use("/api/v1/admin/returns",          adminReturnsRouter);
app.use("/api/v1/admin/shipping",         adminShippingRouter);
app.use("/api/v1/admin/shiprocket",       adminShiprocketRouter);
app.use("/api/v1/admin",                  adminUtilsRouter);
app.use("/api/v1/diag",                   diagRouter);

app.use(errorMiddleware);

export default app;
