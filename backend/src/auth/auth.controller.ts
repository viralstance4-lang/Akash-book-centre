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
  verifyRegistrationEmail,
  resendVerificationOtp,
} from "./auth.service";
import { requestOtp } from "./otp/otp.service";

const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const setRefreshCookie = (res: Parameters<RequestHandler>[1], token: string) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
  });
};

export const register: RequestHandler = async (req, res, next) => {
  try {
    const result = await registerUser(req.body);
    res.status(201).json({
      success: true,
      message: "Verification code sent to your email",
      data: result,
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
    const { refreshToken, ...result } = await loginUser(req.body);
    setRefreshCookie(res, refreshToken);
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
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

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
    });

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
