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
  resendAdminOtp,
  resendVerification,
  sendOtp,
  verifyAdminOtp,
  verifyEmail,
} from "./auth.controller";
import {
  adminResendOtpSchema,
  adminVerifyOtpSchema,
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

// Admin 2FA — called after password login succeeds for ADMIN role
authRouter.post("/admin/verify-otp", authRateLimiter, validate(adminVerifyOtpSchema), verifyAdminOtp);
authRouter.post("/admin/resend-otp", authRateLimiter, validate(adminResendOtpSchema), resendAdminOtp);

export default authRouter;
