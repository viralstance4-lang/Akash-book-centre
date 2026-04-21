import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle, Check, Clock, CreditCard, Eye,
  FileText, Loader2, Minus, Plus, Trash2, Upload, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPrintSettings, createPrintOrder } from "../../api/print.api";
import { useAuthStore } from "../../store/auth.store";

// ─── Types ────────────────────────────────────────────────────────────────────
type ColorType   = "color" | "bw";
type PrintSide   = "single" | "both";
type Orientation = "portrait" | "landscape";
type BindingType = "spiral" | "stapler";

type PdfFile = {
  /** Stable ID for React keying and async updates */
  id:          string;
  file:        File;
  /** Auto-detected from PDF binary; used internally for pricing */
  pageCount:   number;
  detecting:   boolean;
  /** Copies for THIS file only */
  copies:      number;
  previewUrl:  string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2,
  }).format(v);

/**
 * Reads the first 512 KB of a PDF and counts /Type /Page dictionary entries —
 * a reliable heuristic for standard PDFs without heavy libraries.
 * Falls back to 10 pages for encrypted or heavily compressed PDFs.
 */
async function autoDetectPageCount(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buf = e.target?.result as ArrayBuffer;
      // Decode as Latin-1 so byte values survive intact for regex matching
      const content = new TextDecoder("latin1").decode(buf);
      const hits = content.match(/\/Type[\s\0]*\/Page[^s]/g);
      resolve(hits && hits.length > 0 ? hits.length : 10);
    };
    reader.onerror = () => resolve(10);
    // Page catalog lives near the start; 512 KB covers virtually all PDFs
    reader.readAsArrayBuffer(file.slice(0, 524_288));
  });
}

/**
 * Pricing with per-file copies.
 *
 * Print cost  = ppp × Σ(pageCount[i] × copies[i])
 * Binding cost = bindingRate × Σ(copies[i])   — one binding per physical copy
 * Bulk threshold is checked against total RAW pages (unweighted).
 */
function calcPrice(
  totalRawPages:     number,
  filePageCounts:    number[],
  fileCopies:        number[],
  side:              PrintSide,
  color:             ColorType,
  binding:           BindingType,
  s: {
    singleSideBasePrice: number; singleSideBulkPrice: number;
    doubleSidePrice: number;     bulkThreshold: number;
    colorSurcharge: number;      spiralExtra: number; staplerExtra: number;
  },
) {
  const isBulk          = totalRawPages > s.bulkThreshold;
  const basePPP         = side === "single"
    ? (isBulk ? s.singleSideBulkPrice : s.singleSideBasePrice)
    : s.doubleSidePrice;
  const ppp             = basePPP + (color === "color" ? s.colorSurcharge : 0);
  const weightedPages   = filePageCounts.reduce((sum, pc, i) => sum + pc * (fileCopies[i] ?? 1), 0);
  const totalCopies     = fileCopies.reduce((s, c) => s + c, 0);
  const printCost       = ppp * weightedPages;
  const bindingCost     = (binding === "spiral" ? s.spiralExtra : s.staplerExtra) * totalCopies;
  return {
    ppp,
    printCost,
    bindingCost,
    weightedPages,
    totalCopies,
    total: Math.max(0, Math.round((printCost + bindingCost) * 100) / 100),
  };
}

const estimateMins = (weightedPages: number) => Math.max(1, Math.ceil(weightedPages / 60));

// ─── Component ────────────────────────────────────────────────────────────────
export default function PrintBookPage() {
  const navigate     = useNavigate();
  const isAuth       = useAuthStore((s) => s.isAuthenticated);
  const user         = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settingsData } = useQuery({
    queryKey: ["print-settings"],
    queryFn:  getPrintSettings,
  });
  const rawS = settingsData?.data;
  const S = {
    singleSideBasePrice: rawS ? Number(rawS.singleSideBasePrice ?? (rawS as any).bwPrice ?? 1) : 1,
    singleSideBulkPrice: rawS ? Number(rawS.singleSideBulkPrice ?? 0.5) : 0.5,
    doubleSidePrice:     rawS ? Number(rawS.doubleSidePrice ?? 1) : 1,
    bulkThreshold:       rawS ? Number((rawS as any).bulkThreshold ?? 20) : 20,
    colorSurcharge:      rawS ? Number(rawS.colorSurcharge ?? (rawS as any).colorPrice ?? 3) : 3,
    spiralExtra:         rawS ? Number(rawS.spiralExtra ?? 30) : 30,
    staplerExtra:        rawS ? Number(rawS.staplerExtra ?? 10) : 10,
    maxPdfsPerOrder:     rawS ? Number((rawS as any).maxPdfsPerOrder ?? 20) : 20,
  };

  // ── Form state ─────────────────────────────────────────────────────────────
  const [pdfs,        setPdfs]        = useState<PdfFile[]>([]);
  const [colorType,   setColorType]   = useState<ColorType>("bw");
  const [printSide,   setPrintSide]   = useState<PrintSide>("both");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [bindingType, setBindingType] = useState<BindingType>("stapler");
  const [email,       setEmail]       = useState(user?.email ?? "");
  const [name,        setName]        = useState(user?.name ?? "");
  const [phone,       setPhone]       = useState("");
  const [address,     setAddress]     = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success,     setSuccess]     = useState(false);
  const [fileError,   setFileError]   = useState("");

  useEffect(() => {
    if (user?.email) setEmail(user.email);
    if (user?.name)  setName(user.name);
  }, [user]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalRawPages = pdfs.reduce((s, p) => s + p.pageCount, 0);
  const filePageCounts = pdfs.map((p) => p.pageCount);
  const fileCopies     = pdfs.map((p) => p.copies);
  const pricing = calcPrice(totalRawPages, filePageCounts, fileCopies, printSide, colorType, bindingType, S);
  const estimatedMins = estimateMins(pricing.weightedPages);

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFileAdd = (incoming: FileList | null) => {
    if (!incoming) return;
    setFileError("");
    const remaining = S.maxPdfsPerOrder - pdfs.length;
    const toAdd     = Array.from(incoming).slice(0, remaining);

    if (incoming.length > remaining) {
      setFileError(`Maximum ${S.maxPdfsPerOrder} PDFs allowed. Only the first ${remaining} were added.`);
    }

    const entries: PdfFile[] = toAdd.map((f) => ({
      id:         crypto.randomUUID(),
      file:       f,
      pageCount:  10,
      detecting:  true,
      copies:     1,
      previewUrl: URL.createObjectURL(f),
    }));

    setPdfs((prev) => [...prev, ...entries]);

    // Auto-detect page count for each file without blocking the UI
    entries.forEach((entry) => {
      autoDetectPageCount(entry.file).then((count) => {
        setPdfs((prev) =>
          prev.map((p) => p.id === entry.id ? { ...p, pageCount: count, detecting: false } : p),
        );
      });
    });
  };

  const removeFile = (idx: number) => {
    setPdfs((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[idx]?.previewUrl ?? "");
      updated.splice(idx, 1);
      return updated;
    });
  };

  const updateCopies = (idx: number, val: number) =>
    setPdfs((prev) => prev.map((p, i) => i === idx ? { ...p, copies: Math.max(1, val) } : p));

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submitMut = useMutation({
    mutationFn: (fd: FormData) => createPrintOrder(fd),
    onSuccess:  () => setSuccess(true),
  });

  const validateAndSubmit = () => {
    const errs: Record<string, string> = {};
    if (pdfs.length === 0) { setFileError("Please upload at least one PDF."); return; }
    if (!name.trim())  errs.name    = "Full name is required";
    if (!email.trim()) errs.email   = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address";
    if (!phone.trim()) errs.phone   = "Phone number is required";
    else if (!/^\d{10}$/.test(phone.trim())) errs.phone = "Enter a valid 10-digit phone number";
    if (!address.trim()) errs.address = "Address is required";
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
    fd.append("customerName",    name.trim());
    fd.append("customerEmail",   email.trim());
    fd.append("customerPhone",   phone.trim());
    fd.append("customerAddress", address.trim());
    submitMut.mutate(fd);
  };

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!isAuth) return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed border-black/10 bg-white px-6 py-16 text-center">
      <FileText size={36} className="mx-auto text-text-muted" />
      <h2 className="mt-4 font-serif text-2xl text-text-primary">Login Required</h2>
      <p className="mt-2 text-sm text-text-muted">Please login to use the print service.</p>
      <button onClick={() => navigate("/login")}
        className="mt-5 rounded-full bg-[#1d1a17] px-6 py-2.5 text-sm text-white hover:bg-black">
        Login
      </button>
    </div>
  );

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) return (
    <div className="mx-auto max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <Check size={28} className="text-emerald-600" />
      </div>
      <h2 className="mt-5 font-serif text-2xl text-text-primary">Print order placed successfully!</h2>
      <p className="mt-2 text-sm text-text-muted">
        Your order has been received. We'll process your documents shortly.
      </p>
      {name && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-left space-y-1">
          {name  && <p className="text-sm text-text-muted"><span className="font-medium text-text-primary">Name:</span> {name}</p>}
          {phone && <p className="text-sm text-text-muted"><span className="font-medium text-text-primary">Phone:</span> {phone}</p>}
          {email && <p className="text-sm text-text-muted"><span className="font-medium text-text-primary">Invoice sent to:</span> <strong>{email}</strong></p>}
        </div>
      )}
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={() => {
            setSuccess(false);
            setPdfs([]);
            setPhone("");
            setAddress("");
            setFieldErrors({});
            setFileError("");
          }}
          className="rounded-full border border-black/10 px-5 py-2.5 text-sm text-text-primary hover:bg-[#f4efe7]"
        >
          New Order
        </button>
        <button
          onClick={() => navigate("/")}
          className="rounded-full bg-[#1d1a17] px-5 py-2.5 text-sm text-white hover:bg-black"
        >
          Back to Store
        </button>
      </div>
    </div>
  );

  // ── Main Form ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      <div>
        <h1 className="font-serif text-3xl text-text-primary">Print Your Documents</h1>
        <p className="mt-1 text-sm text-text-muted">
          Upload PDFs, set copies per file, choose options and pay online.
        </p>
      </div>

      {/* ── 1. Upload PDFs ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/8 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-text-primary">1. Upload PDF Files</h2>
          <span className="text-xs text-text-muted">
            {pdfs.length} / {S.maxPdfsPerOrder} files
          </span>
        </div>

        {fileError && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />{fileError}
          </div>
        )}

        {/* Drop zone */}
        {pdfs.length < S.maxPdfsPerOrder && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-black/15 bg-[#f8f4ee] transition-colors hover:border-black/30"
          >
            <Upload size={28} className="text-text-muted" />
            <p className="mt-2 text-sm font-medium text-text-muted">Click to add PDFs</p>
            <p className="mt-0.5 text-xs text-text-muted/70">
              Up to {S.maxPdfsPerOrder} files · max 50 MB each
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file" accept=".pdf" multiple className="hidden"
          onChange={(e) => handleFileAdd(e.target.files)}
        />

        {/* File cards */}
        {pdfs.length > 0 && (
          <div className="space-y-2">
            {pdfs.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-black/8 bg-[#faf8f5] px-4 py-3"
              >
                {/* Icon */}
                <FileText size={18} className="shrink-0 text-red-400" />

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{p.file.name}</p>
                  <p className="text-xs text-text-muted">
                    {(p.file.size / 1024 / 1024).toFixed(1)} MB
                    {p.detecting
                      ? <span className="ml-1.5 italic opacity-60">· detecting pages…</span>
                      : <span className="ml-1.5">· {p.pageCount} pages detected</span>
                    }
                  </p>
                </div>

                {/* Per-file copies control */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="hidden text-xs text-text-muted sm:inline mr-1">Copies</span>
                  <button
                    type="button"
                    onClick={() => updateCopies(idx, p.copies - 1)}
                    disabled={p.copies <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-black/12 text-text-muted transition-colors hover:bg-[#f4efe7] disabled:opacity-30"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-text-primary">
                    {p.copies}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateCopies(idx, p.copies + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-black/12 text-text-muted transition-colors hover:bg-[#f4efe7]"
                  >
                    <Plus size={11} />
                  </button>
                </div>

                {/* View PDF */}
                <a
                  href={p.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Preview PDF"
                  className="flex shrink-0 items-center gap-1 rounded-full border border-black/10 px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:border-black/20 hover:bg-[#f4efe7] hover:text-text-primary"
                >
                  <Eye size={12} />
                  <span className="hidden sm:inline">View</span>
                </a>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="shrink-0 rounded-full p-1.5 text-red-400 transition-colors hover:bg-red-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {pdfs.length < S.maxPdfsPerOrder && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-4 py-2 text-xs text-text-muted transition-colors hover:text-text-primary"
              >
                <Plus size={12} /> Add more files
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── 2. Print Options ───────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/8 bg-white p-6 space-y-5">
        <h2 className="font-serif text-lg text-text-primary">2. Print Options</h2>

        {/* Print Type */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Print Type</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["bw",    "⬛", "Black & White", `₹${S.singleSideBasePrice}/page`],
              ["color", "🎨", "Color",          `+₹${S.colorSurcharge}/page extra`],
            ] as const).map(([v, icon, label, desc]) => (
              <button key={v} type="button" onClick={() => setColorType(v as ColorType)}
                className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${colorType === v ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="text-sm font-medium text-text-primary">{label}</p>
                  <p className="text-xs text-text-muted">{desc}</p>
                </div>
                {colorType === v && <Check size={14} className="ml-auto text-[#1d1a17]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Print Side */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Print Side</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setPrintSide("single")}
              className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${printSide === "single" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
              <span className="text-2xl">📄</span>
              <div>
                <p className="text-sm font-medium text-text-primary">Single Side</p>
                <p className="text-xs text-text-muted">
                  {totalRawPages > S.bulkThreshold
                    ? `₹${S.singleSideBulkPrice}/page (bulk)`
                    : `₹${S.singleSideBasePrice}/page`}
                </p>
              </div>
              {printSide === "single" && <Check size={14} className="ml-auto text-[#1d1a17]" />}
            </button>
            <button type="button" onClick={() => setPrintSide("both")}
              className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${printSide === "both" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
              <span className="text-2xl">📋</span>
              <div>
                <p className="text-sm font-medium text-text-primary">Both Sides</p>
                <p className="text-xs text-text-muted">₹{S.doubleSidePrice}/page · saves paper</p>
              </div>
              {printSide === "both" && <Check size={14} className="ml-auto text-[#1d1a17]" />}
            </button>
          </div>
          {totalRawPages > S.bulkThreshold && printSide === "single" && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
              Bulk discount applied: {totalRawPages} pages &gt; {S.bulkThreshold} threshold → ₹{S.singleSideBulkPrice}/page
            </p>
          )}
        </div>

        {/* Orientation */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Orientation</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["portrait",  "📱", "Portrait",  "Vertical (standard)"],
              ["landscape", "🖥️", "Landscape", "Horizontal layout"],
            ] as const).map(([v, icon, label, desc]) => (
              <button key={v} type="button" onClick={() => setOrientation(v as Orientation)}
                className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${orientation === v ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="text-sm font-medium text-text-primary">{label}</p>
                  <p className="text-xs text-text-muted">{desc}</p>
                </div>
                {orientation === v && <Check size={14} className="ml-auto text-[#1d1a17]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Binding */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Binding</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setBindingType("stapler")}
              className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${bindingType === "stapler" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
              <span className="text-2xl">📎</span>
              <div>
                <p className="text-sm font-medium text-text-primary">Staple Binding</p>
                <p className="text-xs text-text-muted">+{fmt(S.staplerExtra)} per copy</p>
              </div>
              {bindingType === "stapler" && <Check size={14} className="ml-auto text-[#1d1a17]" />}
            </button>
            <button type="button" onClick={() => setBindingType("spiral")}
              className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${bindingType === "spiral" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
              <span className="text-2xl">🌀</span>
              <div>
                <p className="text-sm font-medium text-text-primary">Spiral Binding</p>
                <p className="text-xs text-text-muted">+{fmt(S.spiralExtra)} per copy</p>
              </div>
              {bindingType === "spiral" && <Check size={14} className="ml-auto text-[#1d1a17]" />}
            </button>
          </div>
        </div>
      </section>

      {/* ── 3. Order Summary ──────────────────────────────────────────────── */}
      {pdfs.length > 0 && (
        <section className="rounded-2xl border border-black/8 bg-white p-6 space-y-4">
          <h2 className="font-serif text-lg text-text-primary">3. Order Summary</h2>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Total Copies",
                value: String(pricing.totalCopies),
                sub:   `across ${pdfs.length} file${pdfs.length > 1 ? "s" : ""}`,
              },
              {
                label: "Price / Page",
                value: fmt(pricing.ppp),
                sub:   `${colorType === "color" ? "Color" : "B&W"} · ${printSide === "single" ? "Single" : "Double"} side`,
              },
              {
                label: "Est. Print Time",
                value: `~${estimatedMins} min`,
                sub:   "60 pages ≈ 1 min",
                icon:  <Clock size={12} className="inline mr-0.5" />,
              },
            ].map(({ label, value, sub, icon }) => (
              <div key={label} className="rounded-xl bg-[#f8f4ee] p-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-text-muted">{label}</p>
                <p className="mt-1 font-serif text-xl text-text-primary">{value}</p>
                <p className="mt-0.5 text-[10px] text-text-muted">{icon}{sub}</p>
              </div>
            ))}
          </div>

          {/* Per-file breakdown */}
          <div className="rounded-xl border border-black/8 p-3 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">
              Files ({pdfs.length})
            </p>
            {pdfs.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="truncate max-w-[55%] text-text-muted">• {p.file.name}</span>
                <span className="text-text-muted shrink-0">
                  {p.detecting ? "…" : p.pageCount} pages &nbsp;·&nbsp;
                  <span className="font-medium text-text-primary">{p.copies} {p.copies === 1 ? "copy" : "copies"}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Price breakdown */}
          <div className="rounded-xl bg-[#f8f4ee] p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">
                Print cost ({pricing.weightedPages} total print pages × {fmt(pricing.ppp)})
              </span>
              <span className="font-medium text-text-primary">{fmt(pricing.printCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">
                {bindingType === "spiral" ? "Spiral" : "Staple"} binding ({pricing.totalCopies} {pricing.totalCopies === 1 ? "copy" : "copies"})
              </span>
              <span className="font-medium text-text-primary">+{fmt(pricing.bindingCost)}</span>
            </div>
            <div className="flex justify-between border-t border-black/10 pt-2.5">
              <span className="font-serif text-lg text-text-primary">Total</span>
              <span className="font-serif text-2xl text-[#8f2d22]">{fmt(pricing.total)}</span>
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Payment & Submit ────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/8 bg-white p-6 space-y-4">
        <h2 className="font-serif text-lg text-text-primary">
          {pdfs.length > 0 ? "4. Payment & Contact" : "2. Payment & Contact"}
        </h2>

        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <CreditCard size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">Only prepaid orders are allowed for print services</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Cash on Delivery is not available. You will be charged online via UPI / Card / Net Banking.
            </p>
          </div>
        </div>

        {/* Customer Details */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Name */}
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Full Name *</span>
            <input
              type="text" value={name} onChange={(e) => { setName(e.target.value); setFieldErrors((p) => { const n = {...p}; delete n.name; return n; }); }}
              placeholder="Your full name"
              className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors.name ? "border-red-300" : "border-black/10 focus:border-black/25"}`}
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>}
          </label>

          {/* Phone */}
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Phone Number *</span>
            <input
              type="tel" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setFieldErrors((p) => { const n = {...p}; delete n.phone; return n; }); }}
              placeholder="10-digit mobile number"
              className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors.phone ? "border-red-300" : "border-black/10 focus:border-black/25"}`}
            />
            {fieldErrors.phone && <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>}
          </label>

          {/* Email */}
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Email * (invoice sent here)</span>
            <input
              type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => { const n = {...p}; delete n.email; return n; }); }}
              placeholder="your@email.com"
              className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors.email ? "border-red-300" : "border-black/10 focus:border-black/25"}`}
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
          </label>

          {/* Address */}
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Address *</span>
            <input
              type="text" value={address} onChange={(e) => { setAddress(e.target.value); setFieldErrors((p) => { const n = {...p}; delete n.address; return n; }); }}
              placeholder="Your pickup / delivery address"
              className={`h-11 w-full rounded-xl border bg-[#f8f4ee] px-4 text-sm outline-none focus:bg-white transition-all ${fieldErrors.address ? "border-red-300" : "border-black/10 focus:border-black/25"}`}
            />
            {fieldErrors.address && <p className="mt-1 text-xs text-red-500">{fieldErrors.address}</p>}
          </label>
        </div>

        {submitMut.isError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <X size={14} className="mt-0.5 shrink-0" />
            {(submitMut.error as any)?.response?.data?.message ?? "Failed to place order. Please try again."}
          </div>
        )}

        <button
          onClick={validateAndSubmit}
          disabled={pdfs.length === 0 || submitMut.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1d1a17] py-3.5 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50"
        >
          {submitMut.isPending
            ? <><Loader2 size={15} className="animate-spin" /> Placing Order…</>
            : pdfs.length > 0
              ? `Place Print Order — ${fmt(pricing.total)}`
              : "Upload PDFs to continue"}
        </button>
      </section>
    </div>
  );
}
