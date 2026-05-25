import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { getOrders } from "../../api/orders.api";
import type { OrderStatus } from "../../types";

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING:          "bg-amber-100 text-amber-800",
  CONFIRMED:        "bg-blue-100 text-blue-800",
  SHIPPED:          "bg-violet-100 text-violet-800",
  DELIVERED:        "bg-emerald-100 text-emerald-800",
  CANCELLED:        "bg-rose-100 text-rose-800",
  RETURN_REQUESTED: "bg-orange-100 text-orange-800",
  RETURNED:         "bg-gray-100 text-gray-700",
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page  = Number(searchParams.get("page") ?? "1");
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["orders", page, limit],
    queryFn:  () => getOrders(page, limit),
  });

  const orders     = data?.data.orders ?? [];
  const totalPages = data?.data.totalPages ?? 1;

  const setPage = (nextPage: number) => setSearchParams({ page: String(nextPage) });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-black/10 bg-[#fbf8f2] px-6 py-14 text-center">
        <h1 className="font-serif text-3xl text-text-primary">No orders yet</h1>
        <p className="mt-2 text-xs leading-5 text-text-muted">
          When you place your first order, it will appear here.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center rounded-full bg-[#1d1a17] px-5 py-2.5 text-sm text-white transition-all hover:-translate-y-0.5 hover:bg-black"
        >
          Browse books
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="text-[0.62rem] uppercase tracking-[0.28em] text-text-muted">Purchase history</p>
        <h1 className="mt-1 font-serif text-2xl text-text-primary sm:text-4xl">Orders</h1>
      </div>

      {/* Order cards */}
      <div className="space-y-3">
        {orders.map((order) => (
          <article
            key={order.id}
            className="rounded-2xl border border-black/8 bg-[#fbf8f2] p-3.5 sm:p-5"
          >
            {/* Mobile layout */}
            <div className="flex items-start justify-between gap-2 sm:hidden">
              {/* Left: id + date + status */}
              <div className="min-w-0">
                <p className="font-serif text-base text-text-primary">#{order.id.slice(0, 8)}</p>
                <p className="mt-0.5 text-[0.65rem] text-text-muted">{formatDate(order.createdAt)}</p>
                <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide ${ORDER_STATUS_STYLES[order.status]}`}>
                  {order.status}
                </span>
              </div>
              {/* Right: amount + view */}
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <p className="font-serif text-base text-[#8f2d22]">{formatPrice(Number(order.totalAmount))}</p>
                <p className="text-[0.62rem] text-text-muted">{order.itemCount ?? order.items.length} item{(order.itemCount ?? order.items.length) !== 1 ? "s" : ""}</p>
                <Link
                  to={`/orders/${order.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[#1d1a17] px-3 py-1.5 text-[0.65rem] text-white"
                >
                  View <ArrowRight size={11} />
                </Link>
              </div>
            </div>

            {/* Desktop layout */}
            <div className="hidden sm:grid sm:grid-cols-[minmax(0,1.1fr)_0.8fr_0.7fr_auto] sm:gap-4">
              <div className="min-w-0">
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">Order ID</p>
                <p className="mt-2 truncate font-serif text-2xl text-text-primary">#{order.id.slice(0, 8)}</p>
                <p className="mt-2 text-sm text-text-muted">{formatDate(order.createdAt)}</p>
              </div>
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">Status</p>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${ORDER_STATUS_STYLES[order.status]}`}>
                  {order.status}
                </span>
              </div>
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">Items</p>
                <p className="mt-2 text-lg text-text-primary">{order.itemCount ?? order.items.length}</p>
                <p className="mt-1 text-sm text-text-muted">
                  Payment {order.paymentStatus ?? order.payment?.status ?? "PENDING"}
                </p>
              </div>
              <div className="flex flex-col items-end justify-between">
                <p className="font-serif text-2xl text-[#8f2d22]">{formatPrice(Number(order.totalAmount))}</p>
                <Link
                  to={`/orders/${order.id}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-4 py-2 text-sm text-white transition-all hover:-translate-y-0.5 hover:bg-black"
                >
                  View <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-black/8 pt-4">
          <p className="text-xs text-text-muted">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-text-primary transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-45 sm:px-4 sm:py-2 sm:text-sm"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-text-primary transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-45 sm:px-4 sm:py-2 sm:text-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
