import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { getBanners, createBanner, updateBanner, deleteBanner, type Banner } from "../../api/banners.api";

type EditingBanner = {
  id: string;
  redirectUrl: string;
  title: string;
  isActive: boolean;
  order: number;
};

export default function AdminBannersPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingBanner | null>(null);
  const [newForm, setNewForm] = useState({ redirectUrl: "", title: "", isActive: true, order: 0 });
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: getBanners,
  });

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => createBanner(formData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      void queryClient.invalidateQueries({ queryKey: ["banners"] });
      setIsAdding(false);
      setNewFile(null);
      setNewPreview(null);
      setNewForm({ redirectUrl: "", title: "", isActive: true, order: 0 });
      setError("");
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? "Failed to create banner"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EditingBanner> }) => updateBanner(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      void queryClient.invalidateQueries({ queryKey: ["banners"] });
      setEditingId(null);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBanner(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      void queryClient.invalidateQueries({ queryKey: ["banners"] });
    },
  });

  const banners: Banner[] = data?.data ?? [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewFile(file);
    setNewPreview(URL.createObjectURL(file));
  };

  const handleCreate = () => {
    if (!newFile) { setError("Please select an image"); return; }
    if (!newForm.redirectUrl) { setError("Please enter a redirect URL"); return; }
    setError("");
    const fd = new FormData();
    fd.append("image", newFile);
    fd.append("redirectUrl", newForm.redirectUrl);
    fd.append("title", newForm.title);
    fd.append("isActive", String(newForm.isActive));
    fd.append("order", String(newForm.order));
    createMutation.mutate(fd);
  };

  const startEdit = (banner: Banner) => {
    setEditingId(banner.id);
    setEditing({ id: banner.id, redirectUrl: banner.redirectUrl, title: banner.title ?? "", isActive: banner.isActive, order: banner.order });
  };

  const handleUpdate = () => {
    if (!editing) return;
    updateMutation.mutate({ id: editing.id, data: editing });
  };

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-white" />)}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto space-y-5 pr-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">Manage</p>
          <h2 className="font-serif text-2xl text-text-primary">Banners</h2>
        </div>
        <button type="button" onClick={() => { setIsAdding(true); setError(""); }}
          className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-4 py-2.5 text-sm text-white transition-all hover:-translate-y-0.5 hover:bg-black">
          <Plus size={15} /> Add Banner
        </button>
      </div>

      {/* Add Banner Form */}
      {isAdding && (
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl text-text-primary">New Banner</h3>
            <button type="button" onClick={() => { setIsAdding(false); setError(""); setNewPreview(null); setNewFile(null); }}
              className="rounded-full p-1.5 text-text-muted hover:bg-[#f4efe7] hover:text-text-primary">
              <X size={16} />
            </button>
          </div>

          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Image Upload */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Banner Image *</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="relative flex h-40 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-black/15 bg-[#f8f4ee] transition-colors hover:border-black/30"
              >
                {newPreview ? (
                  <img src={newPreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-text-muted">
                    <ImagePlus size={28} />
                    <span className="text-sm">Click to upload image</span>
                    <span className="text-xs">Recommended: 1200×400px or wider</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Redirect URL *</label>
              <input type="text" value={newForm.redirectUrl} onChange={(e) => setNewForm((f) => ({ ...f, redirectUrl: e.target.value }))}
                placeholder="e.g. /books or https://example.com"
                className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
            </div>

            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Title (optional)</label>
              <input type="text" value={newForm.title} onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Banner title text"
                className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
            </div>

            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Display Order</label>
              <input type="number" value={newForm.order} onChange={(e) => setNewForm((f) => ({ ...f, order: Number(e.target.value) }))}
                className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs uppercase tracking-widest text-text-muted">Active</label>
              <button type="button" onClick={() => setNewForm((f) => ({ ...f, isActive: !f.isActive }))}
                className={`relative h-6 w-11 rounded-full transition-colors ${newForm.isActive ? "bg-emerald-500" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${newForm.isActive ? "left-[calc(100%-1.375rem)]" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => { setIsAdding(false); setNewPreview(null); setNewFile(null); setError(""); }}
              className="rounded-full border border-black/10 px-4 py-2 text-sm text-text-muted hover:text-text-primary">
              Cancel
            </button>
            <button type="button" onClick={handleCreate} disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-5 py-2 text-sm text-white transition-all hover:bg-black disabled:opacity-60">
              <Save size={14} />
              {createMutation.isPending ? "Saving..." : "Save Banner"}
            </button>
          </div>
        </div>
      )}

      {/* Banner List */}
      {banners.length === 0 && !isAdding ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-12 text-center">
          <ImagePlus size={32} className="mx-auto text-text-muted" />
          <p className="mt-4 font-serif text-xl text-text-primary">No banners yet</p>
          <p className="mt-2 text-sm text-text-muted">Add your first banner to show on the homepage.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => (
            <div key={banner.id} className="overflow-hidden rounded-2xl border border-black/8 bg-white">
              {editingId === banner.id && editing ? (
                <div className="p-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Redirect URL</label>
                      <input type="text" value={editing.redirectUrl} onChange={(e) => setEditing((ed) => ed ? { ...ed, redirectUrl: e.target.value } : ed)}
                        className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Title</label>
                      <input type="text" value={editing.title} onChange={(e) => setEditing((ed) => ed ? { ...ed, title: e.target.value } : ed)}
                        className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Order</label>
                      <input type="number" value={editing.order} onChange={(e) => setEditing((ed) => ed ? { ...ed, order: Number(e.target.value) } : ed)}
                        className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
                    </div>
                    <div className="flex items-center gap-3 pt-5">
                      <label className="text-xs uppercase tracking-widest text-text-muted">Active</label>
                      <button type="button" onClick={() => setEditing((ed) => ed ? { ...ed, isActive: !ed.isActive } : ed)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${editing.isActive ? "bg-emerald-500" : "bg-gray-200"}`}>
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${editing.isActive ? "left-[calc(100%-1.375rem)]" : "left-0.5"}`} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => { setEditingId(null); setEditing(null); }}
                      className="rounded-full border border-black/10 px-4 py-2 text-sm text-text-muted hover:text-text-primary">Cancel</button>
                    <button type="button" onClick={handleUpdate} disabled={updateMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-5 py-2 text-sm text-white hover:bg-black disabled:opacity-60">
                      <Save size={14} />{updateMutation.isPending ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-3 sm:p-4">
                  <img src={banner.imageUrl} alt={banner.title ?? "Banner"} className="h-16 w-28 rounded-xl object-cover bg-[#f4efe7] sm:h-20 sm:w-36" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-text-primary text-sm sm:text-base">{banner.title || "Untitled Banner"}</p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">{banner.redirectUrl}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${banner.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {banner.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className="text-[10px] text-text-muted">Order: {banner.order}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => startEdit(banner)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-text-muted transition-colors hover:border-black/20 hover:text-text-primary">
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => deleteMutation.mutate(banner.id)} disabled={deleteMutation.isPending}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-red-100 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
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
