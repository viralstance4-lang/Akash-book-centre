import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { ExternalLink, FileText, Loader2, MapPin, Package, Share2, Truck, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  deleteAdminOrder,
  getAdminOrder,
  getAdminOrders,
  resendOrderInvoice,
  updateOrderStatus,
} from "../../api/admin.api";
import * as ShipmozoApi from "../../api/shipmozo.api";
import type { ApiErrorResponse, Order, OrderStatus } from "../../types";

// ── Constants ─────────────────────────────────────────────────────────────────

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING:          "bg-amber-100 text-amber-800",
  CONFIRMED:        "bg-blue-100 text-blue-800",
  SHIPPED:          "bg-violet-100 text-violet-800",
  DELIVERED:        "bg-emerald-100 text-emerald-800",
  CANCELLED:        "bg-rose-100 text-rose-800",
  RETURN_REQUESTED: "bg-orange-100 text-orange-800",
  RETURNED:         "bg-gray-100 text-gray-700",
};

const SM_STATUS_COLORS: Record<string, string> = {
  NOT_CREATED:     "bg-gray-100 text-gray-500",
  CREATED:         "bg-blue-100 text-blue-700",
  AWB_ASSIGNED:    "bg-violet-100 text-violet-700",
  LABEL_GENERATED: "bg-indigo-100 text-indigo-700",
  SHIPPED:         "bg-cyan-100 text-cyan-700",
  IN_TRANSIT:      "bg-sky-100 text-sky-700",
  OUT_FOR_DELIVERY:"bg-amber-100 text-amber-700",
  DELIVERED:       "bg-emerald-100 text-emerald-700",
  CANCELLED:       "bg-rose-100 text-rose-700",
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(value);

// ── Shipmozo Panel ────────────────────────────────────────────────────────────

function ShipmozoPanel({ order, onUpdate }: { order: Order; onUpdate: () => void }) {
  const [smError, setSmError]       = useState("");
  const [trackData, setTrackData]   = useState<Record<string, unknown> | null>(null);
  const [showTrack, setShowTrack]   = useState(false);

  const smStatus = order.shipmozoStatus ?? "NOT_CREATED";

  function handleSmError(err: unknown) {
    const axErr = err as AxiosError<ApiErrorResponse>;
    setSmError(axErr.response?.data?.message ?? "Shipmozo action failed");
  }

  const createMut = useMutation({
    mutationFn: () => ShipmozoApi.createShipment(order.id),
    onSuccess: () => { setSmError(""); onUpdate(); },
    onError: handleSmError,
  });

  const awbMut = useMutation({
    mutationFn: () => ShipmozoApi.assignCourier(order.id),
    onSuccess: () => { setSmError(""); onUpdate(); },
    onError: handleSmError,
  });

  const labelMut = useMutation({
    mutationFn: () => ShipmozoApi.getLabel(order.id),
    onSuccess: (res) => {
      setSmError(""); onUpdate();
      if (res.data.labelUrl) window.open(res.data.labelUrl, "_blank");
    },
    onError: handleSmError,
  });

  const manifestMut = useMutation({
    mutationFn: () => ShipmozoApi.generateManifest(order.id),
    onSuccess: (res) => {
      setSmError(""); onUpdate();
      if (res.data.manifestUrl) window.open(res.data.manifestUrl, "_blank");
    },
    onError: handleSmError,
  });

  const trackMut = useMutation({
    mutationFn: () => ShipmozoApi.trackShipment(order.id),
    onSuccess: (res) => { setSmError(""); setTrackData(res.data as Record<string, unknown>); setShowTrack(true); },
    onError: handleSmError,
  });

  const cancelMut = useMutation({
    mutationFn: () => ShipmozoApi.cancelShipment(order.id),
    onSuccess: () => { setSmError(""); onUpdate(); },
    onError: handleSmError,
  });

  const anyPending =
    createMut.isPending || awbMut.isPending || labelMut.isPending ||
    manifestMut.isPending || trackMut.isPending || cancelMut.isPending;

  return (
    <div className="mt-5 rounded-[1.1rem] border border-violet-200 bg-violet-50/50 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Package size={15} className="text-violet-600" />
        <p className="text-[0.68rem] uppercase tracking-[0.2em] text-violet-700 font-semibold">
          Shipmozo Fulfillment
        </p>
      </div>

      {/* Status badge */}
      <div className="mb-3 flex flex-wrap gap-2">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SM_STATUS_COLORS[smStatus] ?? "bg-gray-100 text-gray-500"}`}>
          {smStatus.replace(/_/g, " ")}
        </span>
        {order.courierName && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white border border-violet-200 px-2.5 py-0.5 text-[10px] text-violet-700">
            <Truck size={9} />
            {order.courierName}
          </span>
        )}
      </div>

      {/* Shipment details */}
      {order.shipmozoOrderId && (
        <div className="mb-3 rounded-lg bg-white border border-violet-100 p-3 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-text-muted">Shipmozo Order ID</span>
            <span className="font-mono text-text-primary">#{order.shipmozoOrderId}</span>
          </div>
          {order.shipmozoReferenceId && (
            <div className="flex justify-between">
              <span className="text-text-muted">Reference ID</span>
              <span className="font-mono text-text-primary">#{order.shipmozoReferenceId}</span>
            </div>
          )}
          {order.awbCode && (
            <div className="flex justify-between">
              <span className="text-text-muted">AWB Code</span>
              <span className="font-mono font-semibold text-violet-700">{order.awbCode}</span>
            </div>
          )}
          {order.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-violet-600 hover:text-violet-800 mt-1"
            >
              <ExternalLink size={11} />
              Track Shipment
            </a>
          )}
        </div>
      )}

      {/* Error message */}
      {smError && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <X size={12} className="mt-0.5 shrink-0" />
          <span>{smError}</span>
        </div>
      )}

      {/* Action buttons — progressive disclosure */}
      <div className="space-y-2">
        {/* Step 1: Push to Shipmozo */}
        {!order.shipmozoOrderId && (
          <button
            type="button"
            onClick={() => createMut.mutate()}
            disabled={anyPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-violet-700 disabled:opacity-50"
          >
            {createMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Package size={12} />}
            Create Shipment
          </button>
        )}

        {/* Step 2: Auto-assign courier & AWB */}
        {order.shipmozoOrderId && !order.awbCode && (
          <button
            type="button"
            onClick={() => awbMut.mutate()}
            disabled={anyPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-violet-700 disabled:opacity-50"
          >
            {awbMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Truck size={12} />}
            Assign Courier &amp; Generate AWB
          </button>
        )}

        {/* Step 3+: Actions available after AWB */}
        {order.awbCode && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => labelMut.mutate()}
              disabled={anyPending}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-[11px] font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            >
              {labelMut.isPending ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
              {order.labelUrl ? "Re-download Label" : "Download Label"}
            </button>
            <button
              type="button"
              onClick={() => manifestMut.mutate()}
              disabled={anyPending}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-[11px] font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            >
              {manifestMut.isPending ? <Loader2 size={10} className="animate-spin" /> : null}
              {order.manifestUrl ? "Re-gen Manifest" : "Generate Manifest"}
            </button>
            <button
              type="button"
              onClick={() => trackMut.mutate()}
              disabled={anyPending}
              className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-[11px] font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            >
              {trackMut.isPending ? <Loader2 size={10} className="animate-spin" /> : null}
              Live Track
            </button>
          </div>
        )}

        {/* Quick-open saved PDF links */}
        {(order.labelUrl || order.manifestUrl) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {order.labelUrl && (
              <a href={order.labelUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-violet-600 hover:underline">
                <ExternalLink size={9} /> Label PDF
              </a>
            )}
            {order.manifestUrl && (
              <a href={order.manifestUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-violet-600 hover:underline">
                <ExternalLink size={9} /> Manifest PDF
              </a>
            )}
          </div>
        )}

        {/* Cancel */}
        {order.shipmozoOrderId && smStatus !== "CANCELLED" && smStatus !== "DELIVERED" && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Cancel this Shipmozo shipment? This cannot be undone.")) {
                cancelMut.mutate();
              }
            }}
            disabled={anyPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            {cancelMut.isPending ? <Loader2 size={10} className="animate-spin" /> : null}
            Cancel Shipment
          </button>
        )}
      </div>

      {/* Live tracking panel */}
      {showTrack && trackData && (
        <div className="mt-3 rounded-lg border border-violet-200 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">
              Live Tracking
            </p>
            <button type="button" onClick={() => setShowTrack(false)}
              className="text-text-muted hover:text-text-primary"><X size={12} /></button>
          </div>
          {(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const activities: any[] = (trackData as any)?.data?.tracking_info ?? [];
            if (activities.length === 0) {
              return <p className="text-xs text-text-muted">No tracking activities yet.</p>;
            }
            return (
              <ol className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {activities.slice(0, 8).map((act: any, i: number) => (
                  <li key={i} className="flex gap-3 text-xs">
                    <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${i === 0 ? "bg-violet-600" : "bg-gray-300"}`} />
                    <div>
                      <p className="font-medium text-text-primary">{act.status ?? act.activity}</p>
                      <p className="text-text-muted">{act.date ?? ""} · {act.location ?? ""}</p>
                    </div>
                  </li>
                ))}
              </ol>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [page, setPage]                   = useState(1);
  const [status, setStatus]               = useState<OrderStatus | "">("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [error, setError]                 = useState("");

  const statusLabel: Record<OrderStatus, string> = {
    PENDING: "Pending", CONFIRMED: "Confirmed", SHIPPED: "Shipped",
    DELIVERED: "Delivered", CANCELLED: "Cancelled",
    RETURN_REQUESTED: "Return Requested", RETURNED: "Returned",
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", page, status],
    queryFn: () => getAdminOrders(page, 10, status || undefined),
  });

  const { data: detailData, refetch: refetchDetail } = useQuery({
    queryKey: ["admin-order", selectedOrderId],
    queryFn: () => getAdminOrder(selectedOrderId!),
    enabled: Boolean(selectedOrderId),
  });

  useEffect(() => {
    if (detailData && selectedOrderId) {
      void queryClient.invalidateQueries({ queryKey: ["admin-notification-counts"] });
    }
  }, [detailData, selectedOrderId, queryClient]);

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
      setError(apiError.response?.data?.message ?? "Unable to update order status.");
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id: string) => deleteAdminOrder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelectedOrderId(null);
      setError("");
    },
    onError: (mutationError) => {
      const apiError = mutationError as AxiosError<ApiErrorResponse>;
      setError(apiError.response?.data?.message ?? "Unable to delete order.");
    },
  });

  const [invoiceMsg, setInvoiceMsg] = useState("");
  const resendInvoiceMutation = useMutation({
    mutationFn: (id: string) => resendOrderInvoice(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-order"] });
      setInvoiceMsg("Invoice sent successfully!");
      setTimeout(() => setInvoiceMsg(""), 4000);
    },
    onError: (err) => {
      const apiError = err as AxiosError<ApiErrorResponse>;
      setInvoiceMsg(apiError.response?.data?.message ?? "Failed to send invoice.");
      setTimeout(() => setInvoiceMsg(""), 5000);
    },
  });

  const orders       = data?.data.orders ?? [];
  const totalPages   = data?.data.totalPages ?? 1;
  const selectedOrder = detailData?.data;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_24rem]">
      {/* ── Order list ───────────────────────────────────────────────────── */}
      <section className="rounded-[1.75rem] border border-black/8 bg-[#fbf8f2] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <select
            value={status}
            onChange={(event) => { setStatus(event.target.value as OrderStatus | ""); setPage(1); }}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition-all focus:border-black/20 focus:shadow-sm"
          >
            <option value="">All statuses</option>
            {(["PENDING","CONFIRMED","SHIPPED","DELIVERED","CANCELLED","RETURN_REQUESTED","RETURNED"] as OrderStatus[]).map((v) => (
              <option key={v} value={v}>{statusLabel[v]}</option>
            ))}
          </select>
          <p className="text-sm text-text-muted">{data?.data.total ?? 0} orders</p>
        </div>

        <div className="mt-5 space-y-4">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-[1.25rem] bg-white" />
              ))
            : orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => { setSelectedOrderId(order.id); setError(""); }}
                  className="grid w-full gap-4 rounded-[1.25rem] border border-black/8 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-black/15 md:grid-cols-[minmax(0,1fr)_0.7fr_0.8fr]"
                >
                  <div>
                    <p className="font-serif text-2xl text-text-primary">#{order.id.slice(0, 8)}</p>
                    <p className="mt-1 text-sm text-text-muted">
                      {order.user?.name ?? "Customer"} · {order.user?.email ?? ""}
                    </p>
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${ORDER_STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {statusLabel[order.status] ?? order.status}
                    </span>
                    <p className="mt-2 text-sm text-text-muted">Items {order.itemCount ?? order.items?.length ?? 0}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="font-serif text-2xl text-[#8f2d22]">
                      {formatPrice(Number(order.finalAmount ?? order.totalAmount))}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 md:justify-end">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${order.paymentMethod === "COD" || order.payment?.method === "COD" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                        {order.paymentMethod ?? order.payment?.method ?? "ONLINE"}
                      </span>
                      <span className="text-xs text-text-muted">
                        {order.paymentStatus ?? order.payment?.status ?? "PENDING"}
                      </span>
                      {order.shipmozoOrderId && (
                        <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                          SM
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-black/8 pt-5">
          <p className="text-sm text-text-muted">Page {page} of {totalPages}</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setPage((c) => Math.max(1, c - 1))} disabled={page <= 1}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm disabled:opacity-45">Previous</button>
            <button type="button" onClick={() => setPage((c) => Math.min(totalPages, c + 1))} disabled={page >= totalPages}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm disabled:opacity-45">Next</button>
          </div>
        </div>
      </section>

      {/* ── Order detail panel ────────────────────────────────────────────── */}
      <aside className="h-fit rounded-[1.75rem] border border-black/8 bg-[#fbf8f2] p-6 xl:sticky xl:top-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
        {selectedOrder ? (
          <>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">Selected order</p>
            <h2 className="mt-2 font-serif text-3xl text-text-primary">#{selectedOrder.id.slice(0, 8)}</h2>
            <p className="mt-3 text-sm text-text-muted">
              {selectedOrder.user?.name ?? "Customer"} · {selectedOrder.user?.email ?? selectedOrder.customerEmail ?? ""}
            </p>

            {/* Status badges */}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${selectedOrder.paymentMethod === "COD" || selectedOrder.payment?.method === "COD" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                {selectedOrder.paymentMethod ?? selectedOrder.payment?.method ?? "ONLINE"}
              </span>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${ORDER_STATUS_STYLES[selectedOrder.status]}`}>
                {selectedOrder.status}
              </span>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-wide ${selectedOrder.payment?.status === "SUCCESS" ? "bg-emerald-100 text-emerald-700" : selectedOrder.payment?.status === "FAILED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                Payment: {selectedOrder.payment?.status ?? "PENDING"}
              </span>
            </div>

            {/* Shipping address */}
            <div className="mt-5 rounded-[1.1rem] bg-white p-4">
              <p className="mb-2 text-[0.68rem] uppercase tracking-[0.2em] text-text-muted">Shipping Address</p>
              {selectedOrder.shippingAddress ? (
                <div className="text-sm text-text-primary">
                  <p className="font-medium">{selectedOrder.shippingAddress.name}</p>
                  <p>{selectedOrder.shippingAddress.line1}</p>
                  {selectedOrder.shippingAddress.line2 && <p>{selectedOrder.shippingAddress.line2}</p>}
                  <p>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.pincode}</p>
                  <p className="mt-1 text-text-muted">Phone: {selectedOrder.shippingAddress.phone}</p>
                </div>
              ) : (
                <p className="text-sm text-text-muted">No address provided</p>
              )}
            </div>

            {/* Customer Location (opt-in GPS, only shown if customer shared it) */}
            {(selectedOrder as any).customerLatitude != null && (selectedOrder as any).customerLongitude != null && (() => {
              const lat = (selectedOrder as any).customerLatitude as number;
              const lng = (selectedOrder as any).customerLongitude as number;
              const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
              const whatsappText = `Order #${selectedOrder.id} delivery location: ${mapsLink}`;
              return (
                <div className="mt-5 rounded-[1.1rem] bg-white p-4">
                  <p className="mb-2 text-[0.68rem] uppercase tracking-[0.2em] text-text-muted">Customer Location</p>
                  <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-black/10">
                    <iframe
                      title="Customer location"
                      width="100%"
                      height="160"
                      style={{ border: 0, display: "block" }}
                      loading="lazy"
                      src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
                    />
                  </a>
                  <div className="mt-3 flex gap-2">
                    <a
                      href={mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-black/10 bg-[#f8f4ee] py-2 text-xs font-medium text-text-primary hover:border-black/20"
                    >
                      <MapPin size={13} /> View on Map
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-600 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      <Share2 size={13} /> Share Location with Rider
                    </a>
                  </div>
                </div>
              );
            })()}

            {/* Items */}
            <div className="mt-5 space-y-3">
              <p className="text-[0.68rem] uppercase tracking-[0.2em] text-text-muted">
                Items ({selectedOrder.items.length})
              </p>
              {selectedOrder.items.map((item) => {
                const bindingType  = (item as any).bindingType ?? "NONE";
                const bindingExtra = Number((item as any).bindingExtra ?? 0);
                return (
                  <div key={item.id} className="rounded-[1.1rem] bg-white p-3 text-sm">
                    <p className="font-medium text-text-primary">{item.book.title}</p>
                    <p className="mt-1 text-text-muted">Qty {item.quantity} · {formatPrice(Number(item.priceAtPurchase))}</p>
                    {bindingType !== "NONE" && (
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${bindingType === "SPIRAL" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                        {bindingType === "SPIRAL" ? "Spiral" : "Staple"} Binding{bindingExtra > 0 ? ` +₹${bindingExtra}` : ""}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Delivery info */}
            {(selectedOrder as any).deliveryType && (
              <div className="mt-4 flex items-center justify-between rounded-[1.1rem] bg-white px-4 py-3 text-sm">
                <span className="text-text-muted">Delivery</span>
                <span className="flex items-center gap-1.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${(selectedOrder as any).deliveryType === "FREE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {(selectedOrder as any).deliveryType === "FREE" ? "Free" : "Paid"}
                  </span>
                  {(selectedOrder as any).deliveryDistance != null && (
                    <span className="text-text-muted">{Number((selectedOrder as any).deliveryDistance).toFixed(1)} km</span>
                  )}
                  {(selectedOrder as any).calculationMethod && (
                    <span className="text-[10px] text-text-muted/70">({(selectedOrder as any).calculationMethod})</span>
                  )}
                </span>
              </div>
            )}

            {/* Price breakdown */}
            <div className="mt-4 space-y-2 rounded-[1.1rem] bg-white p-4">
              <p className="mb-3 text-[0.68rem] uppercase tracking-[0.2em] text-text-muted">Order Breakdown</p>
              <div className="flex justify-between text-sm"><span className="text-text-muted">Subtotal</span><span>{formatPrice(Number(selectedOrder.totalAmount))}</span></div>
              {(selectedOrder as any).deliveryCharge > 0
                ? <div className="flex justify-between text-sm text-amber-600"><span>Delivery Charge</span><span>+{formatPrice(Number((selectedOrder as any).deliveryCharge))}</span></div>
                : <div className="flex justify-between text-sm text-emerald-600"><span>Delivery</span><span>Free Delivery</span></div>
              }
              {(selectedOrder as any).discountAmount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600"><span>Discount</span><span>-{formatPrice(Number((selectedOrder as any).discountAmount))}</span></div>
              )}
              <div className="flex justify-between border-t border-black/8 pt-2 font-bold text-[#1d1a17]">
                <span>Final Total</span>
                <span>{formatPrice(Number((selectedOrder as any).finalAmount ?? selectedOrder.totalAmount))}</span>
              </div>
            </div>

            {/* Order status controls */}
            <div className="mt-5 rounded-[1.1rem] bg-white p-4">
              <p className="text-[0.68rem] uppercase tracking-[0.2em] text-text-muted">Advance status</p>
              {error && (
                <div className="mt-3 rounded-2xl border border-[#8f2d22]/15 bg-[#f8ece8] px-4 py-3 text-sm text-[#8f2d22]">{error}</div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {(["CONFIRMED", "SHIPPED", "DELIVERED"] as OrderStatus[]).map((nextStatus) => {
                  const isCurrent    = selectedOrder.status === nextStatus;
                  const isStatusSet  = ["CONFIRMED","SHIPPED","DELIVERED"].includes(selectedOrder.status);
                  return (
                    <button key={nextStatus} type="button"
                      onClick={() => updateStatusMutation.mutate({ id: selectedOrder.id, nextStatus })}
                      disabled={updateStatusMutation.isPending || isCurrent}
                      className={`rounded-full border px-3 py-2 text-xs transition-all ${isCurrent ? "border-[#1d1a17] bg-[#1d1a17] text-white" : "border-black/10 bg-[#f8f4ee] text-text-primary hover:bg-[#eae4d9]"} ${updateStatusMutation.isPending || (isStatusSet && !isCurrent) ? "opacity-40" : ""}`}
                    >
                      {nextStatus}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Shipmozo Panel ──────────────────────────────────────────── */}
            <ShipmozoPanel
              order={selectedOrder}
              onUpdate={() => {
                void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
                void refetchDetail();
              }}
            />

            {/* Invoice Panel */}
            <div className="mt-5 rounded-[1.1rem] border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} className="text-emerald-600" />
                <p className="text-[0.68rem] uppercase tracking-[0.2em] text-emerald-700 font-semibold">Invoice</p>
              </div>
              {(selectedOrder as any).invoiceNumber ? (
                <div className="mb-3 rounded-lg bg-white border border-emerald-100 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Invoice No.</span>
                    <span className="font-mono font-semibold text-emerald-700">{(selectedOrder as any).invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Status</span>
                    <span className={(selectedOrder as any).invoiceSent ? "text-emerald-600 font-medium" : "text-amber-600"}>
                      {(selectedOrder as any).invoiceSent ? "Sent" : "Not sent"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mb-3 text-xs text-text-muted">No invoice generated yet.</p>
              )}
              {invoiceMsg && (
                <p className={`mb-2 rounded-lg px-3 py-1.5 text-xs font-medium ${invoiceMsg.includes("success") ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {invoiceMsg}
                </p>
              )}
              <button
                type="button"
                onClick={() => resendInvoiceMutation.mutate(selectedOrder.id)}
                disabled={resendInvoiceMutation.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
              >
                {resendInvoiceMutation.isPending
                  ? <><Loader2 size={12} className="animate-spin" /> Sending…</>
                  : <><FileText size={12} /> {(selectedOrder as any).invoiceSent ? "Resend Invoice" : "Send Invoice"}</>
                }
              </button>
            </div>

            {/* Delete order */}
            <div className="mt-5 border-t border-black/8 pt-4">
              <button
                type="button"
                onClick={() => { if (window.confirm("Delete this order permanently?")) deleteOrderMutation.mutate(selectedOrder.id); }}
                disabled={deleteOrderMutation.isPending}
                className="inline-flex w-full items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition-all hover:bg-rose-100 disabled:opacity-50"
              >
                {deleteOrderMutation.isPending ? "Deleting..." : "Delete Order"}
              </button>
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
