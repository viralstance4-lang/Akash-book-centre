import { Router } from "express";

import authMiddleware from "../middleware/auth.middleware";
import { authRateLimiter } from "../middleware/rateLimiter";
import {
  login,
  loginWithOtp,
  logout,
  me,
  refresh,
  register,
  resendVerification,
  sendOtp,
  verifyEmail,
} from "./auth.controller";
import {
  loginSchema,
  registerSchema,
  requestOtpSchema,
  resendVerificationSchema,
  verifyEmailSchema,
  verifyOtpSchema,
} from "./auth.schema";
import validate from "../middleware/validate";

const authRouter = Router();

// Password-based auth
authRouter.post("/register",             authRateLimiter, validate(registerSchema),             register);
authRouter.post("/verify-email",         authRateLimiter, validate(verifyEmailSchema),          verifyEmail);
authRouter.post("/resend-verification",  authRateLimiter, validate(resendVerificationSchema),   resendVerification);
authRouter.post("/login",                authRateLimiter, validate(loginSchema),                login);
authRouter.post("/refresh",              refresh);
authRouter.post("/logout",              authMiddleware,  logout);
authRouter.get("/me",                   authMiddleware,  me);

// OTP-based auth (rate-limited, max 10 requests per 15 min)
authRouter.post("/otp/request",  authRateLimiter, validate(requestOtpSchema), sendOtp);
authRouter.post("/otp/verify",   authRateLimiter, validate(verifyOtpSchema),  loginWithOtp);

export default authRouter;
