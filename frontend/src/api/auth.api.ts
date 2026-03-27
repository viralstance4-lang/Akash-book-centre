import api from "./axios";
import type { ApiSuccessResponse, User } from "../types";

type AuthPayload = {
  user: User;
  accessToken: string;
};

type RefreshPayload = {
  accessToken: string;
};

export const login = async (email: string, password: string) => {
  const response = await api.post<ApiSuccessResponse<AuthPayload>>("/auth/login", {
    email,
    password,
  });

  return response.data;
};

export const register = async (name: string, email: string, password: string) => {
  const response = await api.post<ApiSuccessResponse<AuthPayload>>("/auth/register", {
    name,
    email,
    password,
  });

  return response.data;
};

export const logout = async () => {
  const response = await api.post<ApiSuccessResponse<null>>("/auth/logout");

  return response.data;
};

export const refreshToken = async () => {
  const response = await api.post<ApiSuccessResponse<RefreshPayload>>("/auth/refresh");

  return response.data;
};

export const getMe = async () => {
  const response = await api.get<ApiSuccessResponse<User>>("/auth/me");

  return response.data;
};
