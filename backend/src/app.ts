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
import cartRouter from "./modules/cart/cart.routes";
import couponsRouter, { adminCouponsRouter } from "./modules/coupons/coupons.routes";
import featuredRouter, { adminFeaturedRouter } from "./modules/featured/featured.routes";
import genresRouter from "./modules/genres/genres.routes";
import ordersRouter, { adminOrdersRouter } from "./modules/orders/orders.routes";
import pagesRouter, { adminPagesRouter } from "./modules/pages/pages.routes";
import paymentsRouter from "./modules/payments/payments.routes";
import printRouter, { adminPrintRouter } from "./modules/printorders/printorders.routes";
import reviewsRouter, { adminReviewsRouter } from "./modules/reviews/reviews.routes";
import settingsRouter from "./modules/settings/settings.routes";
import usersRouter from "./modules/users/users.routes";

const app = express();

const cookieParser: RequestHandler = (req, res, next) => {
  void res;
  req.cookies = Object.fromEntries(
    (req.headers.cookie ?? "").split(";").map((c) => c.trim()).filter(Boolean).map((c) => {
      const i = c.indexOf("=");
      return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
    }),
  );
  next();
};

app.use(helmet());
app.use(globalRateLimiter);
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl) and the configured CORS origin
    if (!origin || origin === env.CORS_ORIGIN) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(cookieParser);
app.use(express.json());
app.use(pinoHttp({ logger }));

app.get("/health", (req, res) => { res.status(200).json({ status: "ok" }); });

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/books", booksRouter);
app.use("/api/v1/admin/books", adminBooksRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/genres", genresRouter);
app.use("/api/v1/admin/genres", genresRouter);
app.use("/api/v1/orders", ordersRouter);
app.use("/api/v1/admin/orders", adminOrdersRouter);
app.use("/api/v1/payments", paymentsRouter);
app.use("/api/v1/admin/users", usersRouter);
app.use("/api/v1/banners", bannersRouter);
app.use("/api/v1/admin/banners", adminBannersRouter);
app.use("/api/v1/coupons", couponsRouter);
app.use("/api/v1/admin/coupons", adminCouponsRouter);
app.use("/api/v1/print", printRouter);
app.use("/api/v1/admin/print", adminPrintRouter);
app.use("/api/v1/settings", settingsRouter);
app.use("/api/v1/reviews", reviewsRouter);
app.use("/api/v1/admin/reviews", adminReviewsRouter);
app.use("/api/v1/pages", pagesRouter);
app.use("/api/v1/admin/pages", adminPagesRouter);
app.use("/api/v1/featured", featuredRouter);
app.use("/api/v1/admin/featured", adminFeaturedRouter);

app.use(errorMiddleware);

export default app;
