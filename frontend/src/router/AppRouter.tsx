import type { ReactNode } from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import AdminLayout from "../components/layout/AdminLayout";
import StorefrontLayout from "../components/layout/StorefrontLayout";
import { getMe, refreshToken } from "../api/auth.api";
import NotFoundPage from "../pages/NotFoundPage";
import { useAuthStore } from "../store/auth.store";
import AdminRoute from "./AdminRoute";
import ProtectedRoute from "./ProtectedRoute";
import { SessionRestoreSkeleton } from "../components/ui/SkeletonLoader";

// Every page below is only fetched when its route is actually visited, instead of
// all being bundled into one JS file that every visitor downloads up front — this
// is what previously shipped the whole admin dashboard (and PrintBookPage's heavy
// pdfjs-dist dependency) to every storefront visitor on first load.
const AdminBannersPage          = lazy(() => import("../pages/admin/AdminBannersPage"));
const AdminCategorySectionsPage = lazy(() => import("../pages/admin/AdminCategorySectionsPage"));
const AdminHomepageBuilderPage  = lazy(() => import("../pages/admin/AdminHomepageBuilderPage"));
const AdminMediaPage            = lazy(() => import("../pages/admin/AdminMediaPage"));
const AdminBooksPage            = lazy(() => import("../pages/admin/AdminBooksPage"));
const AdminCategoriesPage       = lazy(() => import("../pages/admin/AdminCategoriesPage"));
const AdminCouponsPage          = lazy(() => import("../pages/admin/AdminCouponsPage"));
const AdminDashboardPage        = lazy(() => import("../pages/admin/AdminDashboardPage"));
const AdminFeaturedPage         = lazy(() => import("../pages/admin/AdminFeaturedPage"));
const AdminOrdersPage           = lazy(() => import("../pages/admin/AdminOrdersPage"));
const AdminPagesPage            = lazy(() => import("../pages/admin/AdminPagesPage"));
const AdminPrintOrdersPage      = lazy(() => import("../pages/admin/AdminPrintOrdersPage"));
const AdminReturnsPage          = lazy(() => import("../pages/admin/AdminReturnsPage"));
const AdminReviewsPage          = lazy(() => import("../pages/admin/AdminReviewsPage"));
const AdminSettingsPage         = lazy(() => import("../pages/admin/AdminSettingsPage"));
const AdminShippingPage         = lazy(() => import("../pages/admin/AdminShippingPage"));
const AdminUsersPage            = lazy(() => import("../pages/admin/AdminUsersPage"));
const LoginPage                 = lazy(() => import("../pages/auth/LoginPage"));
const RegisterPage              = lazy(() => import("../pages/auth/RegisterPage"));
const VerifyEmailPage           = lazy(() => import("../pages/auth/VerifyEmailPage"));
const BookDetailPage            = lazy(() => import("../pages/storefront/BookDetailPage"));
const CartPage                  = lazy(() => import("../pages/storefront/CartPage"));
const CategoriesPage            = lazy(() => import("../pages/storefront/CategoriesPage"));
const CategoryPage              = lazy(() => import("../pages/storefront/CategoryPage"));
const CheckoutPage              = lazy(() => import("../pages/storefront/CheckoutPage"));
const DynamicPage               = lazy(() => import("../pages/storefront/DynamicPage"));
const HomePage                  = lazy(() => import("../pages/storefront/HomePage"));
const OrderDetailPage           = lazy(() => import("../pages/storefront/OrderDetailPage"));
const SubcategoryPage           = lazy(() => import("../pages/storefront/SubcategoryPage"));
const OrdersPage                = lazy(() => import("../pages/storefront/OrdersPage"));
const AllBooksPage              = lazy(() => import("../pages/storefront/AllBooksPage"));
const BestSellersPage           = lazy(() => import("../pages/storefront/BestSellersPage"));
const FeaturedBooksPage         = lazy(() => import("../pages/storefront/FeaturedBooksPage"));
const PrintBookPage             = lazy(() => import("../pages/storefront/PrintBookPage"));
const ReturnsPage               = lazy(() => import("../pages/storefront/ReturnsPage"));
const MyReturnsPage             = lazy(() => import("../pages/storefront/MyReturnsPage"));
const SectionBooksPage          = lazy(() => import("../pages/storefront/SectionBooksPage"));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#f5f1ea]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/15 border-t-[#1d1a17]" />
    </div>
  );
}

/** Inactivity check interval — every 5 minutes, fires setSessionExpired if idle 10 h */
const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

export default function AppRouter() {
  const isAuthenticated   = useAuthStore((s) => s.isAuthenticated);
  const setAuth           = useAuthStore((s) => s.setAuth);
  const logout            = useAuthStore((s) => s.logout);
  const setSessionExpired = useAuthStore((s) => s.setSessionExpired);
  const isSessionExpired  = useAuthStore((s) => s.isSessionExpired);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isRouterVisible, setIsRouterVisible] = useState(false);

  // ── Initial auth restore ──────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      // If already authenticated, check session age before proceeding
      if (isAuthenticated) {
        if (isSessionExpired()) {
          setSessionExpired();
        }
        if (isMounted) setIsAuthReady(true);
        return;
      }
      try {
        const refreshResponse = await refreshToken();
        const meResponse      = await getMe();
        if (isMounted) setAuth(meResponse.data, refreshResponse.data.accessToken);
      } catch (err) {
        if (isMounted) {
          const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
          if (code === "SESSION_EXPIRED") {
            setSessionExpired();
          } else {
            logout();
          }
        }
      } finally {
        if (isMounted) setIsAuthReady(true);
      }
    };

    void initializeAuth();
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Periodic inactivity expiry check ─────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      if (isSessionExpired()) {
        // setSessionExpired() clears auth and sets logoutReason so the login page
        // shows "Your session has expired." Never use window.location.href here —
        // it fires before React re-renders and causes blank screen flashes.
        setSessionExpired();
      }
    }, SESSION_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isAuthenticated, isSessionExpired, setSessionExpired]);

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
        <ScrollToTop />
        <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route element={<StorefrontLayout />}>
          <Route path="/"                       element={<HomePage />} />
          <Route path="/categories"             element={<CategoriesPage />} />
          <Route path="/category/:slug"         element={<CategoryPage />} />
          <Route path="/subcategory/:slug"       element={<SubcategoryPage />} />
          <Route path="/books/:id"              element={<BookDetailPage />} />
          <Route path="/all-books"       element={<AllBooksPage />} />
          <Route path="/best-sellers"    element={<BestSellersPage />} />
          <Route path="/featured"        element={<FeaturedBooksPage />} />
          <Route path="/print-book"     element={<PrintBookPage />} />
          <Route path="/returns"        element={<ReturnsPage />} />
          <Route path="/pages/:slug"    element={<DynamicPage />} />
          <Route path="/section/:id"    element={<SectionBooksPage />} />
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
            <Route path="/admin/media"        element={<AdminMediaPage />} />
            <Route path="/admin/returns"      element={<AdminReturnsPage />} />
            <Route path="/admin/shipping"         element={<AdminShippingPage />} />
            <Route path="/admin/settings"          element={<AdminSettingsPage />} />
            <Route path="/admin/homepage-builder"      element={<AdminHomepageBuilderPage />} />
            <Route path="/admin/category-sections"    element={<AdminCategorySectionsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  </div>
  );
}
