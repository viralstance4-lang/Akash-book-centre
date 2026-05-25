import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Loader2,
  LogIn,
  MessageCircle,
  RotateCcw,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getOrders } from "../../api/orders.api";
import { createReturn } from "../../api/returns.api";
import { SUPPORT_MAILTO } from "../../config/support";
import { useAuthStore } from "../../store/auth.store";
import type { Order } from "../../types";

// ── Brand ─────────────────────────────────────────────────────────────────────
const NAVY = "#051d40";
const GOLD = "#d6b269";

// ── Static content ────────────────────────────────────────────────────────────
const POLICY_CARDS = [
  { Icon: Clock,    title: "7-Day Window",    desc: "Submit your return within 7 days of delivery.",          accent: GOLD  },
  { Icon: Shield,   title: "Original Condition", desc: "Books must be unused, unmarked, and undamaged.", accent: NAVY  },
  { Icon: CheckCircle, title: "Quick Review", desc: "We review and respond within 2–3 business days.",        accent: GOLD  },
];

const ELIGIBLE = [
  "Delivered within the last 7 days",
  "In original, unused, unmarked condition",
  "Original packaging intact where applicable",
  "Standard books — not print-on-demand",
  "Not spiral-bound or custom-finished",
];

const NOT_ELIGIBLE = [
  "Print books (custom printed on demand)",
  "Spiral-bound or custom-finished orders",
  "Digital or downloadable content",
  "Orders placed more than 7 days ago",
  "Books with tears, highlights, or damage",
];

const STEPS = [
  { n: "01", title: "Submit Request",    desc: "Fill the form with your registered email and select the delivered order." },
  { n: "02", title: "Order Verification",desc: "We verify your order details. Status moves to Verifying." },
  { n: "03", title: "Review (2–3 days)", desc: "We approve or reject within 2–3 business days and notify you by email." },
  { n: "04", title: "Pickup & Refund",   desc: "If approved, we arrange pickup and refund to your original payment method." },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const fmtDate = (v: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(v));

// ── Scroll-reveal hook (stable, self-cleaning) ────────────────────────────────
function useReveal(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => setVisible(true), delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08 },
    );
    observer.observe(el);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, [delay]);

  return { ref, visible };
}

// ── Reveal wrapper ─────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal(delay);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? "translateY(0)" : "translateY(22px)",
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function ReturnsPage() {
  const navigate       = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user           = useAuthStore((s) => s.user);

  const [email,           setEmail]           = useState(user?.email ?? "");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [reason,          setReason]          = useState("");
  const [successMsg,      setSuccessMsg]      = useState("");
  const [selectedOrder,   setSelectedOrder]   = useState<Order | null>(null);

  // keep email in sync if user logs in after mount
  useEffect(() => { if (user?.email) setEmail(user.email); }, [user?.email]);

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn:  () => getOrders(1, 100),
    enabled:  isAuthenticated,
  });

  // SAFE: list API returns itemCount, NOT items — never access .items.length here
  const deliveredOrders = (ordersData?.data?.orders ?? []).filter(
    (o) => o.status === "DELIVERED",
  );

  const returnMutation = useMutation({
    mutationFn: () => createReturn(selectedOrderId, email, reason || undefined),
    onSuccess: (res) => {
      setSuccessMsg(res.message ?? "Return request submitted successfully!");
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

  // ── Success screen ─────────────────────────────────────────────────────────
  if (successMsg) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-3xl border border-emerald-200 bg-emerald-50 px-8 py-12 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle size={30} className="text-emerald-600" />
          </div>
          <h2 className="font-serif text-2xl text-[#1d1a17]">Request Submitted!</h2>
          <p className="mt-3 text-sm text-emerald-700">{successMsg}</p>
          <p className="mt-2 text-sm text-[#9a9a9a]">
            Status: <strong className="text-[#1d1a17]">Order Verifying</strong> — we'll review it shortly.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/my-returns"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1d1a17] px-6 py-2.5 text-sm font-medium text-white hover:bg-black"
            >
              Track My Returns <ArrowRight size={14} />
            </Link>
            <button
              type="button"
              onClick={() => setSuccessMsg("")}
              className="rounded-full border border-black/10 px-6 py-2.5 text-sm text-[#9a9a9a] hover:bg-[#f4efe7]"
            >
              New Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #083572 100%)` }}
        className="relative overflow-hidden rounded-3xl px-8 py-16 md:py-20"
      >
        {/* decorative circles */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-10"
          style={{ background: GOLD }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full opacity-8"
          style={{ background: GOLD }}
        />

        <div className="relative max-w-2xl">
          <p
            className="text-[0.7rem] font-semibold uppercase tracking-[0.3em]"
            style={{ color: GOLD }}
          >
            Returns &amp; Refunds
          </p>
          <h1 className="mt-3 font-serif text-4xl font-normal leading-tight text-white md:text-5xl">
            Hassle-Free Returns
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70">
            Not satisfied with your order? We've made returning books simple and transparent.
            Submit a request below and our team will handle the rest.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#request-return"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#051d40] transition-opacity hover:opacity-90"
              style={{ background: GOLD }}
            >
              <RotateCcw size={14} /> Request a Return
            </a>
            {isAuthenticated && (
              <Link
                to="/my-returns"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white/80 transition-all hover:border-white/40 hover:text-white"
              >
                My Returns
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Policy stats ──────────────────────────────────────────────────────── */}
      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        {POLICY_CARDS.map(({ Icon, title, desc, accent }, i) => (
          <Reveal key={title} delay={i * 80}>
            <div className="group rounded-2xl border border-black/8 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-md">
              <div
                className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: `${accent}18` }}
              >
                <Icon size={20} style={{ color: accent }} />
              </div>
              <p className="font-semibold text-[#1d1a17]">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#9a9a9a]">{desc}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ── Return Request Form ───────────────────────────────────────────────── */}
      <section id="request-return" className="mt-14 scroll-mt-8">
        <Reveal>
          <div className="mb-6">
            <p className="text-[0.7rem] uppercase tracking-[0.28em] text-[#9a9a9a]">Step by Step</p>
            <h2 className="mt-1 font-serif text-3xl text-[#1d1a17]">Request a Return</h2>
          </div>
        </Reveal>

        {isAuthenticated ? (
          <Reveal delay={60}>
            <form
              onSubmit={(e) => { e.preventDefault(); returnMutation.mutate(); }}
              className="space-y-6 rounded-3xl border border-black/8 bg-[#fbf8f2] p-7 md:p-8"
            >
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-[#1d1a17]">
                  Registered Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm placeholder-[#9a9a9a]/50 transition-colors focus:border-black/30 focus:outline-none"
                />
                <p className="mt-1 text-xs text-[#9a9a9a]">Must match your account's registered email.</p>
              </div>

              {/* Order selector */}
              <div>
                <label className="block text-sm font-medium text-[#1d1a17]">
                  Select Delivered Order <span className="text-red-500">*</span>
                </label>
                {ordersLoading ? (
                  <div className="mt-2 flex h-12 items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 text-sm text-[#9a9a9a]">
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
                    {deliveredOrders.map((order) => {
                      // SAFE: use itemCount (list endpoint) — never access .items.length
                      const count = order.itemCount ?? 0;
                      return (
                        <option key={order.id} value={order.id}>
                          #{order.id.slice(0, 8).toUpperCase()} · {fmtDate(order.createdAt)} ·{" "}
                          {fmt(Number(order.totalAmount))} · {count} {count === 1 ? "item" : "items"}
                        </option>
                      );
                    })}
                  </select>
                )}

                {!ordersLoading && deliveredOrders.length === 0 && (
                  <div className="mt-2 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    No delivered orders found. Only delivered orders are eligible for return.
                  </div>
                )}
              </div>

              {/* Selected order preview — guard items access (list API may not include items array) */}
              {selectedOrder && (
                <div className="rounded-2xl border border-black/8 bg-white p-4">
                  <p className="text-[0.66rem] uppercase tracking-[0.18em] text-[#9a9a9a]">Order Details</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-[#9a9a9a]">Amount</p>
                      <p className="mt-1 font-semibold text-[#8f2d22]">{fmt(Number(selectedOrder.totalAmount))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#9a9a9a]">Items</p>
                      <p className="mt-1 font-semibold text-[#1d1a17]">
                        {selectedOrder.itemCount ?? (selectedOrder.items?.length ?? "—")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#9a9a9a]">Date</p>
                      <p className="mt-1 text-sm font-semibold text-[#1d1a17]">{fmtDate(selectedOrder.createdAt)}</p>
                    </div>
                  </div>
                  {/* safe guard: items only present in detail endpoint, not list */}
                  {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 && (
                    <div className="mt-4 space-y-1.5 border-t border-black/8 pt-4">
                      {selectedOrder.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-[#9a9a9a]">{item.book?.title ?? "Book"}</span>
                          <span className="text-[#1d1a17]">× {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-[#1d1a17]">
                  Reason for Return{" "}
                  <span className="font-normal text-[#9a9a9a]">(optional)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe why you want to return this order…"
                  rows={3}
                  className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm placeholder-[#9a9a9a]/50 transition-colors focus:border-black/30 focus:outline-none"
                />
              </div>

              {/* Error */}
              {returnMutation.isError && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  <X size={14} className="mt-0.5 shrink-0" />
                  {(returnMutation.error as any)?.response?.data?.message ??
                    "Failed to submit return request. Please try again."}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={returnMutation.isPending || !selectedOrderId || !email.trim()}
                className="w-full rounded-full py-3.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
                style={{ background: NAVY }}
              >
                {returnMutation.isPending ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Submitting…
                  </span>
                ) : (
                  "Verify & Submit Return Request"
                )}
              </button>
            </form>
          </Reveal>
        ) : (
          <Reveal delay={60}>
            <div className="rounded-3xl border border-black/8 bg-[#fbf8f2] px-8 py-14 text-center">
              <div
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: `${NAVY}12` }}
              >
                <LogIn size={22} style={{ color: NAVY }} />
              </div>
              <h3 className="font-serif text-xl text-[#1d1a17]">Login to Request a Return</h3>
              <p className="mt-2 max-w-sm mx-auto text-sm text-[#9a9a9a]">
                You need to be logged in to view your orders and submit a return request.
              </p>
              <button
                type="button"
                onClick={() => navigate("/login", { state: { from: { pathname: "/returns" } } })}
                className="mt-7 inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
                style={{ background: NAVY }}
              >
                Login to Continue <ArrowRight size={14} />
              </button>
            </div>
          </Reveal>
        )}
      </section>

      {/* ── Eligibility ───────────────────────────────────────────────────────── */}
      <section className="mt-16">
        <Reveal>
          <div className="mb-6">
            <p className="text-[0.7rem] uppercase tracking-[0.28em] text-[#9a9a9a]">Policy Details</p>
            <h2 className="mt-1 font-serif text-3xl text-[#1d1a17]">Eligibility Conditions</h2>
          </div>
        </Reveal>
        <div className="grid gap-5 md:grid-cols-2">
          {/* Eligible */}
          <Reveal delay={0}>
            <div className="h-full rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
              <div className="mb-4 flex items-center gap-2">
                <CheckCircle size={17} className="text-emerald-600" />
                <p className="font-semibold text-emerald-800">Eligible for Return</p>
              </div>
              <ul className="space-y-2.5">
                {ELIGIBLE.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-emerald-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Not eligible */}
          <Reveal delay={80}>
            <div className="h-full rounded-2xl border border-rose-200 bg-rose-50/60 p-6">
              <div className="mb-4 flex items-center gap-2">
                <X size={17} className="text-rose-500" />
                <p className="font-semibold text-rose-800">Not Eligible for Return</p>
              </div>
              <ul className="space-y-2.5">
                {NOT_ELIGIBLE.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-rose-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Process Steps ────────────────────────────────────────────────────── */}
      <section className="mt-16">
        <Reveal>
          <div className="mb-8">
            <p className="text-[0.7rem] uppercase tracking-[0.28em] text-[#9a9a9a]">How It Works</p>
            <h2 className="mt-1 font-serif text-3xl text-[#1d1a17]">Return Process</h2>
          </div>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ n, title, desc }, i) => (
            <Reveal key={n} delay={i * 70}>
              <div className="group relative rounded-2xl border border-black/8 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-md">
                <div
                  className="mb-4 inline-block rounded-xl px-3 py-1 font-mono text-xs font-bold"
                  style={{ background: `${GOLD}22`, color: "#92630a" }}
                >
                  {n}
                </div>
                <p className="font-semibold text-[#1d1a17]">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#9a9a9a]">{desc}</p>
                {/* connector line (desktop) */}
                {i < 3 && (
                  <div className="absolute -right-2.5 top-1/2 hidden h-px w-5 -translate-y-1/2 lg:block" style={{ background: GOLD, opacity: 0.35 }} />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Refund Info ───────────────────────────────────────────────────────── */}
      <section className="mt-16">
        <Reveal>
          <div
            className="rounded-3xl p-8 md:p-10"
            style={{ background: `linear-gradient(135deg, ${NAVY}08 0%, ${GOLD}10 100%)`, border: `1px solid ${GOLD}30` }}
          >
            <div className="flex items-start gap-4">
              <div
                className="mt-0.5 shrink-0 rounded-xl p-2.5"
                style={{ background: `${GOLD}22` }}
              >
                <Shield size={20} style={{ color: "#92630a" }} />
              </div>
              <div>
                <h3 className="font-serif text-xl text-[#1d1a17]">Refund Information</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9a9a9a]">
                  Once a return is approved, refunds are processed to your original payment method —
                  credit/debit card, UPI, or wallet. Refunds typically take{" "}
                  <strong className="text-[#1d1a17]">5–7 business days</strong> to reflect.
                  COD orders receive refunds via bank transfer — please ensure your account details are shared during the review process.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Damaged / Wrong Product ───────────────────────────────────────────── */}
      <section className="mt-8">
        <Reveal>
          <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-7 md:p-8">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 shrink-0 rounded-xl bg-amber-100 p-2.5">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-serif text-xl text-[#1d1a17]">Received a Damaged or Wrong Book?</h3>
                <p className="mt-2 text-sm leading-relaxed text-amber-800">
                  If you received a damaged, defective, or incorrect book, please contact us{" "}
                  <strong>within 48 hours of delivery</strong>. We'll arrange an immediate replacement or full
                  refund — no return required in most cases. Attach photos of the issue when reaching out.
                </p>
                <a
                  href={SUPPORT_MAILTO}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-5 py-2 text-sm font-medium text-amber-700 transition-all hover:bg-amber-50"
                >
                  <MessageCircle size={13} /> Contact Support Now
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Contact CTA ───────────────────────────────────────────────────────── */}
      <section className="mt-10 mb-4">
        <Reveal>
          <div
            className="rounded-3xl px-8 py-12 text-center"
            style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #083572 100%)` }}
          >
            <div
              className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: `${GOLD}22` }}
            >
              <MessageCircle size={20} style={{ color: GOLD }} />
            </div>
            <h2 className="font-serif text-2xl text-white">Still Have Questions?</h2>
            <p className="mt-2 text-sm text-white/65">
              Our support team is available Mon–Sat, 10 AM – 6 PM to help with any return or refund queries.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href={SUPPORT_MAILTO}
                className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-[#051d40] transition-opacity hover:opacity-90"
                style={{ background: GOLD }}
              >
                Email Support
              </a>
              <Link
                to="/my-returns"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium text-white/80 transition-all hover:border-white/40 hover:text-white"
              >
                Track My Returns <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
