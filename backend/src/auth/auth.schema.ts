import { z } from "zod";

export const registerSchema = z.object({
  name:     z.string().min(2, "Name must be at least 2 characters long"),
  email:    z.email("Please provide a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export const loginSchema = z.object({
  email:    z.email("Please provide a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

/** Request a one-time password (email only for now) */
export const requestOtpSchema = z.object({
  target: z.string().min(1, "Email is required"),
});

/** Verify an OTP code to complete login */
export const verifyOtpSchema = z.object({
  target: z.string().min(1, "Email is required"),
  code:   z.string().length(6, "OTP must be 6 digits"),
});

/** Verify email after registration */
export const verifyEmailSchema = z.object({
  email: z.email("Please provide a valid email address"),
  code:  z.string().length(6, "Verification code must be 6 digits"),
});

/** Resend verification email */
export const resendVerificationSchema = z.object({
  email: z.email("Please provide a valid email address"),
});
