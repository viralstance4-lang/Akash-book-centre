import api from "./axios";
import type { ApiSuccessResponse, User } from "../types";

type AuthPayload    = { user: User; accessToken: string };
type RefreshPayload = { accessToken: string };
type OtpPayload     = { expiresInMinutes: number };
type RegisterPayload = { needsVerification: true; email: string };

export const login = async (email: string, password: string) => {
  const r = await api.post<ApiSuccessResponse<AuthPayload>>("/auth/login", { email, password });
  return r.data;
};

export const register = async (name: string, email: string, password: string) => {
  const r = await api.post<ApiSuccessResponse<RegisterPayload>>("/auth/register", { name, email, password });
  return r.data;
};

/** Verify email OTP after registration — returns full auth tokens */
export const verifyEmailOtp = async (email: string, code: string) => {
  const r = await api.post<ApiSuccessResponse<AuthPayload>>("/auth/verify-email", { email, code });
  return r.data;
};

/** Resend the email verification OTP */
export const resendVerificationOtp = async (email: string) => {
  const r = await api.post<ApiSuccessResponse<OtpPayload>>("/auth/resend-verification", { email });
  return r.data;
};

export const logout = async () => {
  const r = await api.post<ApiSuccessResponse<null>>("/auth/logout");
  return r.data;
};

export const refreshToken = async () => {
  const r = await api.post<ApiSuccessResponse<RefreshPayload>>("/auth/refresh");
  return r.data;
};

export const getMe = async () => {
  const r = await api.get<ApiSuccessResponse<User>>("/auth/me");
  return r.data;
};

/** Request a 6-digit OTP sent to the given email */
export const requestOtp = async (target: string) => {
  const r = await api.post<ApiSuccessResponse<OtpPayload>>("/auth/otp/request", { target });
  return r.data;
};

/** Verify the OTP and receive auth tokens */
export const verifyOtp = async (target: string, code: string) => {
  const r = await api.post<ApiSuccessResponse<AuthPayload>>("/auth/otp/verify", { target, code });
  return r.data;
};
