import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, CreditCard, MapPin, ShoppingBag, Tag, Truck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCart } from "../../api/cart.api";
import { placeOrder, verifyPayment } from "../../api/orders.api";
import { validateCoupon, type CouponValidation } from "../../api/coupons.api";
import { getSettings } from "../../api/settings.api";
import { useAuthStore } from "../../store/auth.store";
import type { ShippingAddress } from "../../types";

type ShippingField = keyof ShippingAddress;
type CheckoutOrder = { id: string; razorpayOrderId?: string };
declare global { interface Window { Razorpay?: new (options: any) => { open: () => void }; } }

const fmt = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
const initialForm: ShippingAddress = { name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" };

export default function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState<ShippingAddress>(initialForm);
  const [email, setEmail] = useState(user?.email ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"ONLINE" | "COD">("ONLINE");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [codSuccess, setCodSuccess] = useState(false);
  const [codOrderId, setCodOrderId] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["cart"], queryFn: getCart });
  const { data: settingsData } = useQuery({ queryKey: ["site-settings"], queryFn: getSettings });
  const spiralPrice = Number(settingsData?.data?.spiralBindingPrice ?? 30);

  const verifyPaymentMutation = useMutation({
    mutationFn: ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }: any) =>
      verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      navigate(`/orders/${response.data.id}`);
    },
    onError: (error: any) => setSubmitError(error.response?.data?.message ?? "Payment verification failed."),
  });

  const placeOrderMutation = useMutation({
    mutationFn: ({ address, method, customerEmail }: { address: ShippingAddress; method: "ONLINE" | "COD"; customerEmail: string }) =>
      placeOrder(address, method, customerEmail),
    onSuccess: async (response, variables) => {
      const order = response.data as CheckoutOrder;
      if (variables.method === "COD") {
        void queryClient.invalidateQueries({ queryKey: ["cart"] });
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
        setCodOrderId(order.id);
        setCodSuccess(true);
        return;
      }
      const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!window.Razorpay || !razorpayKeyId || !order.razorpayOrderId) {
        setSubmitError("Payment gateway not configured. Please use Cash on Delivery.");
        return;
      }
      const rzp = new window.Razorpay({
        key: razorpayKeyId, name: "BucketList Books", description: "Complete your order",
        order_id: order.razorpayOrderId,
        handler: async (r: any) => await verifyPaymentMutation.mutateAsync({
          razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature,
        }),
        prefill: { name: form.name || user?.name, email: variables.customerEmail || user?.email, contact: form.phone },
        theme: { color: "#1d1a17" },
        modal: { ondismiss: () => setSubmitError("Payment was cancelled.") },
      });
      rzp.open();
    },
    onError: (error: any) => setSubmitError(error.response?.data?.message ?? "Couldn't place your order."),
  });

  const cart = data?.data;
  const items = cart?.items ?? [];
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.book.price) * item.quantity, 0), [items]);
  const bindingTotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.bindingType === "SPIRAL" ? spiralPrice : 0), 0),
    [items, spiralPrice],
  );
  const discount = appliedCoupon?.discount ?? 0;
  const finalAmount = subtotal + bindingTotal - discount;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true); setCouponError("");
    try {
      const result = await validateCoupon(couponCode.trim(), subtotal);
      setAppliedCoupon(result.data);
    } catch (e: any) {
      setCouponError(e?.response?.data?.message ?? "Invalid coupon"); setAppliedCoupon(null);
    } finally { setCouponLoading(false); }
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Email is required";
    if (!form.name.trim()) errs.name = "Required";
    if (!form.phone.trim()) errs.phone = "Required";
    if (!form.line1.trim()) errs.line1 = "Required";
    if (!form.city.trim()) errs.city = "Required";
    if (!form.state.trim()) errs.state = "Required";
    if (!form.pincode.trim()) errs.pincode = "Required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (field: ShippingField, value: string) => {
    setForm((c) => ({ ...c, [field]: value }));
    setFieldErrors((c) => { const n = { ...c }; delete n[field]; return n; });
    setSubmitError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitError("");
    placeOrderMutation.mutate({ address: form, method: paymentMethod, customerEmail: email });
  };

  if (codSuccess) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-8 py-12 text-center max-w-md w-full">
          <CheckCircle size={52} className="mx-auto text-emerald-500" />
          <h2 className="mt-5 font-serif text-2xl text-text-primary">Order Placed! 🎉</h2>
          <p className="mt-2 text-sm text-text-muted">Your COD order has been placed successfully.</p>
          {email && <p className="mt-1 text-xs text-text-muted">Invoice sent to: <strong>{email}</strong></p>}
          <button onClick={() => navigate(`/orders/${codOrderId}`)}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#1d1a17] py-3 text-sm text-white hover:bg-black transition-all">
            View Order Details
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.9fr)]"><div className="h-96 animate-pulse rounded-2xl bg-white" /><div className="h-80 animate-pulse rounded-2xl bg-white" /></div>;

  if (items.length === 0) return (
    <div className="rounded-2xl border border-dashed border-black/10 bg-white px-8 py-16 text-center">
      <ShoppingBag className="mx-auto h-10 w-10 text-text-muted" />
      <h1 className="mt-5 font-serif text-3xl text-text-primary">Nothing to checkout</h1>
      <Link to="/" className="mt-5 inline-flex items-center rounded-full bg-[#1d1a17] px-5 py-3 text-sm text-white hover:bg-black">Back to store</Link>
    </div>
  );

  return (
    <div className="space-y-5">
      <Link to="/cart" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft size={15} /> Back to cart
      </Link>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.9fr)]">
        <div className="space-y-4">
          {/* Payment Method */}
          <section className="rounded-2xl border border-black/8 bg-white p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Payment Method</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setPaymentMethod("ONLINE")}
                className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${paymentMethod === "ONLINE" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
                <CreditCard size={20} className={paymentMethod === "ONLINE" ? "text-[#1d1a17]" : "text-text-muted"} />
                <div>
                  <p className="text-sm font-semibold text-text-primary">Online Payment</p>
                  <p className="text-xs text-text-muted">UPI, Card, NetBanking</p>
                </div>
              </button>
              <button type="button" onClick={() => setPaymentMethod("COD")}
                className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${paymentMethod === "COD" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
                <Truck size={20} className={paymentMethod === "COD" ? "text-[#1d1a17]" : "text-text-muted"} />
                <div>
                  <p className="text-sm font-semibold text-text-primary">Cash on Delivery</p>
                  <p className="text-xs text-emerald-600 font-medium">FREE · No extra charge</p>
                </div>
              </button>
            </div>
          </section>

          {/* Shipping Form */}
          <section className="rounded-2xl border border-black/8 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4efe7]">
                <MapPin size={16} className="text-text-primary" />
              </div>
              <h1 className="font-serif text-xl text-text-primary">Shipping Details</h1>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 block">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-text-muted">Email Address * (invoice will be sent here)</span>
                <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErrors((c) => { const n = { ...c }; delete n.email; return n; }); }}
                  placeholder="your@email.com"
                  className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors.email ? "border-red-300" : "border-black/10 focus:border-black/20"}`} />
                {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
              </label>

              {([
                ["name", "Full Name", false], ["phone", "Phone Number", false],
                ["line1", "Address Line 1", true], ["line2", "Address Line 2 (optional)", true],
                ["city", "City", false], ["state", "State", false], ["pincode", "Pincode", false],
              ] as Array<[ShippingField, string, boolean]>).map(([field, label, full]) => (
                <label key={field} className={`${full ? "sm:col-span-2" : ""} block`}>
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-text-muted">{label}</span>
                  <input type="text" value={form[field] ?? ""} onChange={(e) => handleChange(field, e.target.value)}
                    className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors[field] ? "border-red-300" : "border-black/10 focus:border-black/20"}`} />
                  {fieldErrors[field] && <p className="mt-1 text-xs text-red-500">{fieldErrors[field]}</p>}
                </label>
              ))}

              {submitError && <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{submitError}</div>}

              <div className="sm:col-span-2">
                <button type="submit" disabled={placeOrderMutation.isPending || verifyPaymentMutation.isPending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1d1a17] py-3.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-60">
                  {placeOrderMutation.isPending || verifyPaymentMutation.isPending
                    ? "Processing..."
                    : paymentMethod === "COD" ? "Place Order (Pay on Delivery)" : "Proceed to Payment"}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Order Summary */}
        <aside className="h-fit rounded-2xl border border-black/8 bg-white p-5">
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">Order Summary</p>
          <h2 className="mt-2 font-serif text-2xl text-text-primary">Your Items</h2>

          <div className="mt-4 max-h-64 space-y-3 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-xl bg-[#f8f4ee] p-3">
                <img src={item.book.coverImageUrl} alt={item.book.title} className="h-14 w-11 rounded-lg object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{item.book.title}</p>
                  <p className="text-xs text-text-muted">Qty: {item.quantity}</p>
                  {item.bindingType !== "NONE" && (
                    <p className={`text-[10px] font-medium ${item.bindingType === "SPIRAL" ? "text-amber-600" : "text-gray-500"}`}>
                      {item.bindingType === "SPIRAL" ? `Spiral Binding +${fmt(spiralPrice)}` : "Staple Binding"}
                    </p>
                  )}
                  <p className="text-sm font-medium text-[#8f2d22]">
                    {fmt((Number(item.book.price) + (item.bindingType === "SPIRAL" ? spiralPrice : 0)) * item.quantity)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Coupon */}
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-widest text-text-muted">Coupon Code</p>
            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800">{appliedCoupon.coupon.code}</p>
                    <p className="text-xs text-emerald-600">You save {fmt(discount)}</p>
                  </div>
                </div>
                <button type="button" onClick={() => { setAppliedCoupon(null); setCouponCode(""); }} className="rounded-full p-1 text-emerald-600 hover:bg-emerald-100"><X size={14} /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                  placeholder="Enter coupon code"
                  className="flex-1 rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm uppercase outline-none focus:bg-white" />
                <button type="button" onClick={handleApplyCoupon} disabled={couponLoading || !couponCode}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d1a17] px-4 py-2.5 text-sm text-white hover:bg-black disabled:opacity-50">
                  <Tag size={13} />{couponLoading ? "..." : "Apply"}
                </button>
              </div>
            )}
            {couponError && <p className="mt-1.5 text-xs text-red-500">{couponError}</p>}
          </div>

          {/* Price Breakdown */}
          <div className="mt-4 space-y-2 border-t border-black/8 pt-4">
            <div className="flex justify-between text-sm text-text-muted"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            {bindingTotal > 0 && (
              <div className="flex justify-between text-sm text-amber-600">
                <span>Binding Charges</span><span>+{fmt(bindingTotal)}</span>
              </div>
            )}
            {discount > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Discount</span><span>-{fmt(discount)}</span></div>}
            <div className="flex justify-between text-sm text-text-muted"><span>Shipping</span><span className="text-emerald-600">Free</span></div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Payment</span>
              <span className={`font-medium ${paymentMethod === "COD" ? "text-amber-600" : "text-blue-600"}`}>
                {paymentMethod === "COD" ? "Cash on Delivery" : "Online"}
              </span>
            </div>
            <div className="flex justify-between border-t border-black/8 pt-2">
              <span className="font-serif text-lg text-text-primary">Total</span>
              <span className="font-serif text-2xl text-[#8f2d22]">{fmt(finalAmount)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
