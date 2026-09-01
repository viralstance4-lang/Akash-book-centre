import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle, Check, CheckCircle, Clock, CreditCard, Eye,
  FileText, Loader2, LocateFixed, Minus, Pencil, Plus, ShieldCheck, Trash2, Truck, Upload, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { getPrintSettings, createPrintOrder, verifyPrintPayment } from "../../api/print.api";
import type { PrintOrderInitiated } from "../../api/print.api";
import { getShippingSettings, previewShippingCharge } from "../../api/shipping.api";
import {
  SHOP,
  getDeliveryFromCoords,
  getBestPosition,
  haversineKm,
  type DeliveryResult,
} from "../../utils/deliveryUtils";
import AddressAutocomplete, { reverseGeocode, geocodePincode, type PlaceSelection } from "../../components/checkout/AddressAutocomplete";
import MapPinPicker from "../../components/checkout/MapPinPicker";
import { useAuthStore } from "../../store/auth.store";
import { loadRazorpayScript } from "../../utils/loadRazorpay";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ─── Types ────────────────────────────────────────────────────────────────────
type ColorType   = "color" | "bw";
type PrintSide   = "single" | "both";
type Orientation = "portrait" | "landscape";
type BindingType = "spiral" | "stapler";

type PdfFile = {
  id:              string;
  file:            File;
  pageCount:       number;   // 0 = detection failed, requires manual entry
  detecting:       boolean;
  detectionFailed: boolean;
  overriding:      boolean;  // manual edit mode toggled on after a successful auto-detect
  copies:          number;
  previewUrl:      string;
};

const MAX_FILE_SIZE_BYTES = 70 * 1024 * 1024; // mirrors the backend's multer limit (printorders.routes.ts)

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v);

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
    try { return (crypto as any).randomUUID(); } catch { /* fall through */ }
  }
  const arr = new Uint8Array(16);
  (crypto as any).getRandomValues(arr);
  arr[6] = (arr[6] & 0x0f) | 0x40;
  arr[8] = (arr[8] & 0x3f) | 0x80;
  const h = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/**
 * Count pages in a PDF using pdf.js, which fully parses the page tree
 * (including compressed object streams that a raw byte/regex scan can't see).
 * Returns 0 when the file can't be parsed (encrypted / corrupted PDF).
 */
async function autoDetectPageCount(file: File): Promise<number> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
    const count = doc.numPages;
    await doc.destroy();
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch (err) {
    // console.error (not .warn) so this isn't filtered out by default devtools
    // log levels — a wrong result here silently breaks pricing for every order.
    console.error(`[PDF DETECT] Failed to parse "${file.name}":`, err);
    return 0;
  }
}

// ─── Pricing engine (mirrors backend getPricePerPage) ────────────────────────

type PricingSettings = {
  bwSingleSide: number; bwBothSideUnder20: number; bwBothSideAbove20: number;
  colorSingleSide: number; colorBothSideUnder20: number; colorBothSideAbove20: number;
  colorAbove99: number; spiralExtra: number; staplerExtra: number; maxPdfsPerOrder: number;
};

function getPricePerPage(totalRawPages: number, side: PrintSide, color: ColorType, s: PricingSettings): number {
  if (color === "bw") {
    if (side === "single") return s.bwSingleSide;
    return totalRawPages < 20 ? s.bwBothSideUnder20 : s.bwBothSideAbove20;
  }
  if (totalRawPages > 99) return s.colorAbove99;
  if (side === "single") return s.colorSingleSide;
  return totalRawPages < 20 ? s.colorBothSideUnder20 : s.colorBothSideAbove20;
}

/**
 * Double-side (B&W or Color) prints 2 pages per physical sheet, so the
 * billable quantity is ~half the page count — computed on the order's
 * combined total (sum of every file's pages × copies), ceiled ONCE, not
 * per file. Single-side bills the full page count, unchanged. Tier
 * selection (getPricePerPage) always stays on the true page count
 * regardless — only the quantity charged at that rate is halved here.
 */
function calcBillablePages(filePageCounts: number[], fileCopies: number[], side: PrintSide): number {
  const totalWeightedPages = filePageCounts.reduce((sum, pc, i) => sum + pc * (fileCopies[i] ?? 1), 0);
  return side === "both" ? Math.ceil(totalWeightedPages / 2) : totalWeightedPages;
}

function calcPrice(
  totalRawPages: number,
  filePageCounts: number[],
  fileCopies: number[],
  side: PrintSide,
  color: ColorType,
  binding: BindingType,
  s: PricingSettings,
) {
  const ppp           = getPricePerPage(totalRawPages, side, color, s);
  const billablePages = calcBillablePages(filePageCounts, fileCopies, side);
  const totalCopies   = fileCopies.reduce((acc, c) => acc + c, 0);
  const printCost     = ppp * billablePages;
  const bindingCost   = (binding === "spiral" ? s.spiralExtra : s.staplerExtra) * totalCopies;
  return { ppp, printCost, bindingCost, billablePages, totalCopies, total: Math.max(0, Math.round((printCost + bindingCost) * 100) / 100) };
}

const estimateMins = (billablePages: number) => Math.max(1, Math.ceil(billablePages / 60));

const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
const isRazorpayConfigured = Boolean(razorpayKeyId && razorpayKeyId !== "your_razorpay_key_id" && razorpayKeyId?.startsWith("rzp_"));

// ─── Component ────────────────────────────────────────────────────────────────
export default function PrintBookPage() {
  const navigate     = useNavigate();
  const isAuth       = useAuthStore((s) => s.isAuthenticated);
  const user         = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["print-settings"],
    queryFn: getPrintSettings,
  });

  const { data: shippingSettings } = useQuery({
    queryKey: ["shipping-settings"],
    queryFn: getShippingSettings,
  });
  const rawS = settingsData?.data;

  // S is always a non-null PricingSettings object. When the API hasn't
  // responded yet, the numeric fields default to 0 so nothing is displayed
  // (the early-return below shows a spinner until rawS arrives).
  const S: PricingSettings & { maxPdfsPerOrder: number } = {
    bwSingleSide:         Number(rawS?.bwSingleSide         ?? 1),
    bwBothSideUnder20:    Number(rawS?.bwBothSideUnder20    ?? 2),
    bwBothSideAbove20:    Number(rawS?.bwBothSideAbove20    ?? 1),
    colorSingleSide:      Number(rawS?.colorSingleSide      ?? 8),
    colorBothSideUnder20: Number(rawS?.colorBothSideUnder20 ?? 10),
    colorBothSideAbove20: Number(rawS?.colorBothSideAbove20 ?? 8),
    colorAbove99:         Number(rawS?.colorAbove99         ?? 6),
    spiralExtra:          Number(rawS?.spiralExtra          ?? 30),
    staplerExtra:         Number(rawS?.staplerExtra         ?? 0),
    maxPdfsPerOrder:      Number(rawS?.maxPdfsPerOrder      ?? 20),
  };

  // ── Form state ─────────────────────────────────────────────────────────────
  const [pdfs,        setPdfs]        = useState<PdfFile[]>([]);
  const [dragOver,    setDragOver]    = useState(false);
  const [colorType,   setColorType]   = useState<ColorType>("bw");
  const [printSide,   setPrintSide]   = useState<PrintSide>("both");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [bindingType, setBindingType] = useState<BindingType>("stapler");
  const [email,       setEmail]       = useState(user?.email ?? "");
  const [name,        setName]        = useState(user?.name ?? "");
  const [phone,       setPhone]       = useState("");
  const [address,     setAddress]     = useState("");
  // House/flat no., floor, landmark, etc. — kept separate from `address` and
  // only joined into the single `customerAddress` string sent to the backend
  // at submit time (print orders have no structured line2 field).
  const [completeAddress, setCompleteAddress] = useState("");
  const [pincode,     setPincode]     = useState("");
  // Structured city/state, resolved via Google Places reverse-geocode alongside
  // `address` — used for delivery zone detection (Delhi NCR / North East / All
  // India), same as CheckoutPage.tsx's shippingAddress.city/state.
  const [customerCity,  setCustomerCity]  = useState("");
  const [customerState, setCustomerState] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fileError,   setFileError]   = useState("");

  // ── Delivery state ─────────────────────────────────────────────────────────
  const [delivery,    setDelivery]    = useState<DeliveryResult | null>(null);

  // ── Precise (GPS) location for the delivery rider ─────────────────────────
  const [preciseLocation,       setPreciseLocation]       = useState<{ lat: number; lng: number } | null>(null);
  const [usingCurrentLocation,  setUsingCurrentLocation]  = useState(false);
  const [locatingCurrent,       setLocatingCurrent]       = useState(false);
  const [currentLocationError,  setCurrentLocationError]  = useState("");
  const [placeSelectionKey,     setPlaceSelectionKey]     = useState(0);
  // Collapsed fallback for when the address autocomplete has no match / Google
  // Places is unreachable — keeps checkout unblockable without a prominent
  // always-visible pincode field.
  const [showPincodeFallback, setShowPincodeFallback] = useState(false);
  // Accuracy radius (meters) the browser reports for its GPS/network fix — laptops
  // and weak-signal phones can be off by hundreds of meters, so this drives a
  // warning nudging the customer to drag the map pin instead of trusting it blindly.
  const [currentLocationAccuracy, setCurrentLocationAccuracy] = useState<number | null>(null);
  // True while the fallback-pincode path is geocoding + previewing a delivery charge.
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false);
  // Beyond-3km delivery charge, previewed via the real backend ShippingService
  // logic (null while unknown/loading — see the effect below).
  const [remoteDeliveryCharge, setRemoteDeliveryCharge] = useState<number | null>(null);
  const [deliveryChargeLoading, setDeliveryChargeLoading] = useState(false);

  // ── Payment state ──────────────────────────────────────────────────────────
  const [paymentError,  setPaymentError]  = useState("");
  const [verifying,     setVerifying]     = useState(false);
  const [successOrder,  setSuccessOrder]  = useState<{ orderId: string; paymentId: string; amount: number; email: string; name: string } | null>(null);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
    if (user?.name)  setName(user.name);
  }, [user]);

  // Start loading the Razorpay script in the background as soon as this page
  // mounts, so it's very likely already ready by the time the customer
  // actually reaches payment — without loading it globally on every page.
  useEffect(() => { loadRazorpayScript().catch(() => {}); }, []);

  // Geocodes a manually-typed pincode into coordinates — but ONLY as a
  // fallback, when we don't already have a precise location from autocomplete
  // or GPS. Debounced so it doesn't fire on every keystroke. This effect's
  // only job is to resolve `preciseLocation`; the effect below is what
  // actually computes the delivery estimate from it, regardless of how it
  // was obtained.
  useEffect(() => {
    if (preciseLocation) return; // already have coordinates from a better source
    const pin = pincode.trim();
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setPincodeLookupLoading(true);
      try {
        const place = await geocodePincode(pin);
        if (cancelled) return;
        if (place.lat == null || place.lng == null) throw new Error("No coordinates for pincode");
        if (place.city)  setCustomerCity(place.city);
        if (place.state) setCustomerState(place.state);
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
  }, [pincode, preciseLocation]);

  // Resolves the delivery estimate directly from preciseLocation — the actual
  // required input for distance calculation — whenever it's set, regardless
  // of source (autocomplete selection, GPS, or the pincode geocode above).
  // Autocomplete selections for broad localities (e.g. picking "Janakpuri,
  // New Delhi" with no house number) often carry coordinates but no postal
  // code component, so this must not depend on pincode ever being populated.
  // Previews the charge through the same backend ShippingService logic used
  // at real print-order creation time (printorders.service.ts), so this
  // estimate can never drift from what the customer is actually charged.
  // Includes city/state (resolved via reverse-geocode) for zone detection —
  // must match what createPrintOrder actually sends, below.
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
        const distanceKm     = haversineKm(SHOP.lat, SHOP.lng, preciseLocation.lat, preciseLocation.lng);
        const totalRawPages  = pdfs.reduce((sum, p) => sum + p.pageCount, 0);
        const billablePages  = calcBillablePages(pdfs.map((p) => p.pageCount), pdfs.map((p) => p.copies), printSide);
        const orderValue     = pdfs.length > 0
          ? calcPrice(totalRawPages, pdfs.map((p) => p.pageCount), pdfs.map((p) => p.copies), printSide, colorType, bindingType, S).total
          : 0;
        // Mirrors printorders.service.ts's estimatedWeightKg formula exactly.
        const estimatedWeightKg = Math.max(1, billablePages * 0.005 + 0.15);

        const result = await previewShippingCharge({
          distanceInKm: distanceKm,
          orderValue,
          weightInKg:   estimatedWeightKg,
          city:         customerCity,
          state:        customerState,
          pincode,
          isPrintOrder: true,
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

  // Preview the beyond-3km delivery charge via the same backend ShippingService
  // logic used at real print-order creation time (printorders.service.ts) —
  // includes city/state so the zone-based rate matches what the customer will
  // actually be charged.
  useEffect(() => {
    const distanceKm = delivery?.distanceKm ?? null;
    const threshold  = shippingSettings?.freeRadius ?? 3;
    if (!shippingSettings?.isShippingEnabled || distanceKm === null || distanceKm <= threshold) {
      setRemoteDeliveryCharge(null);
      // A prior invocation may have left this true (e.g. it was cancelled
      // mid-flight when `delivery` got cleared by a pincode change) — this
      // invocation has nothing in flight, so it must explicitly clear it too,
      // otherwise the Pay button/cost row can get stuck on "Calculating…"
      // forever if no later invocation ever completes successfully.
      setDeliveryChargeLoading(false);
      return;
    }

    let cancelled = false;
    setDeliveryChargeLoading(true);

    const totalRawPages = pdfs.reduce((s, p) => s + p.pageCount, 0);
    const billablePages = calcBillablePages(pdfs.map((p) => p.pageCount), pdfs.map((p) => p.copies), printSide);
    const orderValue    = pdfs.length > 0
      ? calcPrice(totalRawPages, pdfs.map((p) => p.pageCount), pdfs.map((p) => p.copies), printSide, colorType, bindingType, S).total
      : 0;
    // Mirrors printorders.service.ts's estimatedWeightKg formula exactly.
    const estimatedWeightKg = Math.max(1, billablePages * 0.005 + 0.15);

    previewShippingCharge({
      distanceInKm: distanceKm,
      orderValue,
      weightInKg: estimatedWeightKg,
      city: customerCity,
      state: customerState,
      pincode,
      isPrintOrder: true,
    })
      .then((result) => { if (!cancelled) setRemoteDeliveryCharge(result.charge); })
      .catch(() => { if (!cancelled) setRemoteDeliveryCharge(null); })
      .finally(() => { if (!cancelled) setDeliveryChargeLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery?.distanceKm, shippingSettings?.isShippingEnabled, shippingSettings?.freeRadius, pdfs]);

  const handleShareCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setCurrentLocationError("Geolocation is not supported by your browser.");
      return;
    }
    setLocatingCurrent(true);
    setCurrentLocationError("");
    try {
      const { coords } = await getBestPosition();
      const place = await reverseGeocode(coords.latitude, coords.longitude);
      const fullAddress = [place.line1, place.city, place.state, place.pincode].filter(Boolean).join(", ");
      setAddress(fullAddress || place.line1);
      setFieldErrors((p) => { const n = { ...p }; delete n.address; return n; });
      if (place.pincode) setPincode(place.pincode);
      setCustomerCity(place.city ?? "");
      setCustomerState(place.state ?? "");
      setPreciseLocation({ lat: coords.latitude, lng: coords.longitude });
      setCurrentLocationAccuracy(coords.accuracy ?? null);
      setPlaceSelectionKey((k) => k + 1);
      setUsingCurrentLocation(true);
      setShowPincodeFallback(false);
      setDelivery(getDeliveryFromCoords(coords.latitude, coords.longitude));
    } catch {
      setCurrentLocationError("Unable to access your location. Please allow location access or enter your address manually.");
    } finally {
      setLocatingCurrent(false);
    }
  };

  const handlePlaceSelected = (place: PlaceSelection) => {
    const fullAddress = [place.line1, place.city, place.state, place.pincode].filter(Boolean).join(", ");
    setAddress(fullAddress || place.line1);
    setFieldErrors((p) => { const n = { ...p }; delete n.address; return n; });
    if (place.pincode) setPincode(place.pincode);
    setCustomerCity(place.city ?? "");
    setCustomerState(place.state ?? "");
    if (place.lat != null && place.lng != null) {
      setPreciseLocation({ lat: place.lat, lng: place.lng });
      setPlaceSelectionKey((k) => k + 1);
    }
    setUsingCurrentLocation(false);
    setCurrentLocationAccuracy(null);
    setShowPincodeFallback(false);
  };

  // ── Delivery charge calculation (mirrors backend ShippingService logic) ──────
  const deliveryCharge = (() => {
    if (!shippingSettings || !shippingSettings.isShippingEnabled) return 0;
    const distance  = delivery?.distanceKm ?? null;
    const threshold = shippingSettings.freeRadius;
    if (distance !== null && distance <= threshold) {
      const printCostForThreshold = pdfs.length > 0
        ? calcPrice(
            pdfs.reduce((s, p) => s + p.pageCount, 0),
            pdfs.map((p) => p.pageCount),
            pdfs.map((p) => p.copies),
            printSide, colorType, bindingType, S,
          ).total
        : 0;
      if (printCostForThreshold >= shippingSettings.freeDeliveryThreshold) return 0;
      // Round distance UP to the next whole km before billing (2.9km & 3.0km bill as 3km; 3.2km bills as 4km)
      return Math.ceil(distance) * Number(shippingSettings.perKmCharge);
    }
    if (distance !== null) return remoteDeliveryCharge; // beyond threshold — null while the preview loads/fails
    return null; // no location entered yet
  })();

  // useMutation must be declared before any conditional return (Rules of Hooks)
  const initiateMut = useMutation({
    mutationFn: (fd: FormData) => createPrintOrder(fd),
    onSuccess: (response) => {
      const initiated = response.data as PrintOrderInitiated;
      openRazorpay(initiated);
    },
    onError: (err: any) => {
      setPaymentError(err?.response?.data?.message ?? "Failed to initiate payment. Please try again.");
    },
  });

  // Show spinner only on the very first load (no cached data yet).
  // On subsequent renders the cached value is used instantly.
  if (settingsLoading && !rawS) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-red-400" />
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalRawPages  = pdfs.reduce((s, p) => s + p.pageCount, 0);
  const filePageCounts = pdfs.map((p) => p.pageCount);
  const fileCopies     = pdfs.map((p) => p.copies);
  const pricing        = calcPrice(totalRawPages, filePageCounts, fileCopies, printSide, colorType, bindingType, S);
  const estimatedMins  = estimateMins(pricing.billablePages);

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFileAdd = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    setFileError("");
    const pdfsOnly = Array.from(incoming).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    if (pdfsOnly.length === 0) { setFileError("Please select PDF files only."); return; }

    const errors: string[] = [];
    const oversized = pdfsOnly.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    const sized = pdfsOnly.filter((f) => f.size <= MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      errors.push(
        `${oversized.map((f) => f.name).join(", ")} ${oversized.length > 1 ? "are" : "is"} over the 70 MB limit and ${oversized.length > 1 ? "were" : "was"} skipped.`,
      );
    }
    if (sized.length === 0) { setFileError(errors.join(" ")); return; }

    const remaining = S.maxPdfsPerOrder - pdfs.length;
    if (remaining <= 0) {
      errors.push(`You've reached the limit of ${S.maxPdfsPerOrder} PDFs per order. Remove a file to add another.`);
      setFileError(errors.join(" "));
      return;
    }
    const toAdd = sized.slice(0, remaining);
    if (sized.length > remaining) {
      errors.push(
        `You can't upload more than ${S.maxPdfsPerOrder} PDFs at once. The first ${toAdd.length} have been added — you can upload the remaining ones in the next order.`,
      );
    }
    if (errors.length > 0) setFileError(errors.join(" "));
    const entries: PdfFile[] = toAdd.map((f) => ({
      id: generateId(), file: f, pageCount: 0, detecting: true,
      detectionFailed: false, overriding: false, copies: 1,
      previewUrl: URL.createObjectURL(f),
    }));
    setPdfs((prev) => [...prev, ...entries]);
    entries.forEach((entry) => {
      autoDetectPageCount(entry.file).then((count) => {
        setPdfs((prev) => prev.map((p) =>
          p.id === entry.id
            ? { ...p, pageCount: count, detecting: false, detectionFailed: count === 0 }
            : p,
        ));
      });
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setDragOver(false);
    handleFileAdd(e.dataTransfer.files);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(true);
  };
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  };

  const removeFile = (idx: number) => {
    setPdfs((prev) => { const u = [...prev]; URL.revokeObjectURL(u[idx]?.previewUrl ?? ""); u.splice(idx, 1); return u; });
  };

  const updateCopies = (idx: number, val: number) =>
    setPdfs((prev) => prev.map((p, i) => i === idx ? { ...p, copies: Math.max(1, val) } : p));

  // ── Phase 1: submit form → get Razorpay order (initiateMut declared above early-return) ──

  // ── Phase 2: open Razorpay, handle result ──────────────────────────────────
  const openRazorpay = async (initiated: PrintOrderInitiated) => {
    setPaymentError("");

    if (!isRazorpayConfigured) {
      setPaymentError("Payment gateway is not configured. Please contact support.");
      return;
    }
    try {
      await loadRazorpayScript();
    } catch {
      setPaymentError("Couldn't load the payment gateway. Please check your connection and try again.");
      return;
    }
    if (!window.Razorpay) {
      setPaymentError("Payment gateway is not configured. Please contact support.");
      return;
    }

    const rzp = new window.Razorpay({
      key:         razorpayKeyId,
      amount:      Math.round(initiated.amount * 100),
      currency:    "INR",
      name:        "Akash Book Centre",
      description: "Print Order Payment",
      order_id:    initiated.razorpayOrderId,
      prefill: {
        name:    initiated.customerName,
        email:   initiated.customerEmail,
        contact: phone,
      },
      theme: { color: "#1d1a17" },
      handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        // Phase 2: verify signature on the backend
        setVerifying(true);
        setPaymentError("");
        try {
          await verifyPrintPayment(
            initiated.printOrderId,
            r.razorpay_order_id,
            r.razorpay_payment_id,
            r.razorpay_signature,
          );
          setSuccessOrder({
            orderId:   initiated.printOrderId,
            paymentId: r.razorpay_payment_id,
            amount:    initiated.amount,
            email:     initiated.customerEmail,
            name:      initiated.customerName,
          });
        } catch (err: any) {
          setPaymentError(err?.response?.data?.message ?? "Payment verification failed. Please contact support with your payment ID.");
        } finally {
          setVerifying(false);
        }
      },
      modal: {
        ondismiss: () => {
          setPaymentError("Payment was cancelled. You can try again — your files are saved.");
        },
      },
    });
    rzp.open();
  };

  // ── Form validation + submit ───────────────────────────────────────────────
  const validateAndSubmit = () => {
    setPaymentError("");
    const errs: Record<string, string> = {};
    if (pdfs.length === 0)                                                    { setFileError("Please upload at least one PDF."); return; }
    if (pdfs.some((p) => p.detecting))                                        { setFileError("Please wait for all files to finish loading."); return; }
    if (pdfs.some((p) => p.pageCount === 0))                                  { setFileError("Enter the page count manually for all highlighted files."); return; }
    if (pincodeLookupLoading || deliveryChargeLoading)                        { setFileError("Please wait — calculating your delivery charge."); return; }
    if (!name.trim())                                                          errs.name    = "Full name is required";
    if (!email.trim())                                                         errs.email   = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))                       errs.email   = "Enter a valid email address";
    if (!phone.trim())                                                         errs.phone   = "Phone number is required";
    else if (!/^\d{10}$/.test(phone.trim()))                                   errs.phone   = "Enter a valid 10-digit phone number";
    if (!address.trim())                                                       errs.address = "Address is required";
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});

    const fd = new FormData();
    pdfs.forEach((p) => fd.append("pdfs", p.file));
    fd.append("colorType",        colorType);
    fd.append("printSide",        printSide);
    fd.append("orientation",      orientation);
    fd.append("bindingType",      bindingType);
    fd.append("pageCount",        String(totalRawPages));
    fd.append("copies",           String(pricing.totalCopies));
    fd.append("totalPrice",       String(pricing.total));
    fd.append("estimatedMinutes", String(estimatedMins));
    fd.append("paymentMethod",    "ONLINE");
    fd.append("filePageCounts",   JSON.stringify(filePageCounts));
    fd.append("fileNames",        JSON.stringify(pdfs.map((p) => p.file.name)));
    fd.append("fileCopies",       JSON.stringify(fileCopies));
    fd.append("fileSizes",        JSON.stringify(pdfs.map((p) => `${(p.file.size / 1024 / 1024).toFixed(2)} MB`)));
    fd.append("customerName",     name.trim());
    fd.append("customerEmail",    email.trim());
    fd.append("customerPhone",    phone.trim());
    fd.append("customerAddress",  [address.trim(), completeAddress.trim()].filter(Boolean).join(", "));
    if (customerCity.trim())  fd.append("customerCity",  customerCity.trim());
    if (customerState.trim()) fd.append("customerState", customerState.trim());
    if (pincode.trim())       fd.append("customerPincode", pincode.trim());
    if (delivery?.distanceKm != null) fd.append("deliveryDistance", String(delivery.distanceKm));
    if (preciseLocation) {
      fd.append("customerLatitude",  String(preciseLocation.lat));
      fd.append("customerLongitude", String(preciseLocation.lng));
    }
    initiateMut.mutate(fd);
  };

  const resetForm = () => {
    setPdfs([]); setPhone(""); setAddress(""); setCompleteAddress(""); setPincode(""); setDelivery(null);
    setCustomerCity(""); setCustomerState("");
    setFieldErrors({}); setFileError(""); setPaymentError("");
    setPreciseLocation(null); setUsingCurrentLocation(false); setCurrentLocationError("");
    setCurrentLocationAccuracy(null); setShowPincodeFallback(false);
  };

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!isAuth) return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed border-black/10 bg-white px-6 py-16 text-center">
      <FileText size={36} className="mx-auto text-text-muted" />
      <h2 className="mt-4 font-serif text-2xl text-text-primary">Login Required</h2>
      <p className="mt-2 text-sm text-text-muted">Please login to use the print service.</p>
      <button onClick={() => navigate("/login")} className="mt-5 rounded-full bg-[#1d1a17] px-6 py-2.5 text-sm text-white hover:bg-black">Login</button>
    </div>
  );

  // ── Verifying screen ───────────────────────────────────────────────────────
  if (verifying) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 size={40} className="mx-auto animate-spin text-[#1d1a17]" />
        <p className="font-serif text-xl text-text-primary">Verifying payment…</p>
        <p className="text-sm text-text-muted">Please wait, do not close this page.</p>
      </div>
    </div>
  );

  // ── Success screen ─────────────────────────────────────────────────────────
  if (successOrder) return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle size={30} className="text-emerald-600" />
        </div>
        <h2 className="mt-5 font-serif text-2xl text-text-primary">Order Placed!</h2>
        <p className="mt-2 text-sm text-text-muted">Payment successful. Your print order is confirmed and will be processed shortly.</p>

        <div className="mt-5 rounded-xl border border-emerald-200 bg-white px-4 py-4 text-left space-y-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">Order Details</span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Order ID</span>
              <span className="font-mono text-xs text-text-primary">{successOrder.orderId.slice(0, 16).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Payment ID</span>
              <span className="font-mono text-xs text-text-primary">{successOrder.paymentId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Amount Paid</span>
              <span className="font-semibold text-emerald-700">{fmt(successOrder.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Customer</span>
              <span className="text-text-primary">{successOrder.name}</span>
            </div>
          </div>
          <div className="border-t border-emerald-100 pt-2.5 flex items-start gap-2">
            <Check size={13} className="mt-0.5 text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-700">
              Invoice sent to <strong>{successOrder.email}</strong>
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <button onClick={resetForm} className="rounded-full border border-black/10 px-5 py-2.5 text-sm text-text-primary hover:bg-[#f4efe7] transition-all">
            New Order
          </button>
          <button onClick={() => navigate("/")} className="rounded-full bg-[#1d1a17] px-5 py-2.5 text-sm text-white hover:bg-black transition-all">
            Back to Store
          </button>
        </div>
      </div>
    </div>
  );

  // ── Main Form ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <div>
        <h1 className="font-serif text-3xl text-text-primary">Print Your Documents</h1>
        <p className="mt-1 text-sm text-text-muted">Upload PDFs, set copies per file, choose options and pay securely online.</p>
      </div>

      {/* ── Pricing Table ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/8 bg-white p-5 space-y-4">
        <h2 className="font-serif text-lg text-text-primary">Printing Rates</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-black/8 bg-[#f8f4ee] p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Black &amp; White</p>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-black/5">
                <tr><td className="py-1.5 text-text-muted">Single side</td><td className="py-1.5 text-right font-semibold text-text-primary">₹{S.bwSingleSide}/page</td></tr>
                <tr><td className="py-1.5 text-text-muted">Double side (under 20 pages)</td><td className="py-1.5 text-right font-semibold text-text-primary">₹{S.bwBothSideUnder20}/page</td></tr>
                <tr><td className="py-1.5 text-text-muted">Double side (20+ pages)</td><td className="py-1.5 text-right font-semibold text-text-primary">₹{S.bwBothSideAbove20}/page</td></tr>
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-black/8 bg-[#f8f4ee] p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Color</p>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-black/5">
                <tr><td className="py-1.5 text-text-muted">Single side (up to 99 pages)</td><td className="py-1.5 text-right font-semibold text-text-primary">₹{S.colorSingleSide}/page</td></tr>
                <tr><td className="py-1.5 text-text-muted">Double side (under 20 pages)</td><td className="py-1.5 text-right font-semibold text-text-primary">₹{S.colorBothSideUnder20}/page</td></tr>
                <tr><td className="py-1.5 text-text-muted">Double side (20–99 pages)</td><td className="py-1.5 text-right font-semibold text-text-primary">₹{S.colorBothSideAbove20}/page</td></tr>
                <tr><td className="py-1.5 text-text-muted">Any side (100+ pages)</td><td className="py-1.5 text-right font-semibold text-amber-700">₹{S.colorAbove99}/page</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex gap-4 text-xs text-text-muted">
          <span>Spiral binding: <strong>₹{S.spiralExtra}</strong> flat</span>
          <span>·</span>
          <span>Staple binding: <strong>₹{S.staplerExtra}</strong> flat</span>
        </div>
      </section>

      {/* ── 1. Upload PDFs ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/8 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-text-primary">1. Upload PDF Files</h2>
          <span className="text-xs text-text-muted">{pdfs.length} / {S.maxPdfsPerOrder} files</span>
        </div>

        {fileError && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />{fileError}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => { handleFileAdd(e.target.files); e.target.value = ""; }}
        />

        {pdfs.length < S.maxPdfsPerOrder && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            className={`flex h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${dragOver ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/15 bg-[#f8f4ee] hover:border-black/30"}`}>
            <Upload size={28} className="text-text-muted" />
            <p className="mt-2 text-sm font-medium text-text-muted">{dragOver ? "Drop PDF files here" : "Click or drag PDF files here"}</p>
            <p className="mt-0.5 text-xs text-text-muted/70">Up to {S.maxPdfsPerOrder} files · max 70 MB each</p>
          </div>
        )}

        {pdfs.length > 0 && (
          <div className="space-y-2">
            {pdfs.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-black/8 bg-[#faf8f5] px-4 py-3">
                <FileText size={18} className="shrink-0 text-red-400" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{p.file.name}</p>
                  <p className="text-xs text-text-muted">
                    {(p.file.size / 1024 / 1024).toFixed(1)} MB
                    {p.detecting ? (
                      <span className="ml-1.5 italic opacity-60">· detecting pages…</span>
                    ) : p.detectionFailed ? (
                      <span className="ml-1.5 text-amber-600">· page count unclear</span>
                    ) : (
                      <span className="ml-1.5 inline-flex items-center gap-1">
                        · {p.pageCount} pages
                        {!p.overriding && (
                          <button
                            type="button"
                            title="Edit page count"
                            onClick={() => setPdfs((prev) => prev.map((x) =>
                              x.id === p.id ? { ...x, overriding: true } : x,
                            ))}
                            className="text-text-muted/50 transition-colors hover:text-text-primary"
                          >
                            <Pencil size={10} />
                          </button>
                        )}
                      </span>
                    )}
                  </p>
                  {!p.detecting && (p.detectionFailed || p.overriding) && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs text-text-muted">
                        {p.detectionFailed ? "Enter pages manually:" : "Page count:"}
                      </span>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 25"
                        value={p.pageCount > 0 ? p.pageCount : ""}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                          setPdfs((prev) => prev.map((x) =>
                            x.id === p.id ? { ...x, pageCount: val, detectionFailed: val === 0 } : x,
                          ));
                        }}
                        className={`h-7 w-20 rounded-lg border px-2 text-xs text-text-primary outline-none ${
                          p.detectionFailed
                            ? "border-amber-300 bg-amber-50 focus:border-amber-500"
                            : "border-black/15 bg-white focus:border-black/40"
                        }`}
                      />
                      {p.overriding && !p.detectionFailed && (
                        <button
                          type="button"
                          onClick={() => setPdfs((prev) => prev.map((x) =>
                            x.id === p.id ? { ...x, overriding: false } : x,
                          ))}
                          className="text-xs text-text-muted underline underline-offset-2 hover:text-text-primary"
                        >
                          Done
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="hidden text-xs text-text-muted sm:inline mr-1">Copies</span>
                  <button type="button" onClick={() => updateCopies(idx, p.copies - 1)} disabled={p.copies <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-black/12 text-text-muted transition-colors hover:bg-[#f4efe7] disabled:opacity-30"><Minus size={11} /></button>
                  <span className="w-6 text-center text-sm font-semibold text-text-primary">{p.copies}</span>
                  <button type="button" onClick={() => updateCopies(idx, p.copies + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-black/12 text-text-muted transition-colors hover:bg-[#f4efe7]"><Plus size={11} /></button>
                </div>
                <a href={p.previewUrl} target="_blank" rel="noreferrer" title="Preview PDF"
                  className="flex shrink-0 items-center gap-1 rounded-full border border-black/10 px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:border-black/20 hover:bg-[#f4efe7] hover:text-text-primary">
                  <Eye size={12} /><span className="hidden sm:inline">View</span>
                </a>
                <button type="button" onClick={() => removeFile(idx)} className="shrink-0 rounded-full p-1.5 text-red-400 transition-colors hover:bg-red-50"><Trash2 size={13} /></button>
              </div>
            ))}
            {pdfs.length < S.maxPdfsPerOrder && (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-4 py-2 text-xs text-text-muted transition-colors hover:text-text-primary">
                <Plus size={12} /> Add more files
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── 2. Print Options ───────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/8 bg-white p-6 space-y-5">
        <h2 className="font-serif text-lg text-text-primary">2. Print Options</h2>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Print Type</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["bw",    "⬛", "Black & White", `₹${S.bwSingleSide}/page`],
              ["color", "🎨", "Color",         `₹${S.colorSingleSide}/page`],
            ] as const).map(([v, icon, label, desc]) => (
              <button key={v} type="button" onClick={() => setColorType(v as ColorType)}
                className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${colorType === v ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
                <span className="text-2xl">{icon}</span>
                <div><p className="text-sm font-medium text-text-primary">{label}</p><p className="text-xs text-text-muted">{desc}</p></div>
                {colorType === v && <Check size={14} className="ml-auto text-[#1d1a17]" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Print Side</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setPrintSide("single")}
              className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${printSide === "single" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
              <span className="text-2xl">📄</span>
              <div><p className="text-sm font-medium text-text-primary">Single Side</p><p className="text-xs text-text-muted">₹{getPricePerPage(totalRawPages, "single", colorType, S)}/page</p></div>
              {printSide === "single" && <Check size={14} className="ml-auto text-[#1d1a17]" />}
            </button>
            <button type="button" onClick={() => setPrintSide("both")}
              className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${printSide === "both" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
              <span className="text-2xl">📋</span>
              <div><p className="text-sm font-medium text-text-primary">Both Sides</p><p className="text-xs text-text-muted">₹{getPricePerPage(totalRawPages, "both", colorType, S)}/page · saves paper</p></div>
              {printSide === "both" && <Check size={14} className="ml-auto text-[#1d1a17]" />}
            </button>
          </div>
          {colorType === "color" && totalRawPages > 99 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
              Above-99 rate applied: ₹{S.colorAbove99}/page for {totalRawPages} pages
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Orientation</p>
          <div className="grid grid-cols-2 gap-3">
            {([["portrait","📱","Portrait","Vertical (standard)"],["landscape","🖥️","Landscape","Horizontal layout"]] as const).map(([v,icon,label,desc]) => (
              <button key={v} type="button" onClick={() => setOrientation(v as Orientation)}
                className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${orientation === v ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
                <span className="text-2xl">{icon}</span>
                <div><p className="text-sm font-medium text-text-primary">{label}</p><p className="text-xs text-text-muted">{desc}</p></div>
                {orientation === v && <Check size={14} className="ml-auto text-[#1d1a17]" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Binding</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setBindingType("stapler")}
              className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${bindingType === "stapler" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
              <span className="text-2xl">📎</span>
              <div><p className="text-sm font-medium text-text-primary">Staple Binding</p><p className="text-xs text-text-muted">+{fmt(S.staplerExtra)} per copy</p></div>
              {bindingType === "stapler" && <Check size={14} className="ml-auto text-[#1d1a17]" />}
            </button>
            <button type="button" onClick={() => setBindingType("spiral")}
              className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${bindingType === "spiral" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
              <span className="text-2xl">🌀</span>
              <div><p className="text-sm font-medium text-text-primary">Spiral Binding</p><p className="text-xs text-text-muted">+{fmt(S.spiralExtra)} per copy</p></div>
              {bindingType === "spiral" && <Check size={14} className="ml-auto text-[#1d1a17]" />}
            </button>
          </div>
        </div>
      </section>

      {/* ── 3. Order Summary ──────────────────────────────────────────────── */}
      {pdfs.length > 0 && (
        <section className="rounded-2xl border border-black/8 bg-white p-6 space-y-4">
          <h2 className="font-serif text-lg text-text-primary">3. Order Summary</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Copies",  value: String(pricing.totalCopies), sub: `across ${pdfs.length} file${pdfs.length > 1 ? "s" : ""}` },
              { label: "Price / Page",  value: fmt(pricing.ppp), sub: `${colorType === "color" ? "Color" : "B&W"} · ${printSide === "single" ? "Single" : "Double"} side` },
              { label: "Est. Time",     value: `~${estimatedMins} min`, sub: "60 pages ≈ 1 min", icon: <Clock size={12} className="inline mr-0.5" /> },
            ].map(({ label, value, sub, icon }) => (
              <div key={label} className="rounded-xl bg-[#f8f4ee] p-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-text-muted">{label}</p>
                <p className="mt-1 font-serif text-xl text-text-primary">{value}</p>
                <p className="mt-0.5 text-[10px] text-text-muted">{icon}{sub}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-black/8 p-3 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">Files ({pdfs.length})</p>
            {pdfs.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="truncate max-w-[55%] text-text-muted">• {p.file.name}</span>
                <span className="text-text-muted shrink-0">{p.detecting ? "…" : p.detectionFailed && p.pageCount === 0 ? <span className="text-amber-600">?</span> : p.pageCount} pages &nbsp;·&nbsp;<span className="font-medium text-text-primary">{p.copies} {p.copies === 1 ? "copy" : "copies"}</span></span>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-[#f8f4ee] p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Print cost ({pricing.billablePages} total pages × {fmt(pricing.ppp)})</span>
              <span className="font-medium text-text-primary">{fmt(pricing.printCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">{bindingType === "spiral" ? "Spiral" : "Staple"} binding ({pricing.totalCopies} {pricing.totalCopies === 1 ? "copy" : "copies"})</span>
              <span className="font-medium text-text-primary">+{fmt(pricing.bindingCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Delivery</span>
              <span className="font-medium text-text-primary">
                {deliveryCharge === 0
                  ? <span className="text-emerald-600 font-semibold">Free</span>
                  : deliveryCharge !== null
                  ? `+${fmt(deliveryCharge)}`
                  : (pincodeLookupLoading || deliveryChargeLoading)
                  ? <span className="text-text-muted italic">Calculating…</span>
                  : delivery?.distanceKm != null
                  ? <span className="text-amber-600 italic">Couldn't calculate — try again below</span>
                  : <span className="text-text-muted italic">Enter location below</span>}
              </span>
            </div>
            <div className="flex justify-between border-t border-black/10 pt-2.5">
              <span className="font-serif text-lg text-text-primary">Total</span>
              <span className="font-serif text-2xl text-[#8f2d22]">
                {fmt(pricing.total + (deliveryCharge ?? 0))}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Payment & Contact ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/8 bg-white p-6 space-y-4">
        <h2 className="font-serif text-lg text-text-primary">
          {pdfs.length > 0 ? "4. Payment & Contact" : "2. Payment & Contact"}
        </h2>

        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-800">Secure Online Payment Only</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Print orders are prepaid via Razorpay (UPI · Card · Net Banking). Your order is confirmed only after payment.
            </p>
          </div>
        </div>

        {/* Customer Details */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Full Name *</span>
            <input type="text" value={name}
              onChange={(e) => { setName(e.target.value); setFieldErrors((p) => { const n = {...p}; delete n.name; return n; }); }}
              placeholder="Your full name"
              className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors.name ? "border-red-300" : "border-black/10 focus:border-black/25"}`} />
            {fieldErrors.name && <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Phone Number *</span>
            <input type="tel" value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setFieldErrors((p) => { const n = {...p}; delete n.phone; return n; }); }}
              placeholder="10-digit mobile number"
              className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors.phone ? "border-red-300" : "border-black/10 focus:border-black/25"}`} />
            {fieldErrors.phone && <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Email * (invoice sent here)</span>
            <input type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => { const n = {...p}; delete n.email; return n; }); }}
              placeholder="your@email.com"
              className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors.email ? "border-red-300" : "border-black/10 focus:border-black/25"}`} />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Address *</span>
            <AddressAutocomplete
              value={address}
              onChange={(v) => {
                setAddress(v);
                setFieldErrors((p) => { const n = {...p}; delete n.address; return n; });
                if (usingCurrentLocation) { setUsingCurrentLocation(false); setPreciseLocation(null); setCurrentLocationAccuracy(null); }
              }}
              onPlaceSelected={handlePlaceSelected}
              placeholder="Your pickup / delivery address"
              className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors.address ? "border-red-300" : "border-black/10 focus:border-black/25"}`} />
            {fieldErrors.address && <p className="mt-1 text-xs text-red-500">{fieldErrors.address}</p>}
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
                  <span className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Pincode</span>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    placeholder="Enter 6-digit pincode"
                    className="h-11 w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 text-sm outline-none focus:border-black/25 focus:bg-white transition-all"
                  />
                </label>
              )}
            </div>
          )}

          {(preciseLocation || pincode.trim().length === 6) && (
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Complete Address (House/Flat No., Floor, Landmark) — optional</span>
              <input type="text" value={completeAddress} onChange={(e) => setCompleteAddress(e.target.value)}
                placeholder="e.g. House No. 5, 2nd Floor, Near Water Tank"
                className="h-11 w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 text-sm outline-none focus:border-black/25 focus:bg-white transition-all" />
              <p className="mt-1 text-[11px] text-text-muted">Helps the delivery rider find you faster.</p>
            </label>
          )}

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={handleShareCurrentLocation}
              disabled={locatingCurrent}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#f8f4ee] px-4 py-2 text-xs font-medium text-text-primary transition-all hover:border-black/20 hover:bg-white disabled:opacity-50"
            >
              <LocateFixed size={14} className={locatingCurrent ? "animate-spin" : ""} />
              {locatingCurrent ? "Getting your location…" : "Share your current location"}
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

          {preciseLocation && (
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Confirm exact location</span>
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
              deliveryCharge === 0
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}>
              <Truck size={15} className={deliveryCharge === 0 ? "text-emerald-600 shrink-0" : "text-amber-600 shrink-0"} />
              <div>
                <p className={`text-xs font-semibold ${deliveryCharge === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                  {deliveryCharge === 0 ? "Free Delivery" : delivery.label}
                </p>
                <p className="text-[11px] text-text-muted">
                  {delivery.sublabel}
                  {deliveryCharge !== null && deliveryCharge > 0 && ` · Delivery charge: ${fmt(deliveryCharge)}`}
                </p>
              </div>
            </div>
          )}
          {!delivery && !pincodeLookupLoading && (
            <p className="sm:col-span-2 text-xs text-text-muted">
              Free delivery within {shippingSettings?.freeRadius ?? 3} km on orders ₹{shippingSettings?.freeDeliveryThreshold ?? 199}+ — add your address above to check.
            </p>
          )}
        </div>

        {/* Payment error / cancellation notice */}
        {paymentError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <X size={14} className="mt-0.5 shrink-0" />
            <span>{paymentError}</span>
          </div>
        )}

        {/* Razorpay not configured warning */}
        {!isRazorpayConfigured && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>Payment gateway is not configured. Please contact the administrator.</span>
          </div>
        )}

        <button
          onClick={validateAndSubmit}
          disabled={pdfs.length === 0 || initiateMut.isPending || !isRazorpayConfigured || pincodeLookupLoading || deliveryChargeLoading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1d1a17] py-3.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50"
        >
          {initiateMut.isPending
            ? <><Loader2 size={15} className="animate-spin" /> Uploading & Preparing Payment…</>
            : (pincodeLookupLoading || deliveryChargeLoading)
              ? <><Loader2 size={15} className="animate-spin" /> Calculating delivery charge…</>
              : pdfs.length > 0
                ? <><CreditCard size={15} /> Pay {fmt(pricing.total + (deliveryCharge ?? 0))} — Secure Razorpay</>
                : "Upload PDFs to continue"}
        </button>

        <p className="text-center text-xs text-text-muted">
          Powered by Razorpay · 256-bit SSL encryption · Your payment goes directly to Akash Book Centre
        </p>
      </section>
    </div>
  );
}
