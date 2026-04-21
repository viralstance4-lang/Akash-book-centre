import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { getAdminCoupons, createCoupon, updateCoupon, deleteCoupon, type Coupon } from "../../api/coupons.api";

const formatDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function AdminCouponsPage() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [newForm, setNewForm] = useState({
    code: "", discountType: "percentage" as "percentage" | "fixed",
    discountValue: "", minOrderAmount: "", maxUses: "", isActive: true, expiresAt: "",
  });
  const [editForm, setEditForm] = useState<Partial<Coupon>>({});

  const { data, isLoading } = useQuery({ queryKey: ["admin-coupons"], queryFn: getAdminCoupons });
  const coupons = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: createCoupon,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["admin-coupons"] }); setIsAdding(false); setNewForm({ code: "", discountType: "percentage", discountValue: "", minOrderAmount: "", maxUses: "", isActive: true, expiresAt: "" }); setError(""); },
    onError: (e: any) => setError(e?.response?.data?.message ?? "Failed to create coupon"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateCoupon(id, data),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["admin-coupons"] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });

  const handleCreate = () => {
    if (!newForm.code || !newForm.discountValue) { setError("Code and discount value are required"); return; }
    createMutation.mutate({
      code: newForm.code,
      discountType: newForm.discountType,
      discountValue: Number(newForm.discountValue),
      minOrderAmount: newForm.minOrderAmount ? Number(newForm.minOrderAmount) : undefined,
      maxUses: newForm.maxUses ? Number(newForm.maxUses) : undefined,
      isActive: newForm.isActive,
      expiresAt: newForm.expiresAt || undefined,
    } as any);
  };

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">Manage</p>
          <h2 className="font-serif text-2xl text-text-primary">Coupon Codes</h2>
        </div>
        <button type="button" onClick={() => { setIsAdding(true); setError(""); }}
          className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-4 py-2.5 text-sm text-white hover:-translate-y-0.5 hover:bg-black transition-all">
          <Plus size={15} /> Add Coupon
        </button>
      </div>

      {isAdding && (
        <div className="rounded-2xl border border-black/10 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl text-text-primary">New Coupon</h3>
            <button type="button" onClick={() => { setIsAdding(false); setError(""); }} className="rounded-full p-1.5 text-text-muted hover:bg-[#f4efe7]"><X size={16} /></button>
          </div>
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Coupon Code *</label>
              <input type="text" value={newForm.code} onChange={(e) => setNewForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. SAVE20" className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Discount Type *</label>
              <select value={newForm.discountType} onChange={(e) => setNewForm(f => ({ ...f, discountType: e.target.value as any }))}
                className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Discount Value *</label>
              <input type="number" value={newForm.discountValue} onChange={(e) => setNewForm(f => ({ ...f, discountValue: e.target.value }))}
                placeholder={newForm.discountType === "percentage" ? "e.g. 10 for 10%" : "e.g. 50 for ₹50"}
                className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Min Order Amount (₹)</label>
              <input type="number" value={newForm.minOrderAmount} onChange={(e) => setNewForm(f => ({ ...f, minOrderAmount: e.target.value }))}
                placeholder="Optional" className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Max Uses</label>
              <input type="number" value={newForm.maxUses} onChange={(e) => setNewForm(f => ({ ...f, maxUses: e.target.value }))}
                placeholder="Optional (unlimited)" className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Expires At</label>
              <input type="datetime-local" value={newForm.expiresAt} onChange={(e) => setNewForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
            </div>
            <div className="flex items-center gap-3 pt-4">
              <label className="text-xs uppercase tracking-widest text-text-muted">Active</label>
              <button type="button" onClick={() => setNewForm(f => ({ ...f, isActive: !f.isActive }))}
                className={`relative h-6 w-11 rounded-full transition-colors ${newForm.isActive ? "bg-emerald-500" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${newForm.isActive ? "left-[calc(100%-1.375rem)]" : "left-0.5"}`} />
              </button>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => { setIsAdding(false); setError(""); }} className="rounded-full border border-black/10 px-4 py-2 text-sm text-text-muted">Cancel</button>
            <button type="button" onClick={handleCreate} disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-5 py-2 text-sm text-white hover:bg-black disabled:opacity-60">
              <Save size={14} />{createMutation.isPending ? "Saving..." : "Save Coupon"}
            </button>
          </div>
        </div>
      )}

      {coupons.length === 0 && !isAdding ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-12 text-center">
          <p className="font-serif text-xl text-text-primary">No coupons yet</p>
          <p className="mt-2 text-sm text-text-muted">Create your first coupon code.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="overflow-hidden rounded-2xl border border-black/8 bg-white">
              {editingId === coupon.id ? (
                <div className="p-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3 pt-1">
                      <label className="text-xs uppercase tracking-widest text-text-muted">Active</label>
                      <button type="button" onClick={() => setEditForm(f => ({ ...f, isActive: !f.isActive }))}
                        className={`relative h-6 w-11 rounded-full transition-colors ${editForm.isActive ? "bg-emerald-500" : "bg-gray-200"}`}>
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${editForm.isActive ? "left-[calc(100%-1.375rem)]" : "left-0.5"}`} />
                      </button>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Max Uses</label>
                      <input type="number" value={editForm.maxUses ?? ""} onChange={(e) => setEditForm(f => ({ ...f, maxUses: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:bg-white" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-full border border-black/10 px-4 py-2 text-sm text-text-muted">Cancel</button>
                    <button type="button" onClick={() => updateMutation.mutate({ id: coupon.id, data: editForm })} disabled={updateMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-5 py-2 text-sm text-white hover:bg-black disabled:opacity-60">
                      <Save size={14} />{updateMutation.isPending ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-text-primary">{coupon.code}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${coupon.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {coupon.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        {coupon.discountType === "percentage" ? `${coupon.discountValue}% off` : `₹${coupon.discountValue} off`}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-text-muted">
                      {coupon.minOrderAmount && <span>Min: ₹{coupon.minOrderAmount}</span>}
                      {coupon.maxUses && <span>Uses: {coupon.usedCount}/{coupon.maxUses}</span>}
                      {coupon.expiresAt && <span>Expires: {formatDate(coupon.expiresAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => { setEditingId(coupon.id); setEditForm({ isActive: coupon.isActive, maxUses: coupon.maxUses }); }}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-text-muted hover:text-text-primary">
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => deleteMutation.mutate(coupon.id)} disabled={deleteMutation.isPending}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
