import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { getOrders } from "../../api/orders.api";
import type { OrderStatus } from "../../types";

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-violet-100 text-violet-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
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
  const page = Number(searchParams.get("page") ?? "1");
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["orders", page, limit],
    queryFn: () => getOrders(page, limit),
  });

  const orders = data?.data.orders ?? [];
  const totalPages = data?.data.totalPages ?? 1;

  const setPage = (nextPage: number) => {
    setSearchParams({ page: String(nextPage) });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-3xl bg-white"
          />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-4xl border border-dashed border-black/10 bg-[#fbf8f2] px-8 py-16 text-center">
        <h1 className="font-serif text-4xl text-text-primary">No orders yet</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          When you place your first order, it will show up here with status and
          payment details.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-full bg-[#1d1a17] px-5 py-3 text-sm text-white transition-all hover:-translate-y-0.5 hover:bg-black"
        >
          Browse books
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-sans text-[0.72rem] uppercase tracking-[0.32em] text-text-muted">
          Purchase history
        </p>
        <h1 className="mt-2 font-serif text-4xl text-text-primary">Orders</h1>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <article
            key={order.id}
            className="grid gap-4 rounded-3xl border border-black/8 bg-[#fbf8f2] p-5 md:grid-cols-[minmax(0,1.1fr)_0.8fr_0.7fr_auto]"
          >
            <div className="min-w-0">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">
                Order ID
              </p>
              <p className="mt-2 truncate font-serif text-2xl text-text-primary">
                #{order.id.slice(0, 8)}
              </p>
              <p className="mt-2 text-sm text-text-muted">
                {formatDate(order.createdAt)}
              </p>
            </div>

            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">
                Status
              </p>
              <span
                className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${ORDER_STATUS_STYLES[order.status]}`}
              >
                {order.status}
              </span>
            </div>

            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">
                Items
              </p>
              <p className="mt-2 text-lg text-text-primary">
                {order.itemCount ?? order.items.length}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Payment{" "}
                {order.paymentStatus ?? order.payment?.status ?? "PENDING"}
              </p>
            </div>

            <div className="flex flex-col items-start justify-between md:items-end">
              <p className="font-serif text-2xl text-[#8f2d22]">
                {formatPrice(Number(order.totalAmount))}
              </p>
              <Link
                to={`/orders/${order.id}`}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-4 py-2 text-sm text-white transition-all hover:-translate-y-0.5 hover:bg-black"
              >
                View
                <ArrowRight size={15} />
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-black/8 pt-5">
        <p className="text-sm text-text-muted">
          Page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-text-primary transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-45"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-text-primary transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-45"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
