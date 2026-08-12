import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

import { useAuthStore } from "../store/auth.store";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1",
  withCredentials: true,
});

let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async () => {
  const response = await api.post<{
    success: true;
    message: string;
    data: { accessToken: string };
  }>("/auth/refresh");

  const { accessToken } = response.data.data;
  // updateAccessToken also updates lastActivityAt, so a successful token
  // refresh resets the 10-hour inactivity timer.
  useAuthStore.getState().updateAccessToken(accessToken);

  return accessToken;
};

api.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  // Disable caching for all requests
  config.headers["Cache-Control"] = "no-cache";
  config.headers["Pragma"] = "no-cache";

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Only /auth/me and /auth/logout carry a real access token that can go stale —
    // every other /auth/* endpoint (login, register, OTP, refresh itself, ...) is
    // public and a 401 there is a genuine auth failure, not an expired-token retry.
    const isRefreshableAuthCall =
      originalRequest.url?.includes("/auth/me") || originalRequest.url?.includes("/auth/logout");
    if (originalRequest.url?.includes("/auth/") && !isRefreshableAuthCall) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      await refreshPromise;

      return api(originalRequest);
    } catch (refreshError) {
      // If the backend explicitly signals session expiry, use setSessionExpired so
      // the login page can show "Your session has expired." Otherwise plain logout.
      const code = (refreshError as AxiosError<{ code?: string }>).response?.data?.code;
      if (code === "SESSION_EXPIRED") {
        useAuthStore.getState().setSessionExpired();
      } else {
        useAuthStore.getState().logout();
      }
      return Promise.reject(refreshError);
    }
  },
);

export default api;
