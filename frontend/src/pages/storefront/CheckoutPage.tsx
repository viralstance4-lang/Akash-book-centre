import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, CreditCard, Loader2, LocateFixed, MapPin, ShoppingBag, Tag, Truck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCart } from "../../api/cart.api";
import { placeOrder, verifyPayment } from "../../api/orders.api";
import { validateCoupon, type CouponValidation } from "../../api/coupons.api";
import { getSettings } from "../../api/settings.api";
import { getShippingSettings, previewShippingCharge } from "../../api/shipping.api";
import { useAuthStore } from "../../store/auth.store";
import type { ShippingAddress } from "../../types";
import {
  SHOP,
  getDeliveryFromCoords,
  getBestPosition,
  haversineKm,
  type DeliveryResult,
} from "../../utils/deliveryUtils";
import AddressAutocomplete, { reverseGeocode, geocodePincode, type PlaceSelection } from "../../components/checkout/AddressAutocomplete";
import MapPinPicker from "../../components/checkout/MapPinPicker";

type ShippingField = keyof ShippingAddress;
type CheckoutOrder = { id: string; razorpayOrderId?: string };

const ADDRESS_FIELDS: ShippingField[] = ["line1", "line2", "city", "state", "pincode"];
declare global { interface Window { Razorpay?: new (options: any) => { open: () => void }; } }

const fmt = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
const initialForm: ShippingAddress = { name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" };

const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
const isRazorpayConfigured = Boolean(
  razorpayKeyId &&
  razorpayKeyId !== "your_razorpay_key_id" &&
  razorpayKeyId.startsWith("rzp_"),
);

export default function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState<ShippingAddress>(initialForm);
  const [email, setEmail] = useState(user?.email ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"ONLINE" | "COD">(isRazorpayConfigured ? "ONLINE" : "COD");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [codSuccess, setCodSuccess]       = useState(false);
  const [codOrderId, setCodOrderId]       = useState("");
  const [onlineSuccess, setOnlineSuccess] = useState(false);
  const [onlineOrderId, setOnlineOrderId] = useState("");
  const [delivery, setDelivery] = useState<DeliveryResult | null>(null);
  const [preciseLocation, setPreciseLocation] = useState<{ lat: number; lng: number } | null>(null);
  // Collapsed fallback for when the address autocomplete has no match / Google
  // Places is unreachable — keeps checkout unblockable without a prominent
  // always-visible pincode field.
  const [showPincodeFallback, setShowPincodeFallback] = useState(false);
  const [placeSelectionKey, setPlaceSelectionKey] = useState(0);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [currentLocationLoading, setCurrentLocationLoading] = useState(false);
  const [currentLocationError, setCurrentLocationError] = useState("");
  // Accuracy radius (meters) the browser reports for its GPS/network fix — laptops
  // and weak-signal phones can be off by hundreds of meters, so this drives a
  // warning nudging the customer to drag the map pin instead of trusting it blindly.
  const [currentLocationAccuracy, setCurrentLocationAccuracy] = useState<number | null>(null);
  // True while the fallback-pincode path is geocoding + previewing a delivery charge.
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["cart"], queryFn: getCart });
  const { data: settingsData } = useQuery({ queryKey: ["site-settings"], queryFn: getSettings });
  const { data: shippingData } = useQuery({ queryKey: ["shipping-settings"], queryFn: getShippingSettings });
  const spiralPrice = Number(settingsData?.data?.spiralBindingPrice ?? 30);
  const shippingSettings = shippingData;

  const cart = data?.data;
  const items = cart?.items ?? [];

  const hasPrintBook     = useMemo(() => items.some((item) => item.book.isPrintBook === true), [items]);
  const hasSpiralBinding = useMemo(() => items.some((item) => item.bindingType === "SPIRAL"), [items]);
  const codBlocked       = hasPrintBook || hasSpiralBinding;

  // Auto-switch to ONLINE when COD is blocked
  useEffect(() => {
    if (codBlocked && paymentMethod === "COD") {
      setPaymentMethod(isRazorpayConfigured ? "ONLINE" : "COD");
    }
  }, [codBlocked, paymentMethod]);

  const handlePlaceSelected = (place: PlaceSelection) => {
    setForm((c) => ({
      ...c,
      line1: place.line1 || c.line1,
      city: place.city || c.city,
      state: place.state || c.state,
      pincode: place.pincode || c.pincode,
    }));
    setFieldErrors((c) => {
      const n = { ...c };
      delete n.line1; delete n.city; delete n.state; delete n.pincode;
      return n;
    });
    if (place.lat != null && place.lng != null) {
      setPreciseLocation({ lat: place.lat, lng: place.lng });
      setPlaceSelectionKey((k) => k + 1);
    }
    setUsingCurrentLocation(false);
    setCurrentLocationAccuracy(null);
    setShowPincodeFallback(false);
  };

  const handleShareCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setCurrentLocationError("Geolocation is not supported by your browser.");
      return;
    }
    setCurrentLocationLoading(true);
    setCurrentLocationError("");
    try {
      const { coords } = await getBestPosition();
      const place = await reverseGeocode(coords.latitude, coords.longitude);
      setForm((c) => ({
        ...c,
        line1: place.line1,
        city: place.city ?? "",
        state: place.state ?? "",
        pincode: place.pincode ?? "",
      }));
      setFieldErrors((c) => {
        const n = { ...c };
        delete n.line1; delete n.city; delete n.state; delete n.pincode;
        return n;
      });
      setPreciseLocation({ lat: coords.latitude, lng: coords.longitude });
      setCurrentLocationAccuracy(coords.accuracy ?? null);
      setPlaceSelectionKey((k) => k + 1);
      setUsingCurrentLocation(true);
      setShowPincodeFallback(false);
      setDelivery(getDeliveryFromCoords(coords.latitude, coords.longitude));
    } catch {
      setCurrentLocationError("Unable to access your location. Please allow location access or enter your address manually.");
    } finally {
      setCurrentLocationLoading(false);
    }
  };

  const verifyPaymentMutation = useMutation({
    mutationFn: ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }: any) =>
      verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      setOnlineOrderId(response.data.id);
      setOnlineSuccess(true);
    },
    onError: (error: any) => setSubmitError(error.response?.data?.message ?? "Payment verification failed."),
  });

  const placeOrderMutation = useMutation({
    mutationFn: ({ address, method, customerEmail }: { address: ShippingAddress; method: "ONLINE" | "COD"; customerEmail: string }) =>
      placeOrder(
        address,
        method,
        customerEmail,
        delivery?.type === "UNKNOWN" ? undefined : (delivery?.type ?? undefined),
        preciseLocation?.lat ?? undefined,
        preciseLocation?.lng ?? undefined,
      ),
    onSuccess: async (response, variables) => {
      const order = response.data as CheckoutOrder;
      if (variables.method === "COD") {
        void queryClient.invalidateQueries({ queryKey: ["cart"] });
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
        setCodOrderId(order.id);
        setCodSuccess(true);
        return;
      }
      if (!window.Razorpay || !isRazorpayConfigured || !order.razorpayOrderId) {
        setSubmitError("Payment gateway not configured. Please use Cash on Delivery.");
        return;
      }
      const rzp = new window.Razorpay({
        key: razorpayKeyId, name: "Akash Book Centre", description: "Complete your order",
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

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.book.price) * item.quantity, 0), [items]);
  const bindingTotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.bindingType === "SPIRAL" ? spiralPrice : 0), 0),
    [items, spiralPrice],
  );
  const totalAmount = subtotal + bindingTotal;
  const discount = appliedCoupon?.discount ?? 0;

  // ── Shipping zone detection (mirrors backend logic) ────────────────────────
  const DELHI_NCR_AREAS = new Set([
    "delhi", "new delhi", "noida", "greater noida",
    "gurugram", "gurgaon", "faridabad", "ghaziabad",
  ]);
  const NORTH_EAST_STATES = new Set([
    "arunachal pradesh", "assam", "manipur",
    "meghalaya", "mizoram", "nagaland", "tripura", "sikkim",
  ]);

  const shippingZone = useMemo(() => {
    const c = form.city.toLowerCase().trim();
    const s = form.state.toLowerCase().trim();
    if (DELHI_NCR_AREAS.has(c) || s === "delhi" || s === "new delhi") return "LOCAL_DELHI_NCR";
    if (NORTH_EAST_STATES.has(s)) return "NORTH_EAST";
    return "ALL_INDIA";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.city, form.state]);

  const zoneLabel = shippingZone === "LOCAL_DELHI_NCR" ? "Delhi NCR"
    : shippingZone === "NORTH_EAST" ? "North East"
    : "All India";

  // Billing weight = book weights + 0.15 kg packaging (mirrors backend PACKAGING_WEIGHT_KG)
  // Minimum 1 kg enforced by ShippingService.sanitize
  const PACKAGING_KG = 0.15;
  const totalWeightKg = useMemo(
    () => Math.max(1, items.reduce((sum, item) => sum + (Number((item.book as any).weight) || 0) * item.quantity, 0) + PACKAGING_KG),
    [items],
  );

  // Geocodes a manually-typed pincode into coordinates — but ONLY as a
  // fallback, when we don't already have a precise location from autocomplete
  // or GPS. Debounced so it doesn't fire on every keystroke. This effect's
  // only job is to resolve `preciseLocation` (and backfill city/state); the
  // effect below is what actually computes the delivery estimate from it,
  // regardless of how it was obtained.
  useEffect(() => {
    if (preciseLocation) return; // already have coordinates from a better source
    const pin = form.pincode.trim();
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setPincodeLookupLoading(true);
      try {
        const place = await geocodePincode(pin);
        if (cancelled) return;
        if (place.lat == null || place.lng == null) throw new Error("No coordinates for pincode");
        setForm((c) => ({ ...c, city: place.city || c.city, state: place.state || c.state }));
        setPreciseLocation({ lat: place.lat, lng: place.lng });
      } catch {
        if (!cancelled) {
          setDelivery({
            type: "UNKNOWN", distanceKm: null,
            label: "Delivery availability unknown",
            sublabel: "We couldn't calculate delivery for this pincode — please confirm your address on the map, or contact us to check.",
          });
        }
      } finally {
        if (!cancelled) setPincodeLookupLoading(false);
      }
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.pincode, preciseLocation]);

  // Resolves the delivery estimate directly from preciseLocation — the actual
  // required input for distance calculation — whenever it's set, regardless
  // of source (autocomplete selection, GPS, or the pincode geocode above).
  // Autocomplete selections for broad localities (e.g. picking "Janakpuri,
  // New Delhi" with no house number) often carry coordinates but no postal
  // code component, so this must not depend on pincode ever being populated.
  // Previews the charge through the same backend ShippingService logic used
  // at real order-creation time, so this estimate can never drift from what
  // the customer is actually charged.
  useEffect(() => {
    // Clear any previously-resolved delivery estimate immediately whenever the
    // location changes — a stale ₹ amount must never stay displayed/payable
    // while a new lookup is in flight.
    setDelivery(null);
    if (!preciseLocation) return;

    let cancelled = false;
    (async () => {
      setPincodeLookupLoading(true);
      try {
        const distanceKm = haversineKm(SHOP.lat, SHOP.lng, preciseLocation.lat, preciseLocation.lng);
        const result = await previewShippingCharge({
          distanceInKm: distanceKm,
          orderValue:   totalAmount,
          weightInKg:   totalWeightKg,
          city: form.city, state: form.state, pincode: form.pincode,
        });
        if (cancelled) return;

        const km = Math.round(distanceKm * 10) / 10;
        setDelivery(
          result.type === "FREE" || result.type === "DISABLED"
            ? { type: "FREE", distanceKm: km, label: "Free Delivery Available", sublabel: `You are ${km} km from our store` }
            : { type: "PAID", distanceKm: km, label: "Delivery Charges May Apply", sublabel: `You are ${km} km from our store` },
        );
      } catch {
        if (!cancelled) {
          setDelivery({
            type: "UNKNOWN", distanceKm: null,
            label: "Delivery availability unknown",
            sublabel: "We couldn't calculate delivery for this location — please try again, or contact us to check.",
          });
        }
      } finally {
        if (!cancelled) setPincodeLookupLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preciseLocation]);

  // Zone rate from public config
  const zoneRate = useMemo(() => {
    if (!shippingSettings) return 0;
    if (shippingZone === "LOCAL_DELHI_NCR") return shippingSettings.localZoneRate ?? 50;
    if (shippingZone === "NORTH_EAST")      return shippingSettings.northEastRate  ?? 80;
    return shippingSettings.defaultKgRate ?? 70;
  }, [shippingZone, shippingSettings]);

  // Whether the customer is within the local distance-based radius — beyond this,
  // pricing switches to weight/zone-based (mirrors backend distanceThreshold).
  const isLocalDelivery = delivery?.distanceKm != null && delivery.distanceKm <= (shippingSettings?.freeRadius ?? 3);

  // Flat area charge per zone (only for weight-based, beyond the local radius).
  // delivery?.distanceKm == null (nothing resolved yet, or a new pincode
  // lookup just cleared the previous result) must NOT fall into the
  // "beyond radius" branch below — that would silently charge a real
  // weight-based fee with no location actually resolved.
  const areaCharge = useMemo(() => {
    if (!shippingSettings || !shippingSettings.isShippingEnabled || isLocalDelivery || delivery?.distanceKm == null) return 0;
    if (shippingZone === "LOCAL_DELHI_NCR") return shippingSettings.localZoneAreaCharge ?? 0;
    if (shippingZone === "NORTH_EAST")      return shippingSettings.northEastAreaCharge ?? 0;
    return shippingSettings.defaultAreaCharge ?? 0;
  }, [isLocalDelivery, delivery?.distanceKm, shippingSettings, shippingZone]);

  // Weight-based charge component (weight × zone rate, or distance × perKmRate for local)
  const weightCharge = useMemo(() => {
    if (!shippingSettings || !shippingSettings.isShippingEnabled) return 0;
    const distance = delivery?.distanceKm ?? null;
    if (distance === null) return 0; // unresolved — nothing to charge yet
    if (distance <= (shippingSettings.freeRadius ?? 3)) {
      if (totalAmount >= shippingSettings.freeDeliveryThreshold) return 0;
      // Round distance UP to the next whole km before billing (2.9km & 3.0km bill as 3km; 3.2km bills as 4km)
      return Math.ceil(distance) * Number(shippingSettings.perKmCharge);
    }
    return Math.round(totalWeightKg * zoneRate);
  }, [delivery?.distanceKm, shippingSettings, totalAmount, totalWeightKg, zoneRate]);

  // Total delivery = area charge (flat zone fee) + weight charge
  const deliveryCharge = areaCharge + weightCharge;

  // Derive actual delivery type for the status card — accounts for order value, not just distance
  const displayDeliveryType = useMemo(() => {
    if (!delivery) return null;
    if (delivery.type === "UNKNOWN") return "UNKNOWN" as const;
    if (!shippingSettings?.isShippingEnabled) return delivery.type;
    // Within the local radius: FREE only when the order meets the minimum; otherwise PAID
    if (delivery.type === "FREE") return deliveryCharge === 0 ? "FREE" : ("PAID" as const);
    return delivery.type;
  }, [delivery, deliveryCharge, shippingSettings]);

  // Calculate prepaid discount
  const prepaidDiscount = useMemo(() => {
    if (paymentMethod !== "ONLINE" || !shippingSettings) return 0;
    const amount = totalAmount;
    if (shippingSettings.prepaidDiscountType === "PERCENT") {
      return amount * (Number(shippingSettings.prepaidDiscountValue) / 100);
    } else {
      return Number(shippingSettings.prepaidDiscountValue);
    }
  }, [paymentMethod, totalAmount, shippingSettings]);

  const finalAmount = totalAmount + deliveryCharge - discount - prepaidDiscount;

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
    if (!form.pincode.trim()) {
      errs.pincode = "Please select your address from the suggestions, share your location, or enter your pincode below";
      setShowPincodeFallback(true);
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (field: ShippingField, value: string) => {
    setForm((c) => ({ ...c, [field]: value }));
    setFieldErrors((c) => { const n = { ...c }; delete n[field]; return n; });
    setSubmitError("");
    if (usingCurrentLocation && ADDRESS_FIELDS.includes(field)) {
      setUsingCurrentLocation(false);
      setPreciseLocation(null);
      setCurrentLocationAccuracy(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (pincodeLookupLoading) { setSubmitError("Please wait — calculating your delivery charge."); return; }
    setSubmitError("");
    placeOrderMutation.mutate({ address: form, method: paymentMethod, customerEmail: email });
  };

  if (onlineSuccess) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-8 py-12 text-center max-w-md w-full">
          <CheckCircle size={52} className="mx-auto text-emerald-500" />
          <h2 className="mt-5 font-serif text-2xl text-text-primary">Order Placed!</h2>
          <p className="mt-2 text-sm text-text-muted">Payment successful. Your order has been confirmed.</p>
          {email && <p className="mt-1 text-xs text-text-muted">Invoice sent to: <strong>{email}</strong></p>}
          <button onClick={() => navigate(`/orders/${onlineOrderId}`)}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#1d1a17] py-3 text-sm text-white hover:bg-black transition-all">
            View Order Details
          </button>
        </div>
      </div>
    );
  }

  if (codSuccess) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-8 py-12 text-center max-w-md w-full">
          <CheckCircle size={52} className="mx-auto text-emerald-500" />
          <h2 className="mt-5 font-serif text-2xl text-text-primary">Order Placed!</h2>
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

      {/* Delivery Banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <Truck size={17} className="text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-800">{SHOP.name}</p>
          <p className="text-xs text-emerald-600">Free delivery within {shippingSettings?.freeRadius ?? 3} km on orders ₹{shippingSettings?.freeDeliveryThreshold ?? 199}+ · Add your address below to check</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.9fr)]">
        <div className="space-y-4">
          {/* Payment Method */}
          <section className="rounded-2xl border border-black/8 bg-white p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Payment Method</p>

            {hasPrintBook && (
              <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
                <p className="text-xs text-amber-700 leading-relaxed">
                  This order contains <strong>Print Books</strong> — Cash on Delivery is unavailable. Only online payment is accepted.
                </p>
              </div>
            )}
            {!hasPrintBook && hasSpiralBinding && (
              <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Cash on Delivery is unavailable for <strong>Spiral Binding</strong> orders. Online payment required.
                </p>
              </div>
            )}

            <div className={`grid gap-3 ${isRazorpayConfigured ? "grid-cols-2" : "grid-cols-1"}`}>
              {isRazorpayConfigured && (
                <button type="button" onClick={() => setPaymentMethod("ONLINE")}
                  className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${paymentMethod === "ONLINE" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
                  <CreditCard size={20} className={paymentMethod === "ONLINE" ? "text-[#1d1a17]" : "text-text-muted"} />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Online Payment</p>
                    <p className="text-xs text-text-muted">UPI, Card, NetBanking</p>
                    {prepaidDiscount > 0 && (
                      <p className="text-xs text-emerald-600 font-medium">Save ₹{fmt(prepaidDiscount)}</p>
                    )}
                  </div>
                </button>
              )}
              <button
                type="button"
                onClick={() => !codBlocked && setPaymentMethod("COD")}
                disabled={codBlocked}
                title={
                  hasPrintBook
                    ? "Cash on Delivery is unavailable for Print Books"
                    : hasSpiralBinding
                    ? "COD not available for Spiral Binding orders"
                    : undefined
                }
                className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                  paymentMethod === "COD" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"
                } ${codBlocked ? "cursor-not-allowed opacity-40" : ""}`}
              >
                <Truck size={20} className={paymentMethod === "COD" ? "text-[#1d1a17]" : "text-text-muted"} />
                <div>
                  <p className="text-sm font-semibold text-text-primary">Cash on Delivery</p>
                  {codBlocked ? (
                    <p className="text-xs text-red-500 font-medium">
                      {hasPrintBook ? "Unavailable for Print Books" : "Unavailable for Spiral Binding"}
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-600 font-medium">FREE · No extra charge</p>
                  )}
                </div>
              </button>
            </div>
            {!isRazorpayConfigured && !codBlocked && (
              <p className="mt-2 text-xs text-text-muted">Online payment is currently unavailable. Cash on Delivery is available.</p>
            )}
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
              ] as Array<[ShippingField, string, boolean]>).map(([field, label, full]) => (
                <label key={field} className={`${full ? "sm:col-span-2" : ""} block`}>
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-text-muted">{label}</span>
                  <input type="text" value={form[field] ?? ""} onChange={(e) => handleChange(field, e.target.value)}
                    className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors[field] ? "border-red-300" : "border-black/10 focus:border-black/20"}`} />
                  {fieldErrors[field] && <p className="mt-1 text-xs text-red-500">{fieldErrors[field]}</p>}
                </label>
              ))}

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleShareCurrentLocation}
                  disabled={currentLocationLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#f8f4ee] px-4 py-2 text-xs font-medium text-text-primary transition-all hover:border-black/20 hover:bg-white disabled:opacity-50"
                >
                  <LocateFixed size={14} className={currentLocationLoading ? "animate-spin" : ""} />
                  {currentLocationLoading ? "Getting your location…" : "Share your current location"}
                </button>
                {currentLocationError && <p className="mt-1.5 text-xs text-amber-600">{currentLocationError}</p>}
                {usingCurrentLocation && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <CheckCircle size={12} className="shrink-0" /> Using your current location — clear it by editing the address manually.
                  </p>
                )}
                {usingCurrentLocation && currentLocationAccuracy != null && currentLocationAccuracy > 200 && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    Your device's location is only accurate to ~{Math.round(currentLocationAccuracy)}m (common on laptops/weak GPS signal) — please drag the pin on the map below to your exact address.
                  </p>
                )}
              </div>

              <label className="sm:col-span-2 block">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-text-muted">Address Line 1</span>
                <AddressAutocomplete
                  value={form.line1}
                  onChange={(v) => handleChange("line1", v)}
                  onPlaceSelected={handlePlaceSelected}
                  placeholder="Start typing your address..."
                  className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors.line1 ? "border-red-300" : "border-black/10 focus:border-black/20"}`}
                />
                {fieldErrors.line1 && <p className="mt-1 text-xs text-red-500">{fieldErrors.line1}</p>}
              </label>

              {/* Pincode fallback — collapsed by default; only relevant while we don't
                  yet have any location signal (autocomplete/GPS normally supply this). */}
              {!preciseLocation && (
                <div className="sm:col-span-2">
                  {!showPincodeFallback ? (
                    <button type="button" onClick={() => setShowPincodeFallback(true)}
                      className="text-xs font-medium text-text-muted underline decoration-dotted underline-offset-2 hover:text-text-primary">
                      Can't find your address? Enter pincode manually
                    </button>
                  ) : (
                    <label className="block">
                      <span className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-text-muted">Pincode</span>
                      <input
                        type="text"
                        value={form.pincode}
                        onChange={(e) => handleChange("pincode", e.target.value)}
                        maxLength={6}
                        placeholder="6-digit pincode"
                        className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors.pincode ? "border-red-300" : "border-black/10 focus:border-black/20"}`}
                      />
                    </label>
                  )}
                  {fieldErrors.pincode && <p className="mt-1 text-xs text-red-500">{fieldErrors.pincode}</p>}
                </div>
              )}

              {(preciseLocation || form.pincode.trim().length === 6) && (
                <label className="sm:col-span-2 block">
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-text-muted">Complete Address (House/Flat No., Floor, Landmark) — optional</span>
                  <input type="text" value={form.line2 ?? ""} onChange={(e) => handleChange("line2", e.target.value)}
                    placeholder="e.g. House No. 5, 2nd Floor, Near Water Tank"
                    className="h-11 w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 text-sm outline-none focus:border-black/20 focus:bg-white transition-all" />
                  <p className="mt-1 text-[11px] text-text-muted">Helps the delivery rider find you faster.</p>
                </label>
              )}

              {preciseLocation && (
                <div className="sm:col-span-2">
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-text-muted">Confirm exact location</span>
                  <MapPinPicker
                    key={placeSelectionKey}
                    lat={preciseLocation.lat}
                    lng={preciseLocation.lng}
                    onPositionChange={(lat, lng) => setPreciseLocation({ lat, lng })}
                  />
                  <p className="mt-1.5 text-[11px] text-text-muted">Drag the pin to fine-tune your exact location for the delivery rider.</p>
                </div>
              )}

              {/* Delivery lookup loading state (fallback-pincode path only) */}
              {pincodeLookupLoading && !delivery && (
                <div className="sm:col-span-2 flex items-center gap-2.5 rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5">
                  <Loader2 size={15} className="shrink-0 animate-spin text-text-muted" />
                  <p className="text-xs text-text-muted">Checking delivery for this pincode…</p>
                </div>
              )}

              {/* Delivery status card */}
              {delivery && (
                <div className={`sm:col-span-2 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 ${
                  displayDeliveryType === "FREE"
                    ? "border-emerald-200 bg-emerald-50"
                    : displayDeliveryType === "PAID"
                    ? "border-amber-200 bg-amber-50"
                    : "border-black/10 bg-[#f8f4ee]"
                }`}>
                  <Truck size={15} className={
                    displayDeliveryType === "FREE" ? "text-emerald-600 shrink-0" :
                    displayDeliveryType === "PAID" ? "text-amber-600 shrink-0" :
                    "text-text-muted shrink-0"
                  } />
                  <div>
                    <p className={`text-xs font-semibold ${
                      displayDeliveryType === "FREE" ? "text-emerald-700" :
                      displayDeliveryType === "PAID" ? "text-amber-700" :
                      "text-text-muted"
                    }`}>
                      {displayDeliveryType === "FREE"
                        ? "Free Delivery"
                        : deliveryCharge > 0
                          ? `Delivery Charge: ${fmt(deliveryCharge)}`
                          : delivery.label}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {displayDeliveryType === "PAID" && deliveryCharge > 0
                        ? isLocalDelivery
                          ? `${Math.ceil(delivery.distanceKm ?? 0)} km × ₹${shippingSettings?.perKmCharge}/km`
                          : `${totalWeightKg} kg × ₹${zoneRate}/kg · ${delivery.sublabel}`
                        : delivery.sublabel}
                    </p>
                  </div>
                </div>
              )}

              {([
                ["city", "City", false], ["state", "State", false],
              ] as Array<[ShippingField, string, boolean]>).map(([field, label, full]) => (
                <label key={field} className={`${full ? "sm:col-span-2" : ""} block`}>
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-text-muted">{label}</span>
                  <input type="text" value={form[field] ?? ""} onChange={(e) => handleChange(field, e.target.value)}
                    className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors[field] ? "border-red-300" : "border-black/10 focus:border-black/20"}`} />
                  {fieldErrors[field] && <p className="mt-1 text-xs text-red-500">{fieldErrors[field]}</p>}
                </label>
              ))}

              {preciseLocation && (
                <p className="sm:col-span-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                  <CheckCircle size={12} className="shrink-0" /> Precise location captured from your address for the delivery rider ✓
                </p>
              )}

              {submitError && <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{submitError}</div>}

              <div className="sm:col-span-2">
                <button type="submit" disabled={placeOrderMutation.isPending || verifyPaymentMutation.isPending || pincodeLookupLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1d1a17] py-3.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-60">
                  {placeOrderMutation.isPending || verifyPaymentMutation.isPending
                    ? "Processing..."
                    : pincodeLookupLoading
                      ? "Calculating delivery charge…"
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
            {shippingSettings?.isShippingEnabled && delivery?.distanceKm != null && (
              deliveryCharge === 0
                ? <div className="flex justify-between text-sm text-emerald-600"><span>Delivery</span><span>Free Delivery</span></div>
                : !isLocalDelivery
                  ? <>
                      {areaCharge > 0 && (
                        <div className="flex justify-between text-sm text-amber-600">
                          <span>Area Charge <span className="text-xs font-normal text-text-muted">({zoneLabel})</span></span>
                          <span>+{fmt(areaCharge)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm text-amber-600">
                        <span>Shipping Charge <span className="text-xs font-normal text-text-muted">({totalWeightKg} kg × ₹{zoneRate}/kg)</span></span>
                        <span>+{fmt(weightCharge)}</span>
                      </div>
                    </>
                  : <div className="flex justify-between text-sm text-amber-600">
                      <span>Delivery Charge <span className="text-xs font-normal text-text-muted">({Math.ceil(delivery?.distanceKm ?? 0)} km × ₹{shippingSettings?.perKmCharge}/km)</span></span>
                      <span>+{fmt(deliveryCharge)}</span>
                    </div>
            )}
            {discount > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Coupon Discount</span><span>-{fmt(discount)}</span></div>}
            {prepaidDiscount > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Prepaid Discount</span><span>-{fmt(prepaidDiscount)}</span></div>}
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
