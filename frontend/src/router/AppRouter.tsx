import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "../components/layout/AdminLayout";
import StorefrontLayout from "../components/layout/StorefrontLayout";
import { getMe, refreshToken } from "../api/auth.api";
import AdminBannersPage from "../pages/admin/AdminBannersPage";
import AdminBooksPage from "../pages/admin/AdminBooksPage";
import AdminCouponsPage from "../pages/admin/AdminCouponsPage";
import AdminDashboardPage from "../pages/admin/AdminDashboardPage";
import AdminFeaturedPage from "../pages/admin/AdminFeaturedPage";
import AdminGenresPage from "../pages/admin/AdminGenresPage";
import AdminOrdersPage from "../pages/admin/AdminOrdersPage";
import AdminPagesPage from "../pages/admin/AdminPagesPage";
import AdminPrintOrdersPage from "../pages/admin/AdminPrintOrdersPage";
import AdminReviewsPage from "../pages/admin/AdminReviewsPage";
import AdminSettingsPage from "../pages/admin/AdminSettingsPage";
import AdminUsersPage from "../pages/admin/AdminUsersPage";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import NotFoundPage from "../pages/NotFoundPage";
import BookDetailPage from "../pages/storefront/BookDetailPage";
import CartPage from "../pages/storefront/CartPage";
import CheckoutPage from "../pages/storefront/CheckoutPage";
import DynamicPage from "../pages/storefront/DynamicPage";
import HomePage from "../pages/storefront/HomePage";
import OrderDetailPage from "../pages/storefront/OrderDetailPage";
import OrdersPage from "../pages/storefront/OrdersPage";
import PrintBookPage from "../pages/storefront/PrintBookPage";
import ReturnsPage from "../pages/storefront/ReturnsPage";
import { useAuthStore } from "../store/auth.store";
import AdminRoute from "./AdminRoute";
import ProtectedRoute from "./ProtectedRoute";

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

export default function AppRouter() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const initializeAuth = async () => {
      if (isAuthenticated) { if (isMounted) setIsAuthReady(true); return; }
      try {
        const refreshResponse = await refreshToken();
        const meResponse = await getMe();
        if (isMounted) setAuth(meResponse.data, refreshResponse.data.accessToken);
      } catch { if (isMounted) logout(); }
      finally { if (isMounted) setIsAuthReady(true); }
    };
    void initializeAuth();
    return () => { isMounted = false; };
  }, [isAuthenticated, logout, setAuth]);

  if (!isAuthReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f1ea]">
        <div className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm text-text-muted shadow-sm">
          Restoring your session...
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<StorefrontLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/books/:id" element={<BookDetailPage />} />
          <Route path="/print-book" element={<PrintBookPage />} />
          <Route path="/returns" element={<ReturnsPage />} />
          <Route path="/pages/:slug" element={<DynamicPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
          </Route>
        </Route>
        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/books" element={<AdminBooksPage />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/genres" element={<AdminGenresPage />} />
            <Route path="/admin/banners" element={<AdminBannersPage />} />
            <Route path="/admin/coupons" element={<AdminCouponsPage />} />
            <Route path="/admin/reviews" element={<AdminReviewsPage />} />
            <Route path="/admin/featured" element={<AdminFeaturedPage />} />
            <Route path="/admin/pages" element={<AdminPagesPage />} />
            <Route path="/admin/print-orders" element={<AdminPrintOrdersPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
