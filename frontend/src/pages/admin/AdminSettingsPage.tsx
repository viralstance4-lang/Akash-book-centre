import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getSettings, updateSettings } from "../../api/settings.api";

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [storeName, setStoreName] = useState("BucketList Books");
  const [tagline, setTagline] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoWidth, setLogoWidth] = useState(120);
  const [logoHeight, setLogoHeight] = useState(40);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [spiralBindingPrice, setSpiralBindingPrice] = useState(30);
  const [success, setSuccess] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["site-settings"], queryFn: getSettings });
  const settings = data?.data;

  useEffect(() => {
    if (settings) {
      setStoreName(settings.storeName ?? "BucketList Books");
      setTagline(settings.tagline ?? "");
      setLogoWidth(settings.logoWidth ?? 120);
      setLogoHeight(settings.logoHeight ?? 40);
      setSpiralBindingPrice(Number(settings.spiralBindingPrice ?? 30));
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (fd: FormData) => updateSettings(fd),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      setSuccess("Settings saved successfully!");
      setLogoFile(null); setLogoPreview(null); setRemoveLogo(false);
      setTimeout(() => setSuccess(""), 3000);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const handleRemoveLogo = () => {
    setRemoveLogo(true);
    setLogoFile(null);
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = () => {
    const fd = new FormData();
    fd.append("storeName", storeName);
    fd.append("tagline", tagline);
    fd.append("logoWidth", String(logoWidth));
    fd.append("logoHeight", String(logoHeight));
    fd.append("spiralBindingPrice", String(spiralBindingPrice));
    if (removeLogo) fd.append("removeLogo", "true");
    if (logoFile) fd.append("logo", logoFile);
    updateMutation.mutate(fd);
  };

  const currentLogoUrl = removeLogo ? null : (logoPreview ?? settings?.logoUrl);
  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-white" />;

  return (
    <div className="h-full overflow-y-auto space-y-5 pr-1 max-w-2xl">
      <div>
        <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">Manage</p>
        <h2 className="font-serif text-2xl text-text-primary">Store Settings</h2>
      </div>

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-medium">
          ✅ {success}
        </div>
      )}

      {/* Logo */}
      <div className="rounded-2xl border border-black/8 bg-white p-5 space-y-4">
        <h3 className="font-serif text-lg text-text-primary">Store Logo</h3>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div onClick={() => !currentLogoUrl && fileRef.current?.click()}
            className={`flex h-24 w-44 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-[#f8f4ee] transition-colors ${currentLogoUrl ? "border-black/10" : "cursor-pointer border-dashed border-black/15 hover:border-black/30"}`}>
            {currentLogoUrl ? (
              <img src={currentLogoUrl} alt="Logo" style={{ width: logoWidth, height: logoHeight, objectFit: "contain" }} />
            ) : (
              <div className="flex flex-col items-center gap-1 text-text-muted"><ImagePlus size={22} /><span className="text-[10px]">Upload logo</span></div>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="rounded-full border border-black/10 px-4 py-2 text-xs font-medium text-text-primary hover:bg-[#f4efe7] transition-colors">
                {currentLogoUrl ? "Change Logo" : "Upload Logo"}
              </button>
              {currentLogoUrl && (
                <button type="button" onClick={handleRemoveLogo}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={12} /> Remove Logo
                </button>
              )}
            </div>
            <p className="text-xs text-text-muted">PNG with transparent background recommended</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-text-muted">Width (px)</label>
                <input type="number" value={logoWidth} min={40} max={400} onChange={(e) => setLogoWidth(Number(e.target.value))}
                  className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-3 py-2 text-sm outline-none focus:bg-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-text-muted">Height (px)</label>
                <input type="number" value={logoHeight} min={20} max={200} onChange={(e) => setLogoHeight(Number(e.target.value))}
                  className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-3 py-2 text-sm outline-none focus:bg-white" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <p className="w-full text-xs text-text-muted">Quick size presets:</p>
              {[{ label: "Small", w: 80, h: 28 }, { label: "Medium", w: 120, h: 40 }, { label: "Large", w: 180, h: 56 }, { label: "XL", w: 240, h: 72 }].map((p) => (
                <button key={p.label} type="button" onClick={() => { setLogoWidth(p.w); setLogoHeight(p.h); }}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${logoWidth === p.w && logoHeight === p.h ? "bg-[#1d1a17] text-white" : "border border-black/10 text-text-muted hover:text-text-primary"}`}>
                  {p.label} ({p.w}×{p.h})
                </button>
              ))}
            </div>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Store Info */}
      <div className="rounded-2xl border border-black/8 bg-white p-5 space-y-4">
        <h3 className="font-serif text-lg text-text-primary">Store Info</h3>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Store Name</label>
          <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="BucketList Books"
            className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Tagline</label>
          <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Your curated independent bookstore"
            className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
        </div>
      </div>

      {/* Binding Pricing */}
      <div className="rounded-2xl border border-black/8 bg-white p-5 space-y-4">
        <h3 className="font-serif text-lg text-text-primary">Binding Pricing</h3>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">
            Spiral Binding Extra Charge (₹)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={spiralBindingPrice}
            onChange={(e) => setSpiralBindingPrice(Number(e.target.value))}
            className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white"
          />
          <p className="mt-1.5 text-xs text-text-muted">
            Added to product price when customer selects Spiral Binding on a product page.
            Currently: <strong>₹{spiralBindingPrice}</strong>
          </p>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-2xl border border-black/8 bg-[#f8f4ee] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">Live Preview (in navbar)</p>
        <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm border border-black/8">
          {currentLogoUrl
            ? <img src={currentLogoUrl} alt="Preview" style={{ width: logoWidth, height: logoHeight, objectFit: "contain" }} />
            : <span className="font-serif text-lg font-bold text-text-primary">{storeName || "BucketList Books"}</span>
          }
          {tagline && <span className="text-xs text-text-muted">— {tagline}</span>}
        </div>
      </div>

      <button type="button" onClick={handleSave} disabled={updateMutation.isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1d1a17] py-3 text-sm font-medium text-white hover:bg-black disabled:opacity-60 transition-all">
        <Save size={14} />{updateMutation.isPending ? "Saving..." : "Save All Settings"}
      </button>
    </div>
  );
}
