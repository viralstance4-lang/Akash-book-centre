import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useState } from "react";

import {
  getAdminReturns,
  getAdminReturnDetail,
  updateReturnStatus,
} from "../../api/returns.api";
import type { ApiErrorResponse } from "../../types";

const RETURN_STATUS_STYLES = {
  VERIFYING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  COMPLETED: "bg-blue-100 text-blue-800",
};

const STATUS_LABELS = {
  VERIFYING: "Verifying",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
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

export default function AdminReturnsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-returns", page, status],
    queryFn: () => getAdminReturns(page, 10, status || undefined),
  });

  const { data: detailData } = useQuery({
    queryKey: ["admin-return", selectedReturnId],
    queryFn: () => getAdminReturnDetail(selectedReturnId!),
    enabled: Boolean(selectedReturnId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: typeof status }) =>
      updateReturnStatus(id, nextStatus as any),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-return"] });
      setError("");
    },
    onError: (mutationError) => {
      const apiError = mutationError as AxiosError<ApiErrorResponse>;
      setError(
        apiError.response?.data?.message ?? "Unable to update return status.",
      );
    },
  });

  const returns = data?.data.returns ?? [];
  const totalPages = data?.data.totalPages ?? 1;
  const selectedReturn = detailData?.data;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_24rem]">
      <section className="rounded-[1.75rem] border border-black/8 bg-[#fbf8f2] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-all focus:border-black/20 focus:shadow-sm"
          >
            <option value="">All statuses</option>
            {(["VERIFYING", "APPROVED", "REJECTED", "COMPLETED"] as const).map(
              (value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              )
            )}
          </select>
          <p className="text-sm text-text-muted">
            {data?.data.total ?? 0} returns
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
            : returns.map((returnRequest) => (
                <button
                  key={returnRequest.id}
                  type="button"
                  onClick={() => {
                    setSelectedReturnId(returnRequest.id);
                    setError("");
                  }}
                  className="grid w-full gap-4 rounded-[1.25rem] border border-black/8 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-black/15 md:grid-cols-[minmax(0,1fr)_0.8fr_0.7fr]"
                >
                  <div>
                    <p className="font-serif text-2xl text-text-primary">
                      #{returnRequest.id.slice(0, 8)}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      {returnRequest.user?.name ?? "Customer"} ·{" "}
                      {returnRequest.email ?? ""}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${
                        RETURN_STATUS_STYLES[returnRequest.status as keyof typeof RETURN_STATUS_STYLES] ??
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[returnRequest.status as keyof typeof STATUS_LABELS]}
                    </span>
                    <p className="mt-2 text-sm text-text-muted">
                      Items {returnRequest.order?.items?.length ?? 0}
                    </p>
                  </div>
                  <div className="md:text-right">
                    <p className="font-serif text-2xl text-[#8f2d22]">
                      {formatPrice(Number(returnRequest.order?.totalAmount ?? 0))}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {formatDate(returnRequest.createdAt)}
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

      <aside className="h-fit rounded-[1.75rem] border border-black/8 bg-[#fbf8f2] p-6 xl:sticky xl:top-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
        {selectedReturn ? (
          <>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">
              Return Request
            </p>
            <h2 className="mt-2 font-serif text-3xl text-text-primary">
              #{selectedReturn.id.slice(0, 8)}
            </h2>
            <p className="mt-3 text-sm text-text-muted">
              {selectedReturn.user?.name ?? "Customer"} ·{" "}
              {selectedReturn.email ?? ""}
            </p>

            {/* Status badge */}
            <div className="mt-3 flex gap-2 flex-wrap">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  RETURN_STATUS_STYLES[
                    selectedReturn.status as keyof typeof RETURN_STATUS_STYLES
                  ]
                }`}
              >
                {STATUS_LABELS[selectedReturn.status as keyof typeof STATUS_LABELS]}
              </span>
            </div>

            {/* Customer Details */}
            <div className="mt-5 rounded-[1.1rem] bg-white p-4">
              <p className="mb-2 text-[0.68rem] uppercase tracking-[0.2em] text-text-muted">
                Customer Info
              </p>
              <div className="text-sm text-text-primary space-y-1">
                <div>
                  <span className="text-text-muted">Name: </span>
                  <span>{selectedReturn.user?.name ?? "N/A"}</span>
                </div>
                <div>
                  <span className="text-text-muted">Email: </span>
                  <span className="break-all">{selectedReturn.email}</span>
                </div>
                <div>
                  <span className="text-text-muted">Phone: </span>
                  <span>{selectedReturn.user?.phone ?? "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Order Details */}
            <div className="mt-4 rounded-[1.1rem] bg-white p-4">
              <p className="mb-2 text-[0.68rem] uppercase tracking-[0.2em] text-text-muted">
                Related Order
              </p>
              <div className="text-sm text-text-primary space-y-1">
                <div>
                  <span className="text-text-muted">Order ID: </span>
                  <span className="font-mono">
                    #{selectedReturn.order?.id?.slice(0, 8) ?? "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Order Amount: </span>
                  <span className="text-[#8f2d22] font-semibold">
                    {formatPrice(Number(selectedReturn.order?.totalAmount ?? 0))}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Order Date: </span>
                  <span>{formatDate(selectedReturn.order?.createdAt ?? "")}</span>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="mt-4 rounded-[1.1rem] bg-white p-4">
              <p className="mb-2 text-[0.68rem] uppercase tracking-[0.2em] text-text-muted">
                Shipping Address
              </p>
              {selectedReturn.order?.shippingAddress ? (
                <div className="text-sm text-text-primary">
                  <p className="font-medium">
                    {selectedReturn.order.shippingAddress.name}
                  </p>
                  <p>{selectedReturn.order.shippingAddress.line1}</p>
                  {selectedReturn.order.shippingAddress.line2 && (
                    <p>{selectedReturn.order.shippingAddress.line2}</p>
                  )}
                  <p>
                    {selectedReturn.order.shippingAddress.city},{" "}
                    {selectedReturn.order.shippingAddress.state}{" "}
                    {selectedReturn.order.shippingAddress.pincode}
                  </p>
                  <p className="mt-1 text-text-muted">
                    Phone: {selectedReturn.order.shippingAddress.phone}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-muted">No address provided</p>
              )}
            </div>

            {/* Items in Order */}
            <div className="mt-4 rounded-[1.1rem] bg-white p-4">
              <p className="mb-3 text-[0.68rem] uppercase tracking-[0.2em] text-text-muted">
                Items ({selectedReturn.order?.items?.length ?? 0})
              </p>
              <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
                {selectedReturn.order?.items?.map((item: any) => (
                  <div key={item.id} className="border-b border-black/8 pb-2 last:border-0">
                    <p className="font-medium text-text-primary">
                      {item.book?.title ?? "Unknown Book"}
                    </p>
                    <p className="text-text-muted">
                      Qty {item.quantity} · {formatPrice(Number(item.priceAtPurchase))}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Return Reason */}
            {selectedReturn.reason && (
              <div className="mt-4 rounded-[1.1rem] bg-white p-4">
                <p className="mb-2 text-[0.68rem] uppercase tracking-[0.2em] text-text-muted">
                  Return Reason
                </p>
                <p className="text-sm text-text-primary">{selectedReturn.reason}</p>
              </div>
            )}

            {/* Status Actions */}
            <div className="mt-5 rounded-[1.1rem] bg-white p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.2em] text-text-muted mb-3">
                Update Status
              </p>
              {error ? (
                <div className="mb-3 rounded-2xl border border-[#8f2d22]/15 bg-[#f8ece8] px-4 py-3 text-sm text-[#8f2d22]">
                  {error}
                </div>
              ) : null}
              <div className="flex gap-2 flex-wrap">
                {(
                  ["APPROVED", "REJECTED", "COMPLETED"] as const
                ).map((nextStatus) => {
                  const isCurrent = selectedReturn.status === nextStatus;

                  return (
                    <button
                      key={nextStatus}
                      type="button"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          id: selectedReturn.id,
                          nextStatus,
                        })
                      }
                      disabled={updateStatusMutation.isPending || isCurrent}
                      className={`rounded-full border px-3 py-2 text-xs font-medium transition-all ${
                        isCurrent
                          ? "border-[#1d1a17] bg-[#1d1a17] text-white"
                          : nextStatus === "APPROVED"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : nextStatus === "REJECTED"
                          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      } ${updateStatusMutation.isPending ? "opacity-40" : ""}`}
                    >
                      {STATUS_LABELS[nextStatus]}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-text-muted">
            Select a return request to view details and update status.
          </div>
        )}
      </aside>
    </div>
  );
}
