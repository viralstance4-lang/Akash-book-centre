import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "../components/layout/AdminLayout";
import StorefrontLayout from "../components/layout/StorefrontLayout";
import { getMe, refreshToken } from "../api/auth.api";
import AdminBannersPage from "../pages/admin/AdminBannersPage";
import AdminHomepageBuilderPage from "../pages/admin/AdminHomepageBuilderPage";
import AdminBooksPage from "../pages/admin/AdminBooksPage";
import AdminCategoriesPage from "../pages/admin/AdminCategoriesPage";
import AdminCouponsPage from "../pages/admin/AdminCouponsPage";
import AdminDashboardPage from "../pages/admin/AdminDashboardPage";
import AdminFeaturedPage from "../pages/admin/AdminFeaturedPage";
import AdminOrdersPage from "../pages/admin/AdminOrdersPage";
import AdminPagesPage from "../pages/admin/AdminPagesPage";
import AdminPrintOrdersPage from "../pages/admin/AdminPrintOrdersPage";
import AdminReturnsPage from "../pages/admin/AdminReturnsPage";
import AdminReviewsPage from "../pages/admin/AdminReviewsPage";
import AdminSettingsPage from "../pages/admin/AdminSettingsPage";
import AdminUsersPage from "../pages/admin/AdminUsersPage";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import VerifyEmailPage from "../pages/auth/VerifyEmailPage";
import NotFoundPage from "../pages/NotFoundPage";
import BookDetailPage from "../pages/storefront/BookDetailPage";
import CartPage from "../pages/storefront/CartPage";
import CategoriesPage from "../pages/storefront/CategoriesPage";
import CategoryPage from "../pages/storefront/CategoryPage";
import CheckoutPage from "../pages/storefront/CheckoutPage";
import DynamicPage from "../pages/storefront/DynamicPage";
import HomePage from "../pages/storefront/HomePage";
import OrderDetailPage from "../pages/storefront/OrderDetailPage";
import SubcategoryPage from "../pages/storefront/SubcategoryPage";
import OrdersPage from "../pages/storefront/OrdersPage";
import PrintBookPage from "../pages/storefront/PrintBookPage";
import ReturnsPage from "../pages/storefront/ReturnsPage";
import MyReturnsPage from "../pages/storefront/MyReturnsPage";
import { useAuthStore } from "../store/auth.store";
import AdminRoute from "./AdminRoute";
import ProtectedRoute from "./ProtectedRoute";
import { SessionRestoreSkeleton } from "../components/ui/SkeletonLoader";

/** 10-hour session check interval — every 5 minutes */
const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

export default function AppRouter() {
  const isAuthenticated  = useAuthStore((s) => s.isAuthenticated);
  const setAuth          = useAuthStore((s) => s.setAuth);
  const logout           = useAuthStore((s) => s.logout);
  const isSessionExpired = useAuthStore((s) => s.isSessionExpired);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isRouterVisible, setIsRouterVisible] = useState(false);

  // ── Initial auth restore ──────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      // If already authenticated, check session age before proceeding
      if (isAuthenticated) {
        if (isSessionExpired()) {
          logout();
        }
        if (isMounted) setIsAuthReady(true);
        return;
      }
      try {
        const refreshResponse = await refreshToken();
        const meResponse      = await getMe();
        if (isMounted) setAuth(meResponse.data, refreshResponse.data.accessToken);
      } catch {
        if (isMounted) logout();
      } finally {
        if (isMounted) setIsAuthReady(true);
      }
    };

    void initializeAuth();
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Periodic 10-hour session expiry check ─────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      if (isSessionExpired()) {
        // logout() sets isAuthenticated = false → ProtectedRoute redirects to /login.
        // Never use window.location.href here — it fires before React re-renders
        // and causes blank screen flashes on any page currently displayed.
        logout();
      }
    }, SESSION_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isAuthenticated, isSessionExpired, logout]);

  useEffect(() => {
    if (!isAuthReady) {
      setIsRouterVisible(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => setIsRouterVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [isAuthReady]);

  if (!isAuthReady) {
    return <SessionRestoreSkeleton />;
  }

  return (
    <div className={`transition-opacity duration-500 ease-out ${isRouterVisible ? "opacity-100" : "opacity-0"}`}>
      <BrowserRouter>
        <Routes>
          <Route element={<StorefrontLayout />}>
          <Route path="/"                       element={<HomePage />} />
          <Route path="/categories"             element={<CategoriesPage />} />
          <Route path="/category/:slug"         element={<CategoryPage />} />
          <Route path="/subcategory/:slug"       element={<SubcategoryPage />} />
          <Route path="/books/:id"              element={<BookDetailPage />} />
          <Route path="/print-book"     element={<PrintBookPage />} />
          <Route path="/returns"        element={<ReturnsPage />} />
          <Route path="/pages/:slug"    element={<DynamicPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/cart"         element={<CartPage />} />
            <Route path="/checkout"     element={<CheckoutPage />} />
            <Route path="/orders"       element={<OrdersPage />} />
            <Route path="/orders/:id"   element={<OrderDetailPage />} />
            <Route path="/my-returns"   element={<MyReturnsPage />} />
          </Route>
        </Route>

        <Route path="/login"         element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register"      element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
        <Route path="/verify-email"  element={<VerifyEmailPage />} />

        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin"              element={<AdminDashboardPage />} />
            <Route path="/admin/books"        element={<AdminBooksPage />} />
            <Route path="/admin/orders"       element={<AdminOrdersPage />} />
            <Route path="/admin/users"        element={<AdminUsersPage />} />
            <Route path="/admin/categories"   element={<AdminCategoriesPage />} />
            <Route path="/admin/banners"      element={<AdminBannersPage />} />
            <Route path="/admin/coupons"      element={<AdminCouponsPage />} />
            <Route path="/admin/reviews"      element={<AdminReviewsPage />} />
            <Route path="/admin/featured"     element={<AdminFeaturedPage />} />
            <Route path="/admin/pages"        element={<AdminPagesPage />} />
            <Route path="/admin/print-orders" element={<AdminPrintOrdersPage />} />
            <Route path="/admin/returns"      element={<AdminReturnsPage />} />
            <Route path="/admin/settings"          element={<AdminSettingsPage />} />
            <Route path="/admin/homepage-builder" element={<AdminHomepageBuilderPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  </div>
  );
}
