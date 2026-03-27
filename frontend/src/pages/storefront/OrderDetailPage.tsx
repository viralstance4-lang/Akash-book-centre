import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { cancelOrder, getOrder } from "../../api/orders.api";
import type { ApiErrorResponse, OrderStatus, PaymentStatus } from "../../types";

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-violet-100 text-violet-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
};

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  SUCCESS: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-rose-100 text-rose-800",
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
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id!),
    enabled: Boolean(id),
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.setQueryData(["order", id], response);
    },
  });

  const order = data?.data;
  const paymentStatus = order?.payment?.status ?? "PENDING";
  const canCancel =
    order?.status === "PENDING" || order?.status === "CONFIRMED";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-40 animate-pulse rounded bg-white" />
        <div className="h-40 animate-pulse rounded-[1.75rem] bg-white" />
        <div className="h-64 animate-pulse rounded-[1.75rem] bg-white" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-4xl border border-dashed border-black/10 bg-[#fbf8f2] px-8 py-16 text-center">
        <h1 className="font-serif text-4xl text-text-primary">
          Order not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          We couldn&apos;t find this order in your account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/orders"
        className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={16} />
        Back to orders
      </Link>

      <section className="rounded-[1.75rem] border border-black/8 bg-[#fbf8f2] p-6 sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">
              Order details
            </p>
            <h1 className="mt-2 font-serif text-4xl text-text-primary">
              #{order.id.slice(0, 8)}
            </h1>
            <p className="mt-3 text-sm text-text-muted">
              Placed on {formatDate(order.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${ORDER_STATUS_STYLES[order.status]}`}
            >
              {order.status}
            </span>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${PAYMENT_STATUS_STYLES[paymentStatus]}`}
            >
              Payment {paymentStatus}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.9fr)]">
        <section className="space-y-4">
          {order.items.map((item) => (
            <article
              key={item.id}
              className="grid gap-4 rounded-3xl border border-black/8 bg-[#fbf8f2] p-4 sm:grid-cols-[5rem_minmax(0,1fr)_auto]"
            >
              <img
                src={item.book.coverImageUrl}
                alt={item.book.title}
                className="aspect-3/4 w-20 rounded-2xl object-cover"
              />
              <div className="min-w-0">
                <h2 className="font-serif text-2xl text-text-primary">
                  {item.book.title}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  {item.book.author}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-sm text-text-muted">Qty {item.quantity}</p>
                <p className="mt-2 font-serif text-xl text-[#8f2d22]">
                  {formatPrice(Number(item.priceAtPurchase) * item.quantity)}
                </p>
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-5">
          <div className="rounded-[1.75rem] border border-black/8 bg-[#fbf8f2] p-6">
            <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">
              Shipping address
            </p>
            <div className="mt-4 space-y-1 text-sm leading-6 text-text-primary">
              <p className="font-medium">{order.shippingAddress.name}</p>
              <p>{order.shippingAddress.phone}</p>
              <p>{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 ? (
                <p>{order.shippingAddress.line2}</p>
              ) : null}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state}
              </p>
              <p>{order.shippingAddress.pincode}</p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-black/8 bg-[#fbf8f2] p-6">
            <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">
              Payment
            </p>
            <p className="mt-3 text-sm text-text-muted">
              Status:{" "}
              <span className="font-medium text-text-primary">
                {paymentStatus}
              </span>
            </p>
            <p className="mt-2 font-serif text-2xl text-[#8f2d22]">
              {formatPrice(Number(order.totalAmount))}
            </p>
          </div>

          {canCancel ? (
            <button
              type="button"
              onClick={() => cancelOrderMutation.mutate(order.id)}
              disabled={cancelOrderMutation.isPending}
              className="inline-flex w-full items-center justify-center rounded-full bg-[#8f2d22] px-5 py-3 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-[#7a261d] disabled:translate-y-0 disabled:opacity-60"
            >
              {cancelOrderMutation.isPending ? "Cancelling..." : "Cancel Order"}
            </button>
          ) : null}

          {cancelOrderMutation.error ? (
            <div className="rounded-2xl border border-[#8f2d22]/15 bg-[#f8ece8] px-4 py-3 text-sm text-[#8f2d22]">
              {((cancelOrderMutation.error as AxiosError<ApiErrorResponse>)
                .response?.data?.message as string | undefined) ??
                "We couldn't cancel this order."}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
