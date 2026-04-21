import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle, Loader2, LogIn, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createReturn } from "../../api/returns.api";
import { getOrders } from "../../api/orders.api";
import { useAuthStore } from "../../store/auth.store";
import type { Order } from "../../types";

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

export default function ReturnsPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const [email, setEmail] = useState(user?.email ?? "");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Keep email in sync if user logs in after the page mounts
  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  // Only fetch orders when logged in
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => getOrders(1, 100),
    enabled: isAuthenticated,
  });

  const deliveredOrders = (ordersData?.data.orders ?? []).filter(
    (o) => o.status === "DELIVERED",
  );

  const createReturnMutation = useMutation({
    mutationFn: () => createReturn(selectedOrderId, email, reason || undefined),
    onSuccess: (data) => {
      setSuccessMessage(data.message ?? "Return request created successfully!");
      setSelectedOrderId("");
      setReason("");
      setSelectedOrder(null);
    },
  });

  const handleOrderSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedOrderId(id);
    setSelectedOrder(deliveredOrders.find((o) => o.id === id) ?? null);
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (successMessage) {
    return (
      <div className="mx-auto max-w-lg space-y-8">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-8 py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle size={30} className="text-emerald-600" />
          </div>
          <h2 className="font-serif text-2xl text-text-primary">Return Request Submitted</h2>
          <p className="mt-3 text-sm text-emerald-700">{successMessage}</p>
          <p className="mt-2 text-sm text-text-muted">
            Status: <strong>Order Verifying</strong> — we'll review your request shortly.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/my-returns"
              className="rounded-full bg-[#1d1a17] px-6 py-2.5 text-sm font-medium text-white hover:bg-black"
            >
              Track My Returns
            </Link>
            <button
              type="button"
              onClick={() => setSuccessMessage("")}
              className="rounded-full border border-black/10 px-6 py-2.5 text-sm text-text-muted hover:bg-[#f4efe7]"
            >
              New Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="space-y-8">
        {/* Page header */}
        <div>
          <p className="font-sans text-[0.72rem] uppercase tracking-[0.32em] text-text-muted">
            Returns
          </p>
          <h1 className="mt-2 font-serif text-4xl text-text-primary">Request a Return</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-muted">
            Request a return for any delivered order. Login to get started.
          </p>
        </div>

        {/* Login prompt */}
        <div className="rounded-3xl border border-black/8 bg-[#fbf8f2] px-8 py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f4efe7]">
            <LogIn size={22} className="text-text-muted" />
          </div>
          <h2 className="font-serif text-xl text-text-primary">Login to Request a Return</h2>
          <p className="mt-2 text-sm text-text-muted">
            You need to be logged in to see your orders and submit a return request.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login", { state: { from: { pathname: "/returns" } } })}
            className="mt-6 rounded-full bg-[#1d1a17] px-7 py-3 text-sm font-medium text-white hover:bg-black"
          >
            Login to Continue
          </button>
        </div>

        {/* How returns work */}
        <HowItWorks />
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-sans text-[0.72rem] uppercase tracking-[0.32em] text-text-muted">
            Returns
          </p>
          <h1 className="mt-2 font-serif text-4xl text-text-primary">Request a Return</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-muted">
            Select a delivered order below, confirm your email, and submit your
            return request. We'll verify it and get back to you.
          </p>
        </div>
        <Link
          to="/my-returns"
          className="mt-2 shrink-0 inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs text-text-muted hover:bg-[#f4efe7] hover:text-text-primary"
        >
          <RotateCcw size={12} /> My Returns
        </Link>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createReturnMutation.mutate();
        }}
        className="space-y-6 rounded-3xl border border-black/8 bg-[#fbf8f2] p-8"
      >
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-text-primary">
            Registered Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm placeholder-text-muted/50 transition-colors focus:border-black/30 focus:outline-none"
          />
          <p className="mt-1 text-xs text-text-muted">Must match your account's registered email.</p>
        </div>

        {/* Order selector */}
        <div>
          <label className="block text-sm font-medium text-text-primary">
            Select Delivered Order <span className="text-red-500">*</span>
          </label>

          {ordersLoading ? (
            <div className="mt-2 flex h-12 items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 text-sm text-text-muted">
              <Loader2 size={14} className="animate-spin" /> Loading your orders…
            </div>
          ) : (
            <select
              required
              value={selectedOrderId}
              onChange={handleOrderSelect}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm transition-colors focus:border-black/30 focus:outline-none"
            >
              <option value="">— Choose a delivered order —</option>
              {deliveredOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  #{order.id.slice(0, 8).toUpperCase()} — {formatDate(order.createdAt)} —{" "}
                  {formatPrice(Number(order.totalAmount))} ({order.items.length}{" "}
                  {order.items.length === 1 ? "item" : "items"})
                </option>
              ))}
            </select>
          )}

          {!ordersLoading && deliveredOrders.length === 0 && (
            <p className="mt-2 text-sm text-amber-600">
              No delivered orders found. Only delivered orders are eligible for return.
            </p>
          )}
        </div>

        {/* Selected order preview */}
        {selectedOrder && (
          <div className="rounded-2xl border border-black/8 bg-white p-4">
            <p className="text-[0.68rem] uppercase tracking-[0.18em] text-text-muted">Order Details</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-text-muted">Amount</p>
                <p className="mt-1 font-semibold text-[#8f2d22]">
                  {formatPrice(Number(selectedOrder.totalAmount))}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Items</p>
                <p className="mt-1 font-semibold">{selectedOrder.items.length} item{selectedOrder.items.length !== 1 ? "s" : ""}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Date</p>
                <p className="mt-1 text-sm font-semibold">{formatDate(selectedOrder.createdAt)}</p>
              </div>
            </div>
            <div className="mt-4 space-y-1.5 border-t border-black/8 pt-4">
              {selectedOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-text-muted">{item.book?.title ?? "Unknown"}</span>
                  <span className="text-text-primary">× {item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-text-primary">
            Reason for Return{" "}
            <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tell us why you want to return this order…"
            rows={3}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm placeholder-text-muted/50 transition-colors focus:border-black/30 focus:outline-none resize-none"
          />
        </div>

        {/* Error */}
        {createReturnMutation.isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {(createReturnMutation.error as any)?.response?.data?.message ??
              "Failed to submit return request. Please try again."}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={createReturnMutation.isPending || !selectedOrderId || !email.trim()}
          className="w-full rounded-full bg-[#1d1a17] px-6 py-3.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
        >
          {createReturnMutation.isPending ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Submitting…
            </span>
          ) : (
            "Verify & Request Return"
          )}
        </button>
      </form>

      <HowItWorks />
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="rounded-3xl border border-black/8 bg-[#fbf8f2] p-8">
      <h2 className="font-serif text-xl text-text-primary">How returns work</h2>
      <ol className="mt-4 space-y-3 text-sm text-text-muted">
        {[
          "Submit your return request with your registered email and order details.",
          "We verify your order — status changes to 'Order Verifying'.",
          "We approve or reject the return within 2–3 business days.",
          "If approved, we'll contact you with pickup/refund instructions.",
        ].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-text-primary/10 text-xs font-semibold text-text-primary">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
