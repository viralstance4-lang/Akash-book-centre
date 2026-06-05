import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import env from "../config/env";

const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;
const isDevelopment = env.NODE_ENV === "development";

export const authRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_IN_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment,
  keyGenerator: (req) => ipKeyGenerator(req.ip) ?? "unknown",
  message: {
    success: false,
    message: "Too many attempts, please try again later",
    code: "TOO_MANY_REQUESTS",
  },
});

export const globalRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_IN_MS,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment,
  keyGenerator: (req) => ipKeyGenerator(req.ip) ?? "unknown",
  message: {
    success: false,
    message: "Too many requests, please try again later",
    code: "TOO_MANY_REQUESTS",
  },
});
