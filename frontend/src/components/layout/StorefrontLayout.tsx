import { LayoutDashboard, LogOut, Menu, Printer, Receipt, RefreshCw, Search, ShoppingBag, User, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout as logoutApi } from "../../api/auth.api";
import { getCart } from "../../api/cart.api";
import { getFooterPages } from "../../api/pages.api";
import { useAuthStore } from "../../store/auth.store";
// Social icon SVGs (replaces react-icons/fa which is not installed)
const IconTelegram = () => <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.01 13.617 4.05 12.7c-.643-.204-.657-.643.136-.953l11.07-4.27c.534-.194 1.003.13.638.744z"/></svg>;
const IconInstagram = () => <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>;
const IconFacebook = () => <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
const IconYoutube = () => <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>;
const IconWhatsapp = () => <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>;
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
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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
          <div className="hidden flex-1 max-w-lg mx-auto sm:block">
            <label className="relative block w-full group">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Search className="h-4 w-4 text-amber-500 transition-colors group-focus-within:text-amber-600" />
              </span>
              <input
                id="storefront-search"
                ref={searchInputRef}
                type="text"
                value={topSearch}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search books, authors..."
                className="h-11 w-full rounded-full border-2 border-amber-200 bg-amber-50/60 pl-10 pr-20 text-sm outline-none transition-all placeholder:text-text-muted/60 focus:border-amber-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(251,191,36,0.18)]"
              />
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                <kbd className="rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-medium text-text-muted shadow-sm">Ctrl K</kbd>
              </span>
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
          <label className="relative block w-full group">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-4 w-4 text-amber-500 transition-colors group-focus-within:text-amber-600" />
            </span>
            <input type="text" value={topSearch} onChange={(e) => handleSearch(e.target.value)} placeholder="Search books..."
              className="h-10 w-full rounded-full border-2 border-amber-200 bg-amber-50/60 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-text-muted/60 focus:border-amber-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(251,191,36,0.18)]" />
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
              <SiteLogo size="md" />
              <p className="mt-3 text-sm text-text-muted leading-6">Your curated independent bookstore. Quality books, fast delivery, easy returns.</p>
             {/* Social Icons */}
  <div className="flex gap-4 mt-4 text-lg">
    
    <a href="https://t.me/Abcupsc" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 transition"><IconTelegram /></a>
    <a href="https://www.instagram.com/akash_books_centre_abc?igsh=MXFreGF0ZWc5eWxyYg%3D%3D" target="_blank" rel="noopener noreferrer" className="hover:text-pink-500 transition"><IconInstagram /></a>
    <a href="https://www.facebook.com/people/Akash-Book-Centre/pfbid02aQV79LPCAg9nvSGVnYmUE53skzXTo71L8DF1Cd7HqR6hFjZk7CvMFAfCpPEJkSnpl/?rdid=ligYbmRxIurPn6V7&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F1FdzyHsz5X%2F" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition"><IconFacebook /></a>
    <a href="https://www.youtube.com/@akashbookcentre9255" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition"><IconYoutube /></a>
    <a href="https://wa.me//+918810285500" target="_blank" rel="noopener noreferrer" className="hover:text-green-500 transition"><IconWhatsapp /></a>

  </div>
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
                <li>📧 akashbookcentre5500@gmail.com</li>
                <li>📞 +91 9990018434</li>
                <li>🕐 Mon-Sat: 10AM - 10PM</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
            <p className="text-xs text-text-muted">© {new Date().getFullYear()} Akash Book Centre. All rights reserved. Developed by <a href="https://virallstance.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline"> Virall Stance</a></p>
            {/* <div className="flex gap-4 text-xs text-text-muted">
              <Link to="/pages/privacy-policy" className="hover:text-text-primary transition-colors">Privacy</Link>
              <Link to="/pages/terms-and-conditions" className="hover:text-text-primary transition-colors">Terms</Link>
              <Link to="/returns" className="hover:text-text-primary transition-colors">Returns</Link>
            </div> */}
          </div>
        </div>
      </footer>
    </div>
  );
}
