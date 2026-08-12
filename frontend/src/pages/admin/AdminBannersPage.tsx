import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Monitor, Pencil, Plus, Save, Smartphone, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { getAdminBanners, createBanner, updateBanner, deleteBanner, type Banner } from "../../api/banners.api";

type EditingBanner = {
  id: string;
  redirectUrl: string;
  title: string;
  isActive: boolean;
  order: number;
};

type ImagePair = {
  desktopFile: File | null;
  desktopPreview: string | null;
  mobileFile: File | null;
  mobilePreview: string | null;
};

const emptyImagePair = (): ImagePair => ({
  desktopFile: null, desktopPreview: null,
  mobileFile: null,  mobilePreview: null,
});

export default function AdminBannersPage() {
  const queryClient = useQueryClient();

  // Refs for hidden file inputs
  const newDesktopRef   = useRef<HTMLInputElement>(null);
  const newMobileRef    = useRef<HTMLInputElement>(null);
  const editDesktopRef  = useRef<HTMLInputElement>(null);
  const editMobileRef   = useRef<HTMLInputElement>(null);

  const [isAdding, setIsAdding]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editing, setEditing]       = useState<EditingBanner | null>(null);

  const [newForm, setNewForm] = useState({ redirectUrl: "", title: "", isActive: true, order: 0 });
  const [newImages, setNewImages]   = useState<ImagePair>(emptyImagePair());

  const [editImages, setEditImages] = useState<ImagePair>(emptyImagePair());
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: getAdminBanners,
  });

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => createBanner(formData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      void queryClient.invalidateQueries({ queryKey: ["banners"] });
      setIsAdding(false);
      setNewImages(emptyImagePair());
      setNewForm({ redirectUrl: "", title: "", isActive: true, order: 0 });
      setError("");
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? "Failed to create banner"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) => updateBanner(id, formData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
      void queryClient.invalidateQueries({ queryKey: ["banners"] });
      setEditingId(null);
      setEditing(null);
      setEditImages(emptyImagePair());
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

  const pickFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    key: "new" | "edit",
    side: "desktop" | "mobile",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (key === "new") {
      setNewImages((p) => side === "desktop"
        ? { ...p, desktopFile: file, desktopPreview: preview }
        : { ...p, mobileFile: file, mobilePreview: preview });
    } else {
      setEditImages((p) => side === "desktop"
        ? { ...p, desktopFile: file, desktopPreview: preview }
        : { ...p, mobileFile: file, mobilePreview: preview });
    }
    e.target.value = "";
  };

  const handleCreate = () => {
    if (!newImages.desktopFile) { setError("Please select a desktop image"); return; }
    if (!newImages.mobileFile)  { setError("Please select a mobile image"); return; }
    if (!newForm.redirectUrl)   { setError("Please enter a redirect URL"); return; }
    setError("");
    const fd = new FormData();
    fd.append("desktopImage", newImages.desktopFile);
    fd.append("mobileImage",  newImages.mobileFile);
    fd.append("redirectUrl", newForm.redirectUrl);
    fd.append("title",       newForm.title);
    fd.append("isActive",    String(newForm.isActive));
    fd.append("order",       String(newForm.order));
    createMutation.mutate(fd);
  };

  const startEdit = (banner: Banner) => {
    setEditingId(banner.id);
    setEditing({
      id: banner.id,
      redirectUrl: banner.redirectUrl,
      title: banner.title ?? "",
      isActive: banner.isActive,
      order: banner.order,
    });
    setEditImages(emptyImagePair());
  };

  const handleUpdate = () => {
    if (!editing) return;
    const fd = new FormData();
    if (editImages.desktopFile) fd.append("desktopImage", editImages.desktopFile);
    if (editImages.mobileFile)  fd.append("mobileImage",  editImages.mobileFile);
    fd.append("redirectUrl", editing.redirectUrl);
    fd.append("title",       editing.title);
    fd.append("isActive",    String(editing.isActive));
    fd.append("order",       String(editing.order));
    updateMutation.mutate({ id: editing.id, formData: fd });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditing(null);
    setEditImages(emptyImagePair());
  };

  if (isLoading) return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-white" />)}
    </div>
  );

  return (
    <div className="space-y-5">
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

      {/* ── Add Banner Form ── */}
      {isAdding && (
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl text-text-primary">New Banner</h3>
            <button type="button"
              onClick={() => { setIsAdding(false); setError(""); setNewImages(emptyImagePair()); }}
              className="rounded-full p-1.5 text-text-muted hover:bg-[#f4efe7] hover:text-text-primary">
              <X size={16} />
            </button>
          </div>

          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

          {/* Dual image upload */}
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <ImageUploadBox
              label="Desktop Banner Image *"
              hint="Recommended: 1920×600px"
              icon={<Monitor size={22} />}
              preview={newImages.desktopPreview}
              onClick={() => newDesktopRef.current?.click()}
            />
            <ImageUploadBox
              label="Mobile Banner Image *"
              hint="Recommended: 768×400px"
              icon={<Smartphone size={22} />}
              preview={newImages.mobilePreview}
              onClick={() => newMobileRef.current?.click()}
            />
          </div>
          <input ref={newDesktopRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => pickFile(e, "new", "desktop")} />
          <input ref={newMobileRef}  type="file" accept="image/*" className="hidden"
            onChange={(e) => pickFile(e, "new", "mobile")} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Redirect URL *</label>
              <input type="text" value={newForm.redirectUrl}
                onChange={(e) => setNewForm((f) => ({ ...f, redirectUrl: e.target.value }))}
                placeholder="e.g. /books or https://example.com"
                className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Title (optional)</label>
              <input type="text" value={newForm.title}
                onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Banner title text"
                className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Display Order</label>
              <input type="number" value={newForm.order}
                onChange={(e) => setNewForm((f) => ({ ...f, order: Number(e.target.value) }))}
                className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <label className="text-xs uppercase tracking-widest text-text-muted">Active</label>
              <ToggleSwitch on={newForm.isActive} onToggle={() => setNewForm((f) => ({ ...f, isActive: !f.isActive }))} />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button type="button"
              onClick={() => { setIsAdding(false); setNewImages(emptyImagePair()); setError(""); }}
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

      {/* ── Banner List ── */}
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
                /* ── Inline Edit Form ── */
                <div className="p-5 space-y-4">
                  {/* Optional image re-upload */}
                  <p className="text-xs uppercase tracking-widest text-text-muted">Replace Images (optional)</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ImageUploadBox
                      label="Desktop Image"
                      hint="Leave empty to keep current"
                      icon={<Monitor size={20} />}
                      preview={editImages.desktopPreview ?? (banner.desktopImageUrl ?? banner.imageUrl)}
                      onClick={() => editDesktopRef.current?.click()}
                      dim
                    />
                    <ImageUploadBox
                      label="Mobile Image"
                      hint="Leave empty to keep current"
                      icon={<Smartphone size={20} />}
                      preview={editImages.mobilePreview ?? (banner.mobileImageUrl ?? banner.imageUrl)}
                      onClick={() => editMobileRef.current?.click()}
                      dim
                    />
                  </div>
                  <input ref={editDesktopRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => pickFile(e, "edit", "desktop")} />
                  <input ref={editMobileRef}  type="file" accept="image/*" className="hidden"
                    onChange={(e) => pickFile(e, "edit", "mobile")} />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Redirect URL</label>
                      <input type="text" value={editing.redirectUrl}
                        onChange={(e) => setEditing((ed) => ed ? { ...ed, redirectUrl: e.target.value } : ed)}
                        className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Title</label>
                      <input type="text" value={editing.title}
                        onChange={(e) => setEditing((ed) => ed ? { ...ed, title: e.target.value } : ed)}
                        className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">Order</label>
                      <input type="number" value={editing.order}
                        onChange={(e) => setEditing((ed) => ed ? { ...ed, order: Number(e.target.value) } : ed)}
                        className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white" />
                    </div>
                    <div className="flex items-center gap-3 pt-5">
                      <label className="text-xs uppercase tracking-widest text-text-muted">Active</label>
                      <ToggleSwitch on={editing.isActive} onToggle={() => setEditing((ed) => ed ? { ...ed, isActive: !ed.isActive } : ed)} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={cancelEdit}
                      className="rounded-full border border-black/10 px-4 py-2 text-sm text-text-muted hover:text-text-primary">Cancel</button>
                    <button type="button" onClick={handleUpdate} disabled={updateMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-5 py-2 text-sm text-white hover:bg-black disabled:opacity-60">
                      <Save size={14} />{updateMutation.isPending ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── List Row ── */
                <div className="flex items-center gap-4 p-3 sm:p-4">
                  {/* Thumbnails: desktop + mobile side by side */}
                  <div className="flex shrink-0 gap-2">
                    <div className="relative">
                      <img
                        src={banner.desktopImageUrl ?? banner.imageUrl}
                        alt={banner.title ?? "Desktop"}
                        className="h-16 w-24 rounded-xl object-cover bg-[#f4efe7] sm:h-20 sm:w-32"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 py-0.5 text-[8px] text-white leading-none">
                        <Monitor size={8} className="inline mr-0.5" />Desktop
                      </span>
                    </div>
                    <div className="relative hidden sm:block">
                      <img
                        src={banner.mobileImageUrl ?? banner.imageUrl}
                        alt={banner.title ?? "Mobile"}
                        className="h-20 w-12 rounded-xl object-cover bg-[#f4efe7]"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 py-0.5 text-[8px] text-white leading-none">
                        <Smartphone size={8} className="inline mr-0.5" />Mobile
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-text-primary text-sm sm:text-base">
                      {banner.title || "Untitled Banner"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">{banner.redirectUrl}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        banner.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {banner.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className="text-[10px] text-text-muted">Order: {banner.order}</span>
                      {!banner.mobileImageUrl && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          Legacy (no separate mobile image)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => startEdit(banner)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-text-muted transition-colors hover:border-black/20 hover:text-text-primary">
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => { if (window.confirm(`Delete banner "${banner.title || banner.redirectUrl}"? This will remove it from the live homepage.`)) deleteMutation.mutate(banner.id); }} disabled={deleteMutation.isPending}
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

// ── Small reusable sub-components ──────────────────────────────────────────

function ImageUploadBox({
  label, hint, icon, preview, onClick, dim = false,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  preview: string | null;
  onClick: () => void;
  dim?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">{label}</label>
      <div
        onClick={onClick}
        className={`relative flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors
          ${dim ? "border-black/10 hover:border-black/20" : "border-black/15 hover:border-black/30"}
          bg-[#f8f4ee]`}
      >
        {preview ? (
          <>
            <img src={preview} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors">
              <span className="hidden text-xs font-medium text-white drop-shadow hover:block">Click to change</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-text-muted">
            {icon}
            <span className="text-sm">Click to upload</span>
            <span className="text-xs text-center px-3">{hint}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-gray-200"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[calc(100%-1.375rem)]" : "left-0.5"}`} />
    </button>
  );
}
