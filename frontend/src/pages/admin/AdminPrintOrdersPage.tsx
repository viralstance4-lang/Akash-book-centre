import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Check, ChevronDown, ChevronUp, Download,
  Eye, Loader2, Mail, Phone, Settings, Trash2, User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../store/auth.store";
import {
  deletePrintOrder,
  getAdminPrintOrders, getPrintSettings,
  updatePrintOrderStatus, updatePrintSettings,
  type PrintOrder,
} from "../../api/print.api";
import { markPrintOrderSeen } from "../../api/admin.api";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "PENDING",          label: "Pending" },
  { value: "PROCESSING",       label: "Processing" },
  { value: "PRINTED",          label: "Printed" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "DELIVERED",        label: "Delivered" },
  { value: "COMPLETED",        label: "Completed" },
  { value: "CANCELLED",        label: "Cancelled" },
];

const STATUS_STYLE: Record<string, string> = {
  PENDING:          "bg-amber-50  text-amber-700  border-amber-200",
  PROCESSING:       "bg-blue-50   text-blue-700   border-blue-200",
  PRINTED:          "bg-purple-50 text-purple-700 border-purple-200",
  OUT_FOR_DELIVERY: "bg-orange-50 text-orange-700 border-orange-200",
  DELIVERED:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  COMPLETED:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED:        "bg-red-50    text-red-700    border-red-200",
};

const formatPrice = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(v);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

// ─── PDF helpers (use backend proxy — sets Content-Type: application/pdf) ────
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

/** Open a PrintFile in a new browser tab as a real PDF */
async function openPdfInBrowser(fileId: string): Promise<void> {
  // Open the window immediately (within click handler) to avoid popup blockers,
  // then navigate it to the blob URL once the authenticated fetch completes.
  const win = window.open("", "_blank");
  if (!win) return;
  try {
    const token = useAuthStore.getState().accessToken;
    const resp  = await fetch(`${API_BASE}/pdf/view/${fileId}`, {
      headers:     token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!resp.ok) throw new Error("fetch failed");
    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    win.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    win.close();
  }
}

/** Download a PrintFile as a named .pdf file */
async function downloadPdfFromApi(fileId: string, fileName: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  const resp  = await fetch(`${API_BASE}/pdf/download/${fileId}`, {
    headers:     token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!resp.ok) throw new Error("download failed");
  const blob     = await resp.blob();
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement("a");
  a.href         = url;
  a.download     = fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

// ─── Delete-confirmation modal ─────────────────────────────────────────────────
function DeleteModal({
  orderId,
  onConfirm,
  onCancel,
  isPending,
}: {
  orderId: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
          <AlertTriangle size={22} className="text-red-600" />
        </div>
        <h3 className="font-serif text-xl text-text-primary">Delete this order?</h3>
        <p className="mt-2 text-sm text-text-muted">
          Order <span className="font-mono font-semibold">#{orderId.slice(0, 8).toUpperCase()}</span> and
          all its uploaded PDFs will be permanently removed. This cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-full border border-black/10 px-4 py-2 text-sm text-text-muted hover:text-text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isPending ? <><Loader2 size={13} className="animate-spin" /> Deleting…</> : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminPrintOrdersPage() {
  const queryClient = useQueryClient();

  const [showSettings,  setShowSettings]  = useState(false);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewingId,     setViewingId]     = useState<string | null>(null);

  const [settingsForm, setSettingsForm] = useState({
    bwSingleSide:         "1",
    bwBothSideUnder20:    "2",
    bwBothSideAbove20:    "1",
    colorSingleSide:      "8",
    colorBothSideUnder20: "10",
    colorBothSideAbove20: "8",
    colorAbove99:         "6",
    spiralExtra:          "30",
    staplerExtra:         "10",
    maxPdfsPerOrder:      "20",
  });

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["admin-print-orders"],
    queryFn:  getAdminPrintOrders,
  });
  const { data: printSettingsData } = useQuery({
    queryKey: ["print-settings"],
    queryFn:  getPrintSettings,
  });

  useEffect(() => {
    const s = printSettingsData?.data;
    if (!s) return;
    setSettingsForm({
      bwSingleSide:         String(s.bwSingleSide         ?? 1),
      bwBothSideUnder20:    String(s.bwBothSideUnder20    ?? 2),
      bwBothSideAbove20:    String(s.bwBothSideAbove20    ?? 1),
      colorSingleSide:      String(s.colorSingleSide      ?? 8),
      colorBothSideUnder20: String(s.colorBothSideUnder20 ?? 10),
      colorBothSideAbove20: String(s.colorBothSideAbove20 ?? 8),
      colorAbove99:         String(s.colorAbove99         ?? 6),
      spiralExtra:          String(s.spiralExtra          ?? 30),
      staplerExtra:         String(s.staplerExtra         ?? 10),
      maxPdfsPerOrder:      String(s.maxPdfsPerOrder      ?? 20),
    });
  }, [printSettingsData]);

  useEffect(() => {
    if (!expandedId) return;
    markPrintOrderSeen(expandedId).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["admin-notification-counts"] });
    }).catch(() => {});
  }, [expandedId, queryClient]);

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updatePrintOrderStatus(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-print-orders"] }),
  });

  const updateSettingsMut = useMutation({
    mutationFn: updatePrintSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["print-settings"] });
      setShowSettings(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePrintOrder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-print-orders"] });
      setDeleteTarget(null);
    },
  });

  const orders: PrintOrder[] = ordersData?.data ?? [];
  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  const handleView = async (fileId: string) => {
    setViewingId(fileId);
    await openPdfInBrowser(fileId);
    setViewingId(null);
  };

  const handleDownload = async (fileId: string, name: string) => {
    setDownloadingId(fileId);
    await downloadPdfFromApi(fileId, name);
    setDownloadingId(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Delete confirmation modal (portal-level) */}
      {deleteTarget && (
        <DeleteModal
          orderId={deleteTarget}
          isPending={deleteMut.isPending}
          onConfirm={() => deleteMut.mutate(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="space-y-5">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">Manage</p>
            <h2 className="font-serif text-2xl text-text-primary">Print Orders</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-text-primary transition-all hover:-translate-y-0.5 hover:border-black/20"
          >
            <Settings size={15} /> Print Pricing
          </button>
        </div>

        {/* ── Pricing Settings Panel ───────────────────────────────────── */}
        {showSettings && (
          <div className="rounded-2xl border border-black/10 bg-white p-5 space-y-6">
            <h3 className="font-serif text-xl text-text-primary">Print Pricing Settings</h3>

            {/* B&W section */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-text-muted border-b border-black/8 pb-2">
                ⬛ Black &amp; White Printing
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {([
                  ["bwSingleSide",      "Single Side (₹/page)"],
                  ["bwBothSideUnder20", "Both Side — Under 20 Sheets (₹/page)"],
                  ["bwBothSideAbove20", "Both Side — 20+ Sheets (₹/page)"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">{label}</label>
                    <input type="number" step="0.5" min="0"
                      value={settingsForm[key]}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Color section */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-text-muted border-b border-black/8 pb-2">
                🎨 Color Printing
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  ["colorSingleSide",      "Single Side (₹/page)"],
                  ["colorBothSideUnder20", "Both Side — Under 20 Sheets (₹/page)"],
                  ["colorBothSideAbove20", "Both Side — 20–99 Sheets (₹/page)"],
                  ["colorAbove99",         "Above 99 Sheets — Any Side (₹/page)"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">{label}</label>
                    <input type="number" step="0.5" min="0"
                      value={settingsForm[key]}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Binding + limits */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-text-muted border-b border-black/8 pb-2">
                📎 Binding &amp; Limits
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {([
                  ["spiralExtra",    "Spiral Binding (₹ flat)"],
                  ["staplerExtra",   "Staple Binding (₹ flat)"],
                  ["maxPdfsPerOrder","Max PDFs per Order"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">{label}</label>
                    <input type="number" step="1" min="0"
                      value={settingsForm[key]}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-black/8 pt-4">
              <button type="button" onClick={() => setShowSettings(false)}
                className="rounded-full border border-black/10 px-4 py-2 text-sm text-text-muted hover:text-text-primary">
                Cancel
              </button>
              <button type="button" disabled={updateSettingsMut.isPending}
                onClick={() => updateSettingsMut.mutate({
                  bwSingleSide:         Number(settingsForm.bwSingleSide),
                  bwBothSideUnder20:    Number(settingsForm.bwBothSideUnder20),
                  bwBothSideAbove20:    Number(settingsForm.bwBothSideAbove20),
                  colorSingleSide:      Number(settingsForm.colorSingleSide),
                  colorBothSideUnder20: Number(settingsForm.colorBothSideUnder20),
                  colorBothSideAbove20: Number(settingsForm.colorBothSideAbove20),
                  colorAbove99:         Number(settingsForm.colorAbove99),
                  spiralExtra:          Number(settingsForm.spiralExtra),
                  staplerExtra:         Number(settingsForm.staplerExtra),
                  maxPdfsPerOrder:      Number(settingsForm.maxPdfsPerOrder),
                })}
                className="rounded-full bg-[#1d1a17] px-5 py-2 text-sm text-white hover:bg-black disabled:opacity-60">
                {updateSettingsMut.isPending ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </div>
        )}

        {/* ── Order List ────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-12 text-center">
            <p className="font-serif text-xl text-text-primary">No print orders yet</p>
            <p className="mt-2 text-sm text-text-muted">
              Orders will appear here once customers submit them.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isExpanded = expandedId === order.id;
              const files      = order.files ?? [];

              return (
                <div
                  key={order.id}
                  className="overflow-hidden rounded-2xl border border-black/8 bg-white"
                >
                  {/* ── Order header ─────────────────────────────────── */}
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">

                    {/* Left column */}
                    <div className="min-w-0 flex-1">

                      {/* ID + status badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-semibold text-text-primary">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[order.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
                        >
                          {order.status.replace(/_/g, " ")}
                        </span>
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          ONLINE
                        </span>
                        <span className="ml-auto text-[11px] text-text-muted/70 sm:hidden">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>

                      {/* ── Customer details block ──────────────────── */}
                      <div className="mt-3 rounded-xl border border-black/8 bg-[#faf8f5] px-3 py-2.5 space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                          Customer
                        </p>

                        {/* Name */}
                        <div className="flex items-center gap-2 text-sm">
                          <User size={13} className="shrink-0 text-text-muted" />
                          <span className="font-medium text-text-primary">
                            {order.customerName ?? order.user?.name ?? "—"}
                          </span>
                        </div>

                        {/* Phone */}
                        <div className="flex items-center gap-2 text-sm">
                          <Phone size={13} className="shrink-0 text-text-muted" />
                          {(order.customerPhone ?? order.user?.phone) ? (
                            <a
                              href={`tel:${order.customerPhone ?? order.user?.phone}`}
                              className="text-text-primary hover:underline"
                            >
                              {order.customerPhone ?? order.user?.phone}
                            </a>
                          ) : (
                            <span className="text-text-muted/60">Phone not provided</span>
                          )}
                        </div>

                        {/* Email */}
                        <div className="flex items-center gap-2 text-sm">
                          <Mail size={13} className="shrink-0 text-text-muted" />
                          {(order.customerEmail ?? order.user?.email) ? (
                            <a
                              href={`mailto:${order.customerEmail ?? order.user?.email}`}
                              className="truncate text-text-primary hover:underline"
                            >
                              {order.customerEmail ?? order.user?.email}
                            </a>
                          ) : (
                            <span className="text-text-muted/60">No email</span>
                          )}
                        </div>

                        {/* Address */}
                        {order.customerAddress && (
                          <div className="flex items-start gap-2 text-sm">
                            <span className="mt-0.5 shrink-0 text-[11px] text-text-muted">📍</span>
                            <span className="text-text-muted">{order.customerAddress}</span>
                          </div>
                        )}
                      </div>

                      {/* Print spec pills */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {[
                          order.colorType === "color" ? "🎨 Color" : "⬛ B&W",
                          order.printSide === "single" ? "Single side" : "Both sides",
                          order.orientation,
                          order.bindingType === "spiral" ? "🌀 Spiral" : "📎 Staple",
                          `${order.pageCount} pages`,
                          `${order.copies} total ${order.copies === 1 ? "copy" : "copies"}`,
                          `~${order.estimatedMinutes ?? "?"} min`,
                        ].map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-[#f4efe7] px-2.5 py-0.5 text-[11px] text-text-muted"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <p className="mt-2 hidden text-[11px] text-text-muted/70 sm:block">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>

                    {/* Right column — price, status dropdown, actions */}
                    <div className="flex flex-row flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-2.5 shrink-0">

                      {/* Price */}
                      <span className="font-serif text-xl text-[#8f2d22]">
                        {formatPrice(Number(order.totalPrice))}
                      </span>

                      {/* Status dropdown */}
                      <select
                        value={order.status}
                        onChange={(e) =>
                          updateStatusMut.mutate({ id: order.id, status: e.target.value })
                        }
                        className="rounded-xl border border-black/10 bg-[#f8f4ee] px-3 py-1.5 text-xs outline-none focus:bg-white"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>

                      {/* Mark as Completed quick button (hidden when already completed/delivered) */}
                      {!["COMPLETED", "DELIVERED", "CANCELLED"].includes(order.status) && (
                        <button
                          type="button"
                          disabled={updateStatusMut.isPending}
                          onClick={() => updateStatusMut.mutate({ id: order.id, status: "COMPLETED" })}
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {updateStatusMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          Mark Completed
                        </button>
                      )}

                      {/* Expand + Delete row */}
                      <div className="flex items-center gap-2">
                        {/* Expand/collapse PDFs */}
                        <button
                          type="button"
                          onClick={() => toggle(order.id)}
                          title={isExpanded ? "Hide PDFs" : "View PDFs & details"}
                          className="flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-[#f4efe7] hover:text-text-primary"
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {isExpanded ? "Collapse" : `${files.length || 1} PDF${(files.length || 1) > 1 ? "s" : ""}`}
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(order.id)}
                          title="Delete order"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-red-100 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Expandable PDF list ───────────────────────── */}
                  {isExpanded && (
                    <div className="border-t border-black/8 bg-[#faf8f5] px-4 py-4 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-3">
                        Files to Print ({files.length || 1})
                      </p>

                      {files.length === 0 ? (
                        /* Legacy order without per-file records */
                        <div className="flex items-center justify-between rounded-xl border border-black/8 bg-white px-4 py-3 gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary">Uploaded PDF</p>
                            <p className="text-xs text-text-muted mt-0.5">
                              {order.copies} {order.copies === 1 ? "copy" : "copies"}
                            </p>
                          </div>
                          {order.fileUrl && (
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={order.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-[#f4efe7]"
                              >
                                <Eye size={12} /> View
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        files.map((f, i) => (
                          <div
                            key={f.id}
                            className="flex items-center justify-between rounded-xl border border-black/8 bg-white px-4 py-3 gap-3"
                          >
                            {/* Index + name + meta */}
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f4efe7] text-xs font-semibold text-text-muted">
                                {i + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-text-primary">
                                  {f.originalName}
                                </p>
                                <p className="text-xs text-text-muted">
                                  {f.fileSize || "—"} · {f.pageCount} pages
                                </p>
                              </div>
                            </div>

                            {/* Copies + actions */}
                            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                              <span className="rounded-full bg-[#1d1a17] px-3 py-1 text-xs font-semibold text-white">
                                {f.copies} {f.copies === 1 ? "copy" : "copies"}
                              </span>

                              {/* View — fetch via backend proxy → blob → new tab */}
                              <button
                                type="button"
                                title="Open PDF in new tab"
                                disabled={viewingId === f.id}
                                onClick={() => handleView(f.id)}
                                className="flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-[#f4efe7] disabled:opacity-50"
                              >
                                {viewingId === f.id
                                  ? <Loader2 size={12} className="animate-spin" />
                                  : <Eye size={12} />}
                                View
                              </button>

                              {/* Download — fetch via backend proxy → blob → save-as */}
                              <button
                                type="button"
                                title="Download PDF"
                                disabled={downloadingId === f.id}
                                onClick={() => handleDownload(f.id, f.originalName)}
                                className="flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-[#f4efe7] disabled:opacity-50"
                              >
                                {downloadingId === f.id
                                  ? <Loader2 size={12} className="animate-spin" />
                                  : <Download size={12} />}
                                Download
                              </button>
                            </div>
                          </div>
                        ))
                      )}

                      {/* Print checklist — single quick-reference line for the operator */}
                      <div className="mt-3 rounded-xl border border-dashed border-black/10 px-4 py-2.5 text-xs text-text-muted">
                        <span className="font-semibold text-text-primary">Print checklist: </span>
                        {files.length > 0
                          ? files.map((f, i) => `${i + 1}. ${f.originalName} × ${f.copies}`).join("  ·  ")
                          : `1 file × ${order.copies} copies`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
