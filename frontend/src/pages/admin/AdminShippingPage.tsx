import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Plus, Save, Trash2, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getAdminShippingConfig,
  testShippingCalculation,
  updateAdminShippingConfig,
  type ShippingConfig,
  type ShippingResult,
  type StateRate,
} from "../../api/shipping.api";

// ─── helpers ─────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">{label}</label>
      {children}
    </div>
  );
}

function NumInput({
  value, onChange, prefix, suffix, placeholder,
}: {
  value: string | number;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-black/10 bg-[#f8f4ee] focus-within:border-black/25 focus-within:bg-white">
      {prefix && <span className="px-3 text-sm text-text-muted">{prefix}</span>}
      <input
        type="number"
        min={0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent py-2.5 pr-3 text-sm outline-none"
        style={{ paddingLeft: prefix ? 0 : "0.75rem" }}
      />
      {suffix && <span className="pr-3 text-sm text-text-muted">{suffix}</span>}
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white p-5">
      <div className="mb-4">
        <h3 className="font-serif text-lg text-text-primary">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  FREE:           { label: "Free Delivery",   color: "bg-emerald-50 text-emerald-700" },
  DISTANCE_BASED: { label: "Distance Based",  color: "bg-blue-50 text-blue-700"      },
  WEIGHT_BASED:   { label: "Weight Based",    color: "bg-amber-50 text-amber-700"    },
  DISABLED:       { label: "Shipping Off",    color: "bg-gray-100 text-gray-500"     },
};

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AdminShippingPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["admin-shipping-config"],
    queryFn:  getAdminShippingConfig,
  });

  // ── form state ──────────────────────────────────────────────────────────────
  const [enabled,           setEnabled]           = useState(true);
  const [codEnabled,        setCodEnabled]        = useState(true);
  const [distThreshold,     setDistThreshold]     = useState("3");
  const [perKmRate,         setPerKmRate]          = useState("8");
  const [freeThreshold,     setFreeThreshold]     = useState("199");
  const [defaultKgRate,        setDefaultKgRate]        = useState("70");
  const [localZoneRate,        setLocalZoneRate]        = useState("50");
  const [northEastRate,        setNorthEastRate]        = useState("80");
  const [localZoneAreaCharge,  setLocalZoneAreaCharge]  = useState("0");
  const [northEastAreaCharge,  setNorthEastAreaCharge]  = useState("0");
  const [defaultAreaCharge,    setDefaultAreaCharge]    = useState("0");
  const [stateRates,           setStateRates]           = useState<StateRate[]>([]);
  const [newState,          setNewState]          = useState("");
  const [newRate,           setNewRate]           = useState("");
  const [saveSuccess,       setSaveSuccess]       = useState(false);

  // ── test calculator state ────────────────────────────────────────────────────
  const [testDist,   setTestDist]   = useState("2");
  const [testValue,  setTestValue]  = useState("150");
  const [testWeight, setTestWeight] = useState("1");
  const [testCity,   setTestCity]   = useState("");
  const [testState,  setTestState]  = useState("");
  const [testResult, setTestResult] = useState<ShippingResult | null>(null);

  // ── seed form from API ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!config) return;
    setEnabled(config.isShippingEnabled);
    setCodEnabled(config.isCodEnabled ?? true);
    setDistThreshold(String(config.distanceThreshold));
    setPerKmRate(String(config.perKmRate));
    setFreeThreshold(String(config.freeDeliveryThreshold));
    setDefaultKgRate(String(config.defaultKgRate));
    setLocalZoneRate(String(config.localZoneRate));
    setNorthEastRate(String(config.northEastRate));
    setLocalZoneAreaCharge(String(config.localZoneAreaCharge ?? 0));
    setNorthEastAreaCharge(String(config.northEastAreaCharge ?? 0));
    setDefaultAreaCharge(String(config.defaultAreaCharge ?? 0));
    setStateRates(config.stateRates ?? []);
  }, [config]);

  // ── save ─────────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: Partial<ShippingConfig>) => updateAdminShippingConfig(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-shipping-config"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      isShippingEnabled:     enabled,
      isCodEnabled:          codEnabled,
      distanceThreshold:     Number(distThreshold),
      perKmRate:             Number(perKmRate),
      freeDeliveryThreshold: Number(freeThreshold),
      defaultKgRate:         Number(defaultKgRate),
      localZoneRate:         Number(localZoneRate),
      northEastRate:         Number(northEastRate),
      localZoneAreaCharge:   Number(localZoneAreaCharge),
      northEastAreaCharge:   Number(northEastAreaCharge),
      defaultAreaCharge:     Number(defaultAreaCharge),
      stateRates,
    });
  };

  // ── state rates helpers ──────────────────────────────────────────────────────
  const addStateRate = () => {
    const name = newState.trim();
    const rate = Number(newRate);
    if (!name || !rate || rate <= 0) return;
    if (stateRates.some((r) => r.state.toLowerCase() === name.toLowerCase())) return;
    setStateRates((prev) => [...prev, { state: name, rate }]);
    setNewState("");
    setNewRate("");
  };

  const removeStateRate = (idx: number) => {
    setStateRates((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateStateRate = (idx: number, field: "state" | "rate", val: string) => {
    setStateRates((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, [field]: field === "rate" ? Number(val) : val } : r,
      ),
    );
  };

  // ── test calculator ──────────────────────────────────────────────────────────
  const testMutation = useMutation({
    mutationFn: testShippingCalculation,
    onSuccess:  (data) => setTestResult(data),
  });

  const handleTest = () => {
    testMutation.mutate({
      distanceInKm: Number(testDist),
      orderValue:   Number(testValue),
      weightInKg:   Number(testWeight),
      city:         testCity  || undefined,
      state:        testState || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">Configure</p>
          <h2 className="font-serif text-2xl text-text-primary">Shipping Settings</h2>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              Saved!
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-5 py-2.5 text-sm text-white hover:-translate-y-0.5 hover:bg-black transition-all disabled:opacity-60"
          >
            <Save size={14} />
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {saveMutation.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {(saveMutation.error as any)?.response?.data?.message ?? "Failed to save. Try again."}
        </div>
      )}

      {/* ── Master toggle ── */}
      <SectionCard title="Shipping Status" subtitle="Disable to offer free shipping store-wide (e.g. during a sale)">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">
              {enabled ? "Shipping is Enabled" : "Shipping is Disabled"}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {enabled ? "Customers will be charged based on the rules below." : "All orders will have ₹0 delivery charge."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-7 w-13 rounded-full transition-colors ${enabled ? "bg-emerald-500" : "bg-gray-200"}`}
            style={{ width: "3.25rem" }}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[calc(100%-1.625rem)]" : "left-1"}`}
            />
          </button>
        </div>
      </SectionCard>

      {/* ── Cash on Delivery toggle ── */}
      <SectionCard title="Cash on Delivery" subtitle="Disable to hide the COD option on checkout store-wide">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">
              {codEnabled ? "COD is Enabled" : "COD is Disabled"}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {codEnabled ? "Customers can choose Cash on Delivery at checkout." : "Cash on Delivery is hidden — customers must pay online."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCodEnabled((v) => !v)}
            className={`relative h-7 w-13 rounded-full transition-colors ${codEnabled ? "bg-emerald-500" : "bg-gray-200"}`}
            style={{ width: "3.25rem" }}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${codEnabled ? "left-[calc(100%-1.625rem)]" : "left-1"}`}
            />
          </button>
        </div>
      </SectionCard>

      {/* ── Local delivery ── */}
      <SectionCard
        title="Local Delivery (Within Distance)"
        subtitle={`Orders within ${distThreshold} km use distance-based pricing`}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Distance Threshold (KM)">
            <NumInput value={distThreshold} onChange={setDistThreshold} suffix="km" placeholder="3" />
          </Field>
          <Field label="Rate Per KM (₹)">
            <NumInput value={perKmRate} onChange={setPerKmRate} prefix="₹" placeholder="8" />
          </Field>
          <Field label="Free Delivery Above (₹)">
            <NumInput value={freeThreshold} onChange={setFreeThreshold} prefix="₹" placeholder="199" />
          </Field>
        </div>
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 space-y-1">
          <p>
            <span className="font-semibold">Example:</span> Order ₹{freeThreshold || "199"}, distance{" "}
            {distThreshold || "3"} km → <span className="font-semibold">FREE</span>
          </p>
          <p>
            Order ₹99, distance 2 km → charge = 2 × ₹{perKmRate || "8"} ={" "}
            <span className="font-semibold">₹{Math.round(2 * Number(perKmRate || 8))}</span>
          </p>
        </div>
      </SectionCard>

      {/* ── Regional shipping zones ── */}
      <SectionCard
        title="Regional Shipping Rates (₹/kg)"
        subtitle="Weight-based rates applied automatically based on the customer's delivery city and state"
      >
        {/* Zone map reference */}
        <div className="mb-5 grid gap-2 rounded-xl border border-black/8 bg-[#f8f4ee] p-4 text-xs text-text-muted sm:grid-cols-3">
          <div>
            <p className="mb-1 font-semibold text-text-primary">Delhi NCR</p>
            <p>Delhi · Noida · Greater Noida<br />Gurugram · Faridabad · Ghaziabad</p>
          </div>
          <div>
            <p className="mb-1 font-semibold text-text-primary">North East</p>
            <p>Arunachal Pradesh · Assam · Manipur<br />Meghalaya · Mizoram · Nagaland<br />Tripura · Sikkim</p>
          </div>
          <div>
            <p className="mb-1 font-semibold text-text-primary">All Over India</p>
            <p>All remaining states and union territories not covered by the above two zones.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Delhi NCR — Weight Rate (₹/kg)">
            <NumInput value={localZoneRate} onChange={setLocalZoneRate} prefix="₹" suffix="/kg" placeholder="50" />
          </Field>
          <Field label="North East — Weight Rate (₹/kg)">
            <NumInput value={northEastRate} onChange={setNorthEastRate} prefix="₹" suffix="/kg" placeholder="80" />
          </Field>
          <Field label="All Over India — Weight Rate (₹/kg)">
            <NumInput value={defaultKgRate} onChange={setDefaultKgRate} prefix="₹" suffix="/kg" placeholder="70" />
          </Field>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-text-primary">Flat Area Charge per Zone <span className="ml-1 text-xs font-normal text-text-muted">(added on top of weight charge · set 0 to disable)</span></p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Delhi NCR — Area Charge (₹)">
              <NumInput value={localZoneAreaCharge} onChange={setLocalZoneAreaCharge} prefix="₹" placeholder="0" />
            </Field>
            <Field label="North East — Area Charge (₹)">
              <NumInput value={northEastAreaCharge} onChange={setNorthEastAreaCharge} prefix="₹" placeholder="0" />
            </Field>
            <Field label="All Over India — Area Charge (₹)">
              <NumInput value={defaultAreaCharge} onChange={setDefaultAreaCharge} prefix="₹" placeholder="0" />
            </Field>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 space-y-1">
          <p><span className="font-semibold">Example (2 kg order) — Area Charge + Weight Charge:</span></p>
          <p>Delhi NCR → ₹{localZoneAreaCharge || "0"} + 2 × ₹{localZoneRate || "50"} = <span className="font-semibold">₹{Number(localZoneAreaCharge || 0) + Math.round(2 * Number(localZoneRate || 50))}</span></p>
          <p>North East → ₹{northEastAreaCharge || "0"} + 2 × ₹{northEastRate || "80"} = <span className="font-semibold">₹{Number(northEastAreaCharge || 0) + Math.round(2 * Number(northEastRate || 80))}</span></p>
          <p>Maharashtra → ₹{defaultAreaCharge || "0"} + 2 × ₹{defaultKgRate || "70"} = <span className="font-semibold">₹{Number(defaultAreaCharge || 0) + Math.round(2 * Number(defaultKgRate || 70))}</span></p>
        </div>
      </SectionCard>

      {/* ── State rates (custom overrides) ── */}
      <SectionCard
        title="State-wise Rates (₹/kg)"
        subtitle="Override the default rate for specific delivery states"
      >
        {/* existing rows */}
        {stateRates.length > 0 && (
          <div className="mb-4 space-y-2">
            {stateRates.map((row, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <input
                  type="text"
                  value={row.state}
                  onChange={(e) => updateStateRate(idx, "state", e.target.value)}
                  placeholder="State name"
                  className="flex-1 rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2 text-sm outline-none focus:border-black/25 focus:bg-white"
                />
                <div className="flex w-36 items-center overflow-hidden rounded-xl border border-black/10 bg-[#f8f4ee] focus-within:border-black/25 focus-within:bg-white">
                  <span className="pl-3 text-sm text-text-muted">₹</span>
                  <input
                    type="number"
                    min={1}
                    value={row.rate}
                    onChange={(e) => updateStateRate(idx, "rate", e.target.value)}
                    placeholder="Rate/kg"
                    className="flex-1 bg-transparent py-2 pr-2 pl-1 text-sm outline-none"
                  />
                  <span className="pr-3 text-xs text-text-muted">/kg</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeStateRate(idx)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* add new row */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newState}
            onChange={(e) => setNewState(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStateRate()}
            placeholder="e.g. Delhi"
            className="flex-1 rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white"
          />
          <div className="flex w-36 items-center overflow-hidden rounded-xl border border-black/10 bg-[#f8f4ee] focus-within:border-black/25 focus-within:bg-white">
            <span className="pl-3 text-sm text-text-muted">₹</span>
            <input
              type="number"
              min={1}
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addStateRate()}
              placeholder="Rate/kg"
              className="flex-1 bg-transparent py-2 pr-2 pl-1 text-sm outline-none"
            />
          </div>
          <button
            type="button"
            onClick={addStateRate}
            disabled={!newState.trim() || !Number(newRate)}
            className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-4 py-2.5 text-sm text-white hover:bg-black disabled:opacity-40 transition-all"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {stateRates.length === 0 && (
          <p className="mt-3 text-xs text-text-muted italic">
            No state-specific rates yet. All long-distance orders use the default ₹{defaultKgRate}/kg rate.
          </p>
        )}
      </SectionCard>

      {/* ── Test Calculator ── */}
      <SectionCard
        title="Live Test Calculator"
        subtitle="Test how the current config will calculate a shipping charge"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Distance (KM)">
            <NumInput value={testDist} onChange={setTestDist} suffix="km" />
          </Field>
          <Field label="Order Value (₹)">
            <NumInput value={testValue} onChange={setTestValue} prefix="₹" />
          </Field>
          <Field label="Weight (KG)">
            <NumInput value={testWeight} onChange={setTestWeight} suffix="kg" />
          </Field>
          <Field label="City (for zone detection)">
            <input
              type="text"
              value={testCity}
              onChange={(e) => setTestCity(e.target.value)}
              placeholder="e.g. Noida"
              className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white"
            />
          </Field>
          <Field label="State (for zone detection)">
            <input
              type="text"
              value={testState}
              onChange={(e) => setTestState(e.target.value)}
              placeholder="e.g. Assam"
              className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white"
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={handleTest}
            disabled={testMutation.isPending}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#f8f4ee] px-5 py-2.5 text-sm text-text-primary hover:bg-white transition-all disabled:opacity-60"
          >
            <Calculator size={14} />
            {testMutation.isPending ? "Calculating..." : "Calculate"}
          </button>

          {testResult && (
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${TYPE_LABELS[testResult.type]?.color ?? "bg-gray-100 text-gray-600"}`}>
                {TYPE_LABELS[testResult.type]?.label ?? testResult.type}
              </span>
              <span className="font-serif text-xl font-semibold text-text-primary">
                {testResult.charge === 0 ? "Free" : `₹${testResult.charge}`}
              </span>
              <span className="text-xs text-text-muted">
                {testResult.type === "DISTANCE_BASED" && `${testResult.breakdown.distance} km × ₹${testResult.breakdown.rate}/km`}
                {testResult.type === "WEIGHT_BASED"   && (
                  testResult.areaCharge && testResult.areaCharge > 0
                    ? `Area ₹${testResult.areaCharge} + ${testResult.breakdown.weight} kg × ₹${testResult.breakdown.rate}/kg · Zone: ${testResult.zone ?? testResult.breakdown.zone ?? "All India"}`
                    : `${testResult.breakdown.weight} kg × ₹${testResult.breakdown.rate}/kg · Zone: ${testResult.zone ?? testResult.breakdown.zone ?? "All India"}`
                )}
                {testResult.type === "FREE"            && "Order value above free delivery threshold"}
                {testResult.type === "DISABLED"        && "Shipping is currently disabled"}
              </span>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Summary card ── */}
      <div className="rounded-2xl border border-black/8 bg-[#1d1a17] p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Truck size={16} className="text-white/60" />
          <h3 className="font-serif text-base">Current Config Summary</h3>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/50">Status</p>
            <p className={`mt-0.5 font-medium ${enabled ? "text-emerald-400" : "text-red-400"}`}>
              {enabled ? "Enabled" : "Disabled"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/50">Local (≤{distThreshold} km)</p>
            <p className="mt-0.5 font-medium">₹{perKmRate}/km · Free ≥₹{freeThreshold}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/50">Delhi NCR</p>
            <p className="mt-0.5 font-medium">₹{localZoneRate}/kg</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/50">North East</p>
            <p className="mt-0.5 font-medium">₹{northEastRate}/kg</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/50">All India</p>
            <p className="mt-0.5 font-medium">₹{defaultKgRate}/kg</p>
          </div>
        </div>
      </div>

    </div>
  );
}
