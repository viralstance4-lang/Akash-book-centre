import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useState } from "react";

import {
  getAdminOrder,
  getAdminOrders,
  updateOrderStatus,
} from "../../api/admin.api";
import type { ApiErrorResponse, OrderStatus } from "../../types";

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

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", page, status],
    queryFn: () => getAdminOrders(page, 10, status || undefined),
  });

  const { data: detailData } = useQuery({
    queryKey: ["admin-order", selectedOrderId],
    queryFn: () => getAdminOrder(selectedOrderId!),
    enabled: Boolean(selectedOrderId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: OrderStatus }) =>
      updateOrderStatus(id, nextStatus),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-order"] });
      setError("");
    },
    onError: (mutationError) => {
      const apiError = mutationError as AxiosError<ApiErrorResponse>;
      setError(
        apiError.response?.data?.message ?? "Unable to update order status.",
      );
    },
  });

  const orders = data?.data.orders ?? [];
  const totalPages = data?.data.totalPages ?? 1;
  const selectedOrder = detailData?.data;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_24rem]">
      <section className="rounded-[1.75rem] border border-black/8 bg-[#fbf8f2] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as OrderStatus | "");
              setPage(1);
            }}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-all focus:border-black/20 focus:shadow-sm"
          >
            <option value="">All statuses</option>
            {(
              [
                "PENDING",
                "CONFIRMED",
                "SHIPPED",
                "DELIVERED",
                "CANCELLED",
              ] as OrderStatus[]
            ).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <p className="text-sm text-text-muted">
            {data?.data.total ?? 0} orders
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {isLoading
            ? Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-[1.25rem] bg-white"
                />
              ))
            : orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setError("");
                  }}
                  className="grid w-full gap-4 rounded-[1.25rem] border border-black/8 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-black/15 md:grid-cols-[minmax(0,1fr)_0.7fr_0.8fr]"
                >
                  <div>
                    <p className="font-serif text-2xl text-text-primary">
                      #{order.id.slice(0, 8)}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      {order.user?.name ?? "Customer"} ·{" "}
                      {order.user?.email ?? ""}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${ORDER_STATUS_STYLES[order.status]}`}
                    >
                      {order.status}
                    </span>
                    <p className="mt-2 text-sm text-text-muted">
                      Items {order.itemCount ?? order.items.length}
                    </p>
                  </div>
                  <div className="md:text-right">
                    <p className="font-serif text-2xl text-[#8f2d22]">
                      {formatPrice(Number(order.totalAmount))}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      Payment{" "}
                      {order.paymentStatus ??
                        order.payment?.status ??
                        "PENDING"}
                    </p>
                  </div>
                </button>
              ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-black/8 pt-5">
          <p className="text-sm text-text-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm disabled:opacity-45"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm disabled:opacity-45"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <aside className="h-fit rounded-[1.75rem] border border-black/8 bg-[#fbf8f2] p-6">
        {selectedOrder ? (
          <>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">
              Selected order
            </p>
            <h2 className="mt-2 font-serif text-3xl text-text-primary">
              #{selectedOrder.id.slice(0, 8)}
            </h2>
            <p className="mt-3 text-sm text-text-muted">
              {selectedOrder.user?.name ?? "Customer"} ·{" "}
              {selectedOrder.user?.email ?? ""}
            </p>

            <div className="mt-5 rounded-[1.1rem] bg-white p-4">
              <p className="mb-2 text-[0.68rem] uppercase tracking-[0.2em] text-text-muted">
                Shipping Address
              </p>
              {selectedOrder.shippingAddress ? (
                <div className="text-sm text-text-primary">
                  <p className="font-medium">
                    {selectedOrder.shippingAddress.name}
                  </p>
                  <p>{selectedOrder.shippingAddress.line1}</p>
                  {selectedOrder.shippingAddress.line2 && (
                    <p>{selectedOrder.shippingAddress.line2}</p>
                  )}
                  <p>
                    {selectedOrder.shippingAddress.city},{" "}
                    {selectedOrder.shippingAddress.state}{" "}
                    {selectedOrder.shippingAddress.pincode}
                  </p>
                  <p className="mt-1 text-text-muted">
                    Phone: {selectedOrder.shippingAddress.phone}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-muted">No address provided</p>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {selectedOrder.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.1rem] bg-white p-3 text-sm"
                >
                  <p className="font-medium text-text-primary">
                    {item.book.title}
                  </p>
                  <p className="mt-1 text-text-muted">
                    Qty {item.quantity} ·{" "}
                    {formatPrice(Number(item.priceAtPurchase))}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1.1rem] bg-white p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.2em] text-text-muted">
                Advance status
              </p>
              {error ? (
                <div className="mt-3 rounded-2xl border border-[#8f2d22]/15 bg-[#f8ece8] px-4 py-3 text-sm text-[#8f2d22]">
                  {error}
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                {(["CONFIRMED", "SHIPPED", "DELIVERED"] as OrderStatus[]).map(
                  (nextStatus) => {
                    const isCurrent = selectedOrder.status === nextStatus;
                    const isStatusSet = [
                      "CONFIRMED",
                      "SHIPPED",
                      "DELIVERED",
                    ].includes(selectedOrder.status);

                    return (
                      <button
                        key={nextStatus}
                        type="button"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            id: selectedOrder.id,
                            nextStatus,
                          })
                        }
                        disabled={updateStatusMutation.isPending || isCurrent}
                        className={`rounded-full border px-3 py-2 text-xs transition-all ${
                          isCurrent
                            ? "border-[#1d1a17] bg-[#1d1a17] text-white"
                            : "border-black/10 bg-[#f8f4ee] text-text-primary hover:bg-[#eae4d9]"
                        } ${
                          updateStatusMutation.isPending ||
                          (isStatusSet && !isCurrent)
                            ? "opacity-40"
                            : ""
                        }`}
                      >
                        {nextStatus}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-text-muted">
            Select an order to inspect items and update fulfillment status.
          </div>
        )}
      </aside>
    </div>
  );
}
