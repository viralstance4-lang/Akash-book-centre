import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, CreditCard, FileText, Loader2, Truck, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPrintSettings, createPrintOrder } from "../../api/print.api";
import { useAuthStore } from "../../store/auth.store";

type Step = "upload" | "color" | "side" | "orientation" | "binding" | "summary";
const steps: Step[] = ["upload", "color", "side", "orientation", "binding", "summary"];
const fmt = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v);

export default function PrintBookPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [pdf, setPdf] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(10);
  const [colorType, setColorType] = useState<"color" | "bw">("bw");
  const [printSide, setPrintSide] = useState<"single" | "both">("both");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [bindingType, setBindingType] = useState<"spiral" | "stapler">("stapler");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "ONLINE">("COD");
  const [email, setEmail] = useState(user?.email ?? "");
  const [success, setSuccess] = useState(false);

  const { data: settingsData } = useQuery({ queryKey: ["print-settings"], queryFn: getPrintSettings });
  const s = settingsData?.data;

  const colorPagePrice = s ? Number(s.colorPrice) : 5;
  const bwPagePrice = s ? Number(s.bwPrice) : 2;
  const singleSideExtra = s ? Number(s.singleSideExtra) : 1;
  const bothSideDiscount = s ? Number(s.bothSideDiscount) : 0;
  const spiralExtra = s ? Number(s.spiralExtra) : 30;
  const staplerExtra = s ? Number(s.staplerExtra) : 10;

  const basePrice = colorType === "color" ? colorPagePrice : bwPagePrice;
  const sideCharge = printSide === "single" ? singleSideExtra : -bothSideDiscount;
  const printCost = (basePrice + sideCharge) * pageCount;
  const bindingCost = bindingType === "spiral" ? spiralExtra : staplerExtra;
  const totalPrice = Math.max(0, Math.round((printCost + bindingCost) * 100) / 100);

  const createMutation = useMutation({
    mutationFn: (fd: FormData) => createPrintOrder(fd),
    onSuccess: () => setSuccess(true),
  });

  if (!isAuthenticated) return (
    <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-16 text-center max-w-md mx-auto">
      <FileText size={36} className="mx-auto text-text-muted" />
      <h2 className="mt-4 font-serif text-2xl text-text-primary">Login Required</h2>
      <p className="mt-2 text-sm text-text-muted">Please login to use the print service.</p>
      <button onClick={() => navigate("/login")} className="mt-5 rounded-full bg-[#1d1a17] px-6 py-2.5 text-sm text-white hover:bg-black">Login</button>
    </div>
  );

  if (success) return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-16 text-center max-w-md mx-auto">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <Check size={28} className="text-emerald-600" />
      </div>
      <h2 className="mt-5 font-serif text-2xl text-text-primary">Print Order Placed! 🎉</h2>
      <p className="mt-2 text-sm text-text-muted">
        {paymentMethod === "COD" ? "Pay when your order arrives." : "Payment received."} We'll process your print shortly.
      </p>
      {email && <p className="mt-1 text-xs text-text-muted">Invoice sent to: {email}</p>}
      <div className="mt-6 flex gap-3 justify-center">
        <button onClick={() => { setSuccess(false); setStep("upload"); setPdf(null); }}
          className="rounded-full border border-black/10 px-5 py-2.5 text-sm text-text-primary hover:bg-[#f4efe7]">New Order</button>
        <button onClick={() => navigate("/")} className="rounded-full bg-[#1d1a17] px-5 py-2.5 text-sm text-white hover:bg-black">Back to Store</button>
      </div>
    </div>
  );

  const stepIndex = steps.indexOf(step);
  const progress = (stepIndex / (steps.length - 1)) * 100;

  const handleSubmit = () => {
    if (!pdf) return;
    const fd = new FormData();
    fd.append("pdf", pdf);
    fd.append("colorType", colorType);
    fd.append("printSide", printSide);
    fd.append("orientation", orientation);
    fd.append("bindingType", bindingType);
    fd.append("pageCount", String(pageCount));
    fd.append("totalPrice", String(totalPrice));
    fd.append("paymentMethod", paymentMethod);
    fd.append("customerEmail", email);
    createMutation.mutate(fd);
  };

  const Opt = ({ val, cur, onClick, emoji, label, desc }: any) => (
    <button type="button" onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all ${cur === val ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
      <span className="text-3xl">{emoji}</span>
      <p className="font-medium text-text-primary text-sm">{label}</p>
      <p className="text-xs text-text-muted">{desc}</p>
      {cur === val && <Check size={14} className="text-[#1d1a17]" />}
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      <div>
        <h1 className="font-serif text-3xl text-text-primary">Print Your Custom Book</h1>
        <p className="mt-1 text-sm text-text-muted">Upload your PDF and get it printed and delivered</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-text-muted">
          <span>Step {stepIndex + 1} of {steps.length}</span>
          <span className="capitalize font-medium">{step}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-[#e6ddd0]">
          <div className="h-2 rounded-full bg-[#1d1a17] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-black/8 bg-white p-6 sm:p-8">
        {step === "upload" && (
          <div className="space-y-5">
            <h2 className="font-serif text-xl text-text-primary">Upload your PDF</h2>
            <div onClick={() => fileRef.current?.click()}
              className="flex h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-black/15 bg-[#f8f4ee] hover:border-black/30 transition-colors">
              {pdf ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText size={36} className="text-emerald-600" />
                  <p className="font-medium text-sm text-text-primary">{pdf.name}</p>
                  <p className="text-xs text-text-muted">{(pdf.size / 1024 / 1024).toFixed(2)} MB · Click to change</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-text-muted">
                  <Upload size={32} />
                  <p className="text-sm font-medium">Click to upload PDF</p>
                  <p className="text-xs opacity-60">PDF only, max 50MB</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPdf(f); }} />
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Number of Pages</label>
              <input type="number" min={1} value={pageCount} onChange={(e) => setPageCount(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:bg-white" />
            </div>
            <button onClick={() => { if (pdf) setStep("color"); }} disabled={!pdf}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1d1a17] py-3 text-sm text-white hover:bg-black disabled:opacity-50">
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {step === "color" && (
          <div className="space-y-5">
            <h2 className="font-serif text-xl text-text-primary">Print Type</h2>
            <div className="grid grid-cols-2 gap-4">
              <Opt val="color" cur={colorType} onClick={() => setColorType("color")} emoji="🎨" label="Color" desc={`${fmt(colorPagePrice)}/page`} />
              <Opt val="bw" cur={colorType} onClick={() => setColorType("bw")} emoji="⬛" label="Black & White" desc={`${fmt(bwPagePrice)}/page`} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("upload")} className="flex-1 rounded-full border border-black/10 py-3 text-sm text-text-muted hover:text-text-primary">Back</button>
              <button onClick={() => setStep("side")} className="flex-1 rounded-full bg-[#1d1a17] py-3 text-sm text-white hover:bg-black">Continue</button>
            </div>
          </div>
        )}

        {step === "side" && (
          <div className="space-y-5">
            <h2 className="font-serif text-xl text-text-primary">Print Side</h2>
            <div className="grid grid-cols-2 gap-4">
              <Opt val="single" cur={printSide} onClick={() => setPrintSide("single")} emoji="📄" label="Single Side" desc={singleSideExtra > 0 ? `+${fmt(singleSideExtra)}/page` : "Standard"} />
              <Opt val="both" cur={printSide} onClick={() => setPrintSide("both")} emoji="📋" label="Both Sides" desc={bothSideDiscount > 0 ? `-${fmt(bothSideDiscount)}/page` : "Saves paper"} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("color")} className="flex-1 rounded-full border border-black/10 py-3 text-sm text-text-muted hover:text-text-primary">Back</button>
              <button onClick={() => setStep("orientation")} className="flex-1 rounded-full bg-[#1d1a17] py-3 text-sm text-white hover:bg-black">Continue</button>
            </div>
          </div>
        )}

        {step === "orientation" && (
          <div className="space-y-5">
            <h2 className="font-serif text-xl text-text-primary">Page Orientation</h2>
            <div className="grid grid-cols-2 gap-4">
              <Opt val="portrait" cur={orientation} onClick={() => setOrientation("portrait")} emoji="📱" label="Portrait" desc="Vertical (standard)" />
              <Opt val="landscape" cur={orientation} onClick={() => setOrientation("landscape")} emoji="🖥️" label="Landscape" desc="Horizontal layout" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("side")} className="flex-1 rounded-full border border-black/10 py-3 text-sm text-text-muted hover:text-text-primary">Back</button>
              <button onClick={() => setStep("binding")} className="flex-1 rounded-full bg-[#1d1a17] py-3 text-sm text-white hover:bg-black">Continue</button>
            </div>
          </div>
        )}

        {step === "binding" && (
          <div className="space-y-5">
            <h2 className="font-serif text-xl text-text-primary">Binding Type</h2>
            <div className="grid grid-cols-2 gap-4">
              <Opt val="spiral" cur={bindingType} onClick={() => setBindingType("spiral")} emoji="🌀" label="Spiral Binding" desc={`+${fmt(spiralExtra)}`} />
              <Opt val="stapler" cur={bindingType} onClick={() => setBindingType("stapler")} emoji="📎" label="Staple Binding" desc={`+${fmt(staplerExtra)}`} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("orientation")} className="flex-1 rounded-full border border-black/10 py-3 text-sm text-text-muted hover:text-text-primary">Back</button>
              <button onClick={() => setStep("summary")} className="flex-1 rounded-full bg-[#1d1a17] py-3 text-sm text-white hover:bg-black">Review Order</button>
            </div>
          </div>
        )}

        {step === "summary" && (
          <div className="space-y-5">
            <h2 className="font-serif text-xl text-text-primary">Order Summary & Payment</h2>

            {/* Price Breakdown */}
            <div className="rounded-2xl bg-[#f8f4ee] p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Price Breakdown</p>
              {[
                { label: `${colorType === "color" ? "Color" : "B&W"} print (${pageCount} pages × ${fmt(basePrice)})`, val: fmt(basePrice * pageCount) },
                ...(sideCharge !== 0 ? [{ label: printSide === "single" ? "Single side charge" : "Both sides discount", val: `${sideCharge >= 0 ? "+" : ""}${fmt(sideCharge * pageCount)}` }] : []),
                { label: `${bindingType === "spiral" ? "Spiral" : "Stapler"} binding`, val: `+${fmt(bindingCost)}` },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-medium text-text-primary">{val}</span>
                </div>
              ))}
              <div className="border-t border-black/10 pt-2.5 flex justify-between">
                <span className="font-serif text-lg text-text-primary">Total</span>
                <span className="font-serif text-2xl text-[#8f2d22]">{fmt(totalPrice)}</span>
              </div>
            </div>

            {/* Selections */}
            <div className="rounded-2xl border border-black/8 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">Your Selections</p>
              {[
                ["File", pdf?.name ?? ""], ["Pages", String(pageCount)],
                ["Type", colorType === "color" ? "Color" : "B&W"],
                ["Side", printSide === "single" ? "Single" : "Both sides"],
                ["Orientation", orientation === "portrait" ? "Portrait" : "Landscape"],
                ["Binding", bindingType === "spiral" ? "Spiral" : "Stapler"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-text-muted">{k}</span>
                  <span className="font-medium text-text-primary truncate max-w-[200px]">{v}</span>
                </div>
              ))}
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Email (for invoice)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com"
                className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:bg-white" />
            </div>

            {/* Payment */}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setPaymentMethod("COD")}
                className={`flex items-center gap-2 rounded-xl border-2 p-3 transition-all ${paymentMethod === "COD" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
                <Truck size={16} className={paymentMethod === "COD" ? "text-[#1d1a17]" : "text-text-muted"} />
                <div>
                  <p className="text-xs font-semibold text-text-primary">Cash on Delivery</p>
                  <p className="text-[10px] text-emerald-600 font-medium">Free · No extra charge</p>
                </div>
              </button>
              <button type="button" onClick={() => setPaymentMethod("ONLINE")}
                className={`flex items-center gap-2 rounded-xl border-2 p-3 transition-all ${paymentMethod === "ONLINE" ? "border-[#1d1a17] bg-[#f4efe7]" : "border-black/10 hover:border-black/20"}`}>
                <CreditCard size={16} className={paymentMethod === "ONLINE" ? "text-[#1d1a17]" : "text-text-muted"} />
                <div>
                  <p className="text-xs font-semibold text-text-primary">Online Payment</p>
                  <p className="text-[10px] text-text-muted">UPI / Card</p>
                </div>
              </button>
            </div>

            {createMutation.isError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">Failed to place order. Please try again.</div>}

            <div className="flex gap-3">
              <button onClick={() => setStep("binding")} className="flex-1 rounded-full border border-black/10 py-3 text-sm text-text-muted hover:text-text-primary">Back</button>
              <button onClick={handleSubmit} disabled={createMutation.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#1d1a17] py-3 text-sm text-white hover:bg-black disabled:opacity-60">
                {createMutation.isPending ? <><Loader2 size={15} className="animate-spin" />Placing...</> : `Place Order — ${fmt(totalPrice)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
