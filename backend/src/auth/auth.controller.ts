import { type RequestHandler } from "express";

import env from "../config/env";
import AppError from "../lib/AppError";
import {
  getMe,
  loginUser,
  logoutUser,
  otpLoginUser,
  refreshAccessToken,
  registerUser,
  resendAdminOtpCode,
  resendVerificationOtp,
  verifyAdminOtpAndLogin,
  verifyRegistrationEmail,
} from "./auth.service";
import { requestOtp } from "./otp/otp.service";

const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// Secure must be off in local dev (plain HTTP) but on in production (HTTPS-only) —
// browsers silently drop Secure cookies over HTTP, so hardcoding either value breaks
// one of the two environments.
const IS_PRODUCTION = env.NODE_ENV === "production";

// httpOnly: blocks JS/XSS access to the token. sameSite "lax": frontend and backend
// are served from the same origin in production (akashbookcentre.com, proxied via
// nginx — see frontend/nginx.conf) and are same-site in local dev (localhost on
// different ports), so "lax" covers both without needing cross-site cookie exceptions.
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "lax" as const,
};

const setRefreshCookie = (res: Parameters<RequestHandler>[1], token: string) => {
  res.cookie("refreshToken", token, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
  });
};

export const register: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken, ...data } = await registerUser(req.body);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail: RequestHandler = async (req, res, next) => {
  try {
    const { email, code } = req.body as { email: string; code: string };
    const { refreshToken, ...result } = await verifyRegistrationEmail(email, code);
    setRefreshCookie(res, refreshToken);
    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerification: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body as { email: string };
    const result = await resendVerificationOtp(email);
    res.status(200).json({ success: true, message: result.message, data: { expiresInMinutes: result.expiresInMinutes } });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const result = await loginUser(req.body);

    // Admin requires 2FA — return session token, do NOT issue JWT yet
    if ("requiresAdminOtp" in result) {
      res.status(200).json({
        success: true,
        message: "OTP sent to admin verification email.",
        data: result,
      });
      return;
    }

    // Regular user — issue tokens
    const { refreshToken, ...data } = result;
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ success: true, message: "Login successful", data });
  } catch (error) {
    next(error);
  }
};

export const verifyAdminOtp: RequestHandler = async (req, res, next) => {
  try {
    const { otpSessionToken, code } = req.body as { otpSessionToken: string; code: string };
    const { refreshToken, ...data } = await verifyAdminOtpAndLogin(otpSessionToken, code);
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ success: true, message: "Admin login successful.", data });
  } catch (error) {
    next(error);
  }
};

export const resendAdminOtp: RequestHandler = async (req, res, next) => {
  try {
    const { otpSessionToken } = req.body as { otpSessionToken: string };
    const result = await resendAdminOtpCode(otpSessionToken);
    res.status(200).json({ success: true, message: "New OTP sent.", data: result });
  } catch (error) {
    next(error);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

    const result = await refreshAccessToken(refreshToken);
    setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      message: "Access token refreshed successfully",
      data: { accessToken: result.accessToken },
    });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

    await logoutUser(refreshToken);

    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);

    res.status(200).json({ success: true, message: "Logout successful", data: null });
  } catch (error) {
    next(error);
  }
};

export const sendOtp: RequestHandler = async (req, res, next) => {
  try {
    const { target } = req.body as { target: string };
    const result = await requestOtp(target);
    res.status(200).json({ success: true, message: result.message, data: { expiresInMinutes: result.expiresInMinutes } });
  } catch (error) { next(error); }
};

export const loginWithOtp: RequestHandler = async (req, res, next) => {
  try {
    const { target, code } = req.body as { target: string; code: string };
    const { refreshToken, ...result } = await otpLoginUser(target, code);
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ success: true, message: "OTP login successful", data: result });
  } catch (error) { next(error); }
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    const user = await getMe(req.user.id);
    res.status(200).json({ success: true, message: "User fetched successfully", data: user });
  } catch (error) {
    next(error);
  }
};
