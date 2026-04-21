import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";

/** Hard session cap: 10 hours in milliseconds */
const SESSION_TTL_MS = 10 * 60 * 60 * 1000;

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** Unix timestamp (ms) when this session was created — used for auto-logout */
  sessionStartedAt: number | null;
  setAuth: (user: User, accessToken: string) => void;
  logout: () => void;
  /** Returns true if the 10-hour session window has expired */
  isSessionExpired: () => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:             null,
      accessToken:      null,
      isAuthenticated:  false,
      sessionStartedAt: null,

      setAuth: (user, accessToken) =>
        set({
          user,
          accessToken,
          isAuthenticated:  true,
          sessionStartedAt: Date.now(),
        }),

      logout: () =>
        set({
          user:             null,
          accessToken:      null,
          isAuthenticated:  false,
          sessionStartedAt: null,
        }),

      isSessionExpired: () => {
        const { sessionStartedAt } = get();
        if (!sessionStartedAt) return false;
        return Date.now() - sessionStartedAt > SESSION_TTL_MS;
      },
    }),
    { name: "auth-storage" },
  ),
);
