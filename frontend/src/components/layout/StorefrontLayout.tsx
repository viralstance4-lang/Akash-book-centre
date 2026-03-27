import { LayoutDashboard, LogOut, Menu, Printer, Receipt, RefreshCw, Search, ShoppingBag, User, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout as logoutApi } from "../../api/auth.api";
import { getCart } from "../../api/cart.api";
import { getFooterPages } from "../../api/pages.api";
import { useAuthStore } from "../../store/auth.store";
import SiteLogo from "../ui/SiteLogo";

export default function StorefrontLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logoutStore = useAuthStore((s) => s.logout);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [topSearch, setTopSearch] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const { data: cartData } = useQuery({ queryKey: ["cart"], queryFn: getCart, enabled: isAuthenticated });
  const { data: footerPagesData } = useQuery({ queryKey: ["footer-pages"], queryFn: getFooterPages, staleTime: 1000 * 60 * 5 });
  const cartItemCount = cartData?.data?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const footerPages = footerPagesData?.data ?? [];

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("q") ?? "";
    setTopSearch((prev) => (prev.trim() === q.trim() && prev.length > q.length) ? prev : q);
  }, [location.search]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setIsProfileOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setIsMobileMenuOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try { await logoutApi(); } catch {}
    finally { logoutStore(); setIsProfileOpen(false); setIsMobileMenuOpen(false); setIsLoggingOut(false); navigate("/login"); }
  };

  const handleSearch = (value: string) => {
    setTopSearch(value);
    const params = new URLSearchParams(location.search);
    if (value) { params.set("q", value); } else { params.delete("q"); }
    navigate({ pathname: "/", search: params.toString() ? `?${params.toString()}` : "" }, { replace: location.pathname === "/" });
  };

  const navLinks = [
    { name: "Books", path: "/" },
    { name: "Orders", path: "/orders" },
    { name: "Returns", path: "/returns" },
    { name: "Print Book", path: "/print-book", highlight: true },
  ];

  return (
    <div className="min-h-screen bg-[#f5f1ea] font-sans text-text-primary flex flex-col">
      {/* Top Navbar */}
      <header className={`sticky top-0 z-40 w-full bg-white border-b border-border transition-shadow duration-300 ${isScrolled ? "shadow-md" : ""}`}>
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <SiteLogo />

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 md:flex ml-3">
            {navLinks.map((item) => {
              const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
              return (
                <Link key={item.path} to={item.path}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${item.highlight ? "bg-[#1d1a17] text-white hover:bg-black" : isActive ? "bg-[#f4efe7] text-text-primary" : "text-text-muted hover:bg-[#f8f5f0] hover:text-text-primary"}`}>
                  {item.highlight && <Printer size={13} />}
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Search */}
          <div className="hidden flex-1 max-w-md mx-auto sm:block">
            <label className="relative block w-full">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4"><Search className="h-4 w-4 text-text-muted" /></span>
              <input id="storefront-search" type="text" value={topSearch} onChange={(e) => handleSearch(e.target.value)} placeholder="Search books, authors..."
                className="h-10 w-full rounded-full border border-black/10 bg-[#f8f5f0] pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-text-muted/70 focus:border-black/20 focus:bg-white" />
            </label>
          </div>

          {/* Right Actions */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {user?.role === "ADMIN" && (
              <Link to="/admin" className="hidden items-center gap-1.5 rounded-full border border-black/10 bg-[#f8f4ee] px-3 py-2 text-xs font-medium text-text-primary hover:-translate-y-0.5 sm:inline-flex transition-all">
                <LayoutDashboard size={12} /> Admin
              </Link>
            )}
            <Link to="/cart" className="relative flex h-10 w-10 items-center justify-center rounded-full text-text-muted hover:bg-[#f4efe7] hover:text-text-primary transition-colors">
              <ShoppingBag size={19} />
              {cartItemCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">{cartItemCount}</span>}
            </Link>
            <Link to="/returns" className="hidden h-10 w-10 items-center justify-center rounded-full text-text-muted hover:bg-[#f4efe7] hover:text-text-primary transition-colors md:flex">
              <RefreshCw size={17} />
            </Link>
            <Link to="/orders" className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted hover:bg-[#f4efe7] hover:text-text-primary transition-colors md:hidden">
              <Receipt size={18} />
            </Link>

            {/* Profile */}
            <div className="relative" ref={profileMenuRef}>
              <button type="button" onClick={() => setIsProfileOpen((c) => !c)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted hover:bg-[#f4efe7] hover:text-text-primary transition-colors">
                <User size={19} />
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-2xl border border-black/10 bg-white p-4 shadow-xl sm:w-72">
                  {isAuthenticated && user ? (
                    <>
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">Signed in</p>
                      <p className="mt-1.5 font-serif text-xl text-text-primary">{user.name}</p>
                      <p className="mt-0.5 break-all text-xs text-text-muted">{user.email}</p>
                      {user.role === "ADMIN" && (
                        <Link to="/admin" onClick={() => setIsProfileOpen(false)}
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm text-text-primary hover:-translate-y-0.5 transition-all">
                          <LayoutDashboard size={14} /> Admin Dashboard
                        </Link>
                      )}
                      <button type="button" onClick={handleLogout} disabled={isLoggingOut}
                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1d1a17] px-4 py-2.5 text-sm text-white hover:bg-black transition-all disabled:opacity-60">
                        <LogOut size={14} />{isLoggingOut ? "Logging out..." : "Logout"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="font-serif text-xl text-text-primary">Welcome</p>
                      <p className="mt-1 text-sm text-text-muted">Sign in to access your cart and orders.</p>
                      <div className="mt-4 flex gap-2">
                        <Link to="/login" onClick={() => setIsProfileOpen(false)} className="inline-flex flex-1 items-center justify-center rounded-full bg-[#1d1a17] px-4 py-2.5 text-sm text-white">Login</Link>
                        <Link to="/register" onClick={() => setIsProfileOpen(false)} className="inline-flex flex-1 items-center justify-center rounded-full border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm text-text-primary">Register</Link>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <button type="button" onClick={() => setIsMobileMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted hover:bg-[#f4efe7] hover:text-text-primary transition-colors md:hidden">
              <Menu size={19} />
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="border-t border-border px-4 py-2.5 sm:hidden">
          <label className="relative block w-full">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4"><Search className="h-4 w-4 text-text-muted" /></span>
            <input type="text" value={topSearch} onChange={(e) => handleSearch(e.target.value)} placeholder="Search books..."
              className="h-10 w-full rounded-full border border-black/10 bg-[#f8f5f0] pl-10 pr-4 text-sm outline-none focus:border-black/20 focus:bg-white" />
          </label>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
      <div className={`fixed left-0 top-0 z-50 h-full w-72 bg-white shadow-2xl transition-transform duration-300 md:hidden ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-full flex-col px-5 py-6">
          <div className="flex items-center justify-between">
            <SiteLogo onClick={() => setIsMobileMenuOpen(false)} />
            <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-full p-2 text-text-muted hover:bg-[#f4efe7]"><X size={18} /></button>
          </div>
          <nav className="mt-6 flex flex-col gap-1.5">
            {navLinks.map((item) => {
              const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
              return (
                <Link key={item.path} to={item.path} onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${item.highlight ? "bg-[#1d1a17] text-white" : isActive ? "bg-[#f4efe7] text-text-primary" : "text-text-muted hover:bg-[#f4efe7] hover:text-text-primary"}`}>
                  {item.highlight && <Printer size={14} />}{item.name}
                </Link>
              );
            })}
            <Link to="/cart" onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-text-muted hover:bg-[#f4efe7] hover:text-text-primary transition-all">
              Cart
              {cartItemCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">{cartItemCount}</span>}
            </Link>
            {user?.role === "ADMIN" && (
              <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-text-muted hover:bg-[#f4efe7] hover:text-text-primary transition-all">
                <LayoutDashboard size={14} /> Admin Dashboard
              </Link>
            )}
          </nav>
          <div className="mt-auto border-t border-border pt-5">
            {isAuthenticated && user ? (
              <>
                <p className="text-xs text-text-muted">Signed in as</p>
                <p className="mt-1 truncate font-serif text-lg text-text-primary">{user.name}</p>
                <button type="button" onClick={handleLogout} disabled={isLoggingOut}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1d1a17] px-4 py-2.5 text-sm text-white hover:bg-black disabled:opacity-60 transition-all">
                  <LogOut size={14} />{isLoggingOut ? "Logging out..." : "Logout"}
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="flex-1 rounded-full bg-[#1d1a17] py-2.5 text-center text-sm text-white">Login</Link>
                <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} className="flex-1 rounded-full border border-black/10 py-2.5 text-center text-sm text-text-primary">Register</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Page Content */}
      <main className="flex-1 mx-auto w-full max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-white mt-8">
        <div className="mx-auto max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="lg:col-span-1">
              <SiteLogo size="sm" />
              <p className="mt-3 text-sm text-text-muted leading-6">Your curated independent bookstore. Quality books, fast delivery, easy returns.</p>
            </div>

            {/* Useful Links */}
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-primary">Useful Links</p>
              <ul className="space-y-2.5">
                {[
                  { label: "Books", path: "/" },
                  { label: "My Orders", path: "/orders" },
                  { label: "Cart", path: "/cart" },
                  { label: "Print Book", path: "/print-book" },
                  { label: "Returns", path: "/returns" },
                ].map(({ label, path }) => (
                  <li key={path}>
                    <Link to={path} className="text-sm text-text-muted hover:text-text-primary transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Information (dynamic pages) */}
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-primary">Information</p>
              <ul className="space-y-2.5">
                {footerPages.length > 0 ? (
                  footerPages.map((page) => (
                    <li key={page.id}>
                      <Link to={`/pages/${page.slug}`} className="text-sm text-text-muted hover:text-text-primary transition-colors">{page.title}</Link>
                    </li>
                  ))
                ) : (
                  <>
                    {[
                      { label: "Shipping Policy", path: "/pages/shipping-policy" },
                      { label: "Return & Refund Policy", path: "/returns" },
                      { label: "Cancellation Policy", path: "/pages/cancellation-policy" },
                      { label: "Privacy Policy", path: "/pages/privacy-policy" },
                      { label: "Terms & Conditions", path: "/pages/terms-and-conditions" },
                    ].map(({ label, path }) => (
                      <li key={path}>
                        <Link to={path} className="text-sm text-text-muted hover:text-text-primary transition-colors">{label}</Link>
                      </li>
                    ))}
                  </>
                )}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-primary">Contact</p>
              <ul className="space-y-2.5 text-sm text-text-muted">
                <li>📧 support@bucketlistbooks.in</li>
                <li>📞 +91 98765 43210</li>
                <li>🕐 Mon-Sat: 9AM - 6PM</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
            <p className="text-xs text-text-muted">© {new Date().getFullYear()} BucketList Books. All rights reserved.</p>
            <div className="flex gap-4 text-xs text-text-muted">
              <Link to="/pages/privacy-policy" className="hover:text-text-primary transition-colors">Privacy</Link>
              <Link to="/pages/terms-and-conditions" className="hover:text-text-primary transition-colors">Terms</Link>
              <Link to="/returns" className="hover:text-text-primary transition-colors">Returns</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
