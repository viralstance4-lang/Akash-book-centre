import rateLimit from "express-rate-limit";

const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;
const isDevelopment = process.env.NODE_ENV === "development";

export const authRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_IN_MS,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment,
  message: {
    success: false,
    message: "Too many attempts, please try again later",
    code: "TOO_MANY_REQUESTS",
  },
});

export const globalRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_IN_MS,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment,
  message: {
    success: false,
    message: "Too many requests, please try again later",
    code: "TOO_MANY_REQUESTS",
  },
});
