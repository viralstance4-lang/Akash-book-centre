import { BookOpen, FileText, Image, LayoutDashboard, Layers3, LogOut, Menu, MessageSquare, Receipt, Settings, Star, Tag, Users, X } from "lucide-react";
import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout as logoutApi } from "../../api/auth.api";
import { useAuthStore } from "../../store/auth.store";
import SiteLogo from "../ui/SiteLogo";

const navItems = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard, title: "Dashboard", exact: true },
  { label: "Books", path: "/admin/books", icon: BookOpen, title: "Books", exact: false },
  { label: "Orders", path: "/admin/orders", icon: Receipt, title: "Orders", exact: false },
  { label: "Users", path: "/admin/users", icon: Users, title: "Users", exact: false },
  { label: "Genres", path: "/admin/genres", icon: Layers3, title: "Genres", exact: false },
  { label: "Banners", path: "/admin/banners", icon: Image, title: "Banners", exact: false },
  { label: "Coupons", path: "/admin/coupons", icon: Tag, title: "Coupons", exact: false },
  { label: "Reviews", path: "/admin/reviews", icon: Star, title: "Reviews", exact: false },
  { label: "Featured", path: "/admin/featured", icon: MessageSquare, title: "Featured Section", exact: false },
  { label: "Pages", path: "/admin/pages", icon: FileText, title: "Pages", exact: false },
  { label: "Print Orders", path: "/admin/print-orders", icon: FileText, title: "Print Orders", exact: false },
  { label: "Settings", path: "/admin/settings", icon: Settings, title: "Settings", exact: false },
] as const;

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logoutStore = useAuthStore((s) => s.logout);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const currentNavItem = navItems.find((item) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path),
  ) ?? navItems[0];

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try { await logoutApi(); } catch {}
    finally { logoutStore(); navigate("/login", { replace: true }); setIsLoggingOut(false); }
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center justify-between shrink-0">
        <div>
          <SiteLogo size="sm" />
          <div className="mt-0.5 font-sans text-[0.65rem] uppercase tracking-[0.28em] text-text-muted">Admin Panel</div>
        </div>
        <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-full p-1.5 text-text-muted hover:bg-bg-outer lg:hidden"><X size={18} /></button>
      </div>
      <nav className="mt-5 flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
          return (
            <Link key={item.path} to={item.path} onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all ${isActive ? "bg-[#1d1a17] text-white shadow-md" : "text-text-muted hover:bg-white hover:text-text-primary"}`}>
              <Icon size={15} strokeWidth={isActive ? 2.4 : 2} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-black/10 pt-4">
        <p className="text-[0.65rem] uppercase tracking-[0.24em] text-text-muted">Signed in as</p>
        <p className="mt-1.5 truncate font-serif text-base text-text-primary">{user?.name ?? "Admin"}</p>
        <button type="button" onClick={handleLogout} disabled={isLoggingOut}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-text-primary transition-all hover:-translate-y-0.5 hover:bg-[#f5f1ea] disabled:opacity-70">
          <LogOut size={14} />{isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </>
  );

  return (
    <div className="h-screen overflow-hidden bg-[#f5f1ea] text-text-primary">
      <div className="flex h-screen">
        <aside className="sticky top-0 hidden h-screen w-[210px] flex-col border-r border-black/10 bg-[#fbf8f2] px-4 py-5 lg:flex">
          <SidebarContent />
        </aside>
        {isMobileMenuOpen && <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
        <div className={`fixed left-0 top-0 z-50 h-full w-60 bg-[#fbf8f2] shadow-2xl transition-transform duration-300 lg:hidden ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col px-4 py-5"><SidebarContent /></div>
        </div>
        <div className="flex h-screen flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-black/10 bg-[#f8f4ee]/90 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8 lg:py-5">
            <button type="button" onClick={() => setIsMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-text-muted hover:text-text-primary lg:hidden"><Menu size={15} /></button>
            <h1 className="font-serif text-2xl tracking-tight text-text-primary">{currentNavItem.title}</h1>
          </header>
          <main className="min-h-0 flex-1 overflow-hidden p-4 sm:p-6 lg:p-8"><Outlet /></main>
        </div>
      </div>
    </div>
  );
}
