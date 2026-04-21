import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, Image, Layers3, Receipt, Tag, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { getBooks } from "../../api/books.api";
import { getAdminOrders, getUsers } from "../../api/admin.api";
import { getCategories } from "../../api/categories.api";


const statusStyles: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  SHIPPED: "bg-violet-50 text-violet-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
};

const formatPrice = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const formatDate = (v: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(v));

const LOW_STOCK_THRESHOLD = 5;

export default function AdminDashboardPage() {
  const { data: booksData } = useQuery({ queryKey: ["admin-dashboard", "books"], queryFn: () => getBooks({ limit: 200 }) });
  const { data: ordersData } = useQuery({ queryKey: ["admin-dashboard", "orders"], queryFn: () => getAdminOrders(1, 5) });
  const { data: usersData } = useQuery({ queryKey: ["admin-dashboard", "users"], queryFn: () => getUsers(1, 1) });
  const { data: categoriesData } = useQuery({ queryKey: ["categories"], queryFn: getCategories });

  const allBooks = booksData?.data?.books ?? [];
  const lowStockBooks = allBooks.filter((b) => b.stock <= LOW_STOCK_THRESHOLD && b.stock > 0);
  const outOfStockBooks = allBooks.filter((b) => b.stock === 0);

  const stats = [
    { label: "Books", value: booksData?.data?.total ?? 0, icon: BookOpen, href: "/admin/books", color: "bg-blue-50 text-blue-600" },
    { label: "Orders", value: ordersData?.data?.total ?? 0, icon: Receipt, href: "/admin/orders", color: "bg-amber-50 text-amber-600" },
    { label: "Users", value: usersData?.data?.total ?? 0, icon: Users, href: "/admin/users", color: "bg-emerald-50 text-emerald-600" },
    { label: "Categories", value: categoriesData?.data?.length ?? 0, icon: Layers3, href: "/admin/categories", color: "bg-violet-50 text-violet-600" },
  ];

  const recentOrders = ordersData?.data?.orders ?? [];

  return (
    <div className="space-y-5">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} to={item.href}
              className="rounded-2xl border border-black/8 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-black/15 hover:shadow-sm">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${item.color}`}>
                <Icon size={18} />
              </div>
              <p className="mt-3 text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">{item.label}</p>
              <p className="mt-1 font-serif text-3xl text-text-primary">{item.value}</p>
            </Link>
          );
        })}
      </div>

      {/* Low Stock Alert */}
      {(lowStockBooks.length > 0 || outOfStockBooks.length > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-600" />
            <h3 className="font-medium text-amber-800">Stock Alerts</h3>
          </div>
          <div className="space-y-2">
            {outOfStockBooks.map((book) => (
              <div key={book.id} className="flex items-center justify-between rounded-xl bg-white border border-red-100 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{book.title}</p>
                  <p className="text-xs text-red-600">Out of stock</p>
                </div>
                <Link to="/admin/books" className="shrink-0 rounded-full bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 transition-colors">
                  Restock
                </Link>
              </div>
            ))}
            {lowStockBooks.map((book) => (
              <div key={book.id} className="flex items-center justify-between rounded-xl bg-white border border-amber-100 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{book.title}</p>
                  <p className="text-xs text-amber-600">Only {book.stock} left</p>
                </div>
                <Link to="/admin/books" className="shrink-0 rounded-full bg-amber-500 px-3 py-1.5 text-xs text-white hover:bg-amber-600 transition-colors">
                  Restock
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.85fr)]">
        {/* Recent Orders */}
        <div className="rounded-2xl border border-black/8 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl text-text-primary">Recent Orders</h3>
            <Link to="/admin/orders" className="text-sm text-text-muted hover:text-text-primary transition-colors">View all</Link>
          </div>
          <div className="space-y-3">
            {recentOrders.length > 0 ? recentOrders.map((order) => (
              <div key={order.id} className="flex flex-col gap-2 rounded-xl border border-black/8 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-text-primary text-sm">#{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-text-muted">{order.user?.name ?? "Customer"} · {formatDate(order.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[order.status] ?? "bg-black/5 text-text-primary"}`}>{order.status}</span>
                  <span className="text-sm font-medium text-text-primary">{formatPrice(Number(order.totalAmount))}</span>
                </div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-black/10 px-5 py-8 text-center text-sm text-text-muted">No orders yet.</div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-black/8 bg-white p-5">
          <h3 className="font-serif text-xl text-text-primary mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: "Manage Books & Stock", href: "/admin/books", icon: BookOpen },
              { label: "Manage Banners", href: "/admin/banners", icon: Image },
              { label: "Manage Coupons", href: "/admin/coupons", icon: Tag },
              { label: "View All Orders", href: "/admin/orders", icon: Receipt },
              { label: "Manage Categories", href: "/admin/categories", icon: Layers3 },
              { label: "Manage Users", href: "/admin/users", icon: Users },
            ].map(({ label, href, icon: Icon }) => (
              <Link key={href} to={href}
                className="flex items-center gap-3 rounded-xl border border-black/8 px-4 py-3 text-sm text-text-primary transition-all hover:-translate-y-0.5 hover:border-black/15 hover:bg-[#f8f4ee]">
                <Icon size={15} className="text-text-muted" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
