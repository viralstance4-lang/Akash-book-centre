import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "../store/auth.store";

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logoutReason    = useAuthStore((state) => state.logoutReason);
  const location        = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, sessionExpired: logoutReason === "session_expired" }}
      />
    );
  }

  return <Outlet />;
}
