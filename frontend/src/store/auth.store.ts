import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";

/** Inactivity timeout: 10 hours in milliseconds */
const SESSION_TTL_MS = 10 * 60 * 60 * 1000;

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** Unix timestamp (ms) of last activity — resets on API calls and user interaction */
  lastActivityAt: number | null;
  /** Set to "session_expired" when auto-logged-out due to inactivity; null otherwise */
  logoutReason: "session_expired" | null;
  setAuth: (user: User, accessToken: string) => void;
  /** Update only the access token and record now as last-activity time */
  updateAccessToken: (accessToken: string) => void;
  /** Record user interaction without changing any other auth state */
  touchActivity: () => void;
  logout: () => void;
  /** Clears auth state and marks the reason as session_expired so the login page shows a message */
  setSessionExpired: () => void;
  /** Returns true if the 10-hour inactivity window has expired */
  isSessionExpired: () => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:            null,
      accessToken:     null,
      isAuthenticated: false,
      lastActivityAt:  null,
      logoutReason:    null,

      setAuth: (user, accessToken) =>
        set({
          user,
          accessToken,
          isAuthenticated: true,
          lastActivityAt:  Date.now(),
          logoutReason:    null,
        }),

      updateAccessToken: (accessToken) =>
        set({ accessToken, lastActivityAt: Date.now() }),

      touchActivity: () =>
        set((state) =>
          state.isAuthenticated ? { lastActivityAt: Date.now() } : {},
        ),

      logout: () =>
        set({
          user:            null,
          accessToken:     null,
          isAuthenticated: false,
          lastActivityAt:  null,
          logoutReason:    null,
        }),

      setSessionExpired: () =>
        set({
          user:            null,
          accessToken:     null,
          isAuthenticated: false,
          lastActivityAt:  null,
          logoutReason:    "session_expired",
        }),

      isSessionExpired: () => {
        const { lastActivityAt } = get();
        if (!lastActivityAt) return false;
        return Date.now() - lastActivityAt > SESSION_TTL_MS;
      },
    }),
    { name: "auth-storage" },
  ),
);
