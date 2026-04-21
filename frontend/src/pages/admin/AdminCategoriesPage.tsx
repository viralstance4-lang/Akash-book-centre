/**
 * AdminCategoriesPage
 * ──────────────────────────────────────────────────────────────────────────────
 * Category + Subcategory management.
 *
 * Features:
 *  • Category: name + image upload (Cloudinary via backend)
 *  • Subcategory: name, belongs to a category
 *  • Tree-view: each category card lists its subcategories inline
 *  • Create / Edit / Delete for both levels
 *  • Image preview before upload
 */

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  getCategories,
  updateCategory,
  updateSubcategory,
  type Category,
  type Subcategory,
} from "../../api/categories.api";
import type { ApiErrorResponse } from "../../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function errMsg(e: unknown, fallback: string) {
  const ae = e as AxiosError<ApiErrorResponse>;
  return ae.response?.data?.message ?? fallback;
}

// ── Image upload field ────────────────────────────────────────────────────────

function ImageUploadField({
  existingUrl,
  onChange,
}: {
  existingUrl?: string | null;
  onChange: (file: File | undefined) => void;
}) {
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPreview(existingUrl ?? null); }, [existingUrl]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onChange(file);
  };

  const clear = () => {
    setPreview(null);
    onChange(undefined);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-widest text-text-muted">
        Category Image
      </label>
      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt="Preview" className="h-28 w-28 rounded-2xl object-cover shadow-sm ring-1 ring-black/10" />
          <button type="button" onClick={clear}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/10 text-text-muted hover:text-red-500 transition-colors">
            <X size={12} />
          </button>
          <button type="button" onClick={() => inputRef.current?.click()}
            className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/10 text-text-muted hover:text-text-primary transition-colors">
            <Pencil size={10} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/15 bg-[#f8f4ee] text-text-muted transition-all hover:border-[#1d1a17]/30 hover:bg-[#f3ede4]">
          <Upload size={18} />
          <span className="text-[10px] font-medium">Upload</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])} />
      <p className="text-[10px] text-text-muted">JPG, PNG, WebP · max 5 MB</p>
    </div>
  );
}

// ── Category modal (create / edit) ────────────────────────────────────────────

type CatModalState = { mode: "create" } | { mode: "edit"; item: Category };

function CategoryModal({ state, onClose }: { state: CatModalState; onClose: () => void }) {
  const qc     = useQueryClient();
  const isEdit = state.mode === "edit";

  const [name,      setName]      = useState(isEdit ? state.item.name : "");
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [error,     setError]     = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["categories"] });

  const createMut = useMutation({
    mutationFn: () => createCategory({ name: name.trim(), imageFile }),
    onSuccess:  () => { invalidate(); onClose(); },
    onError:    (e) => setError(errMsg(e, "Failed to create category.")),
  });

  const updateMut = useMutation({
    mutationFn: () => updateCategory((state as { mode: "edit"; item: Category }).item.id, {
      name: name.trim(), imageFile,
    }),
    onSuccess:  () => { invalidate(); onClose(); },
    onError:    (e) => setError(errMsg(e, "Failed to update category.")),
  });

  const isPending    = createMut.isPending || updateMut.isPending;
  const existingImg  = isEdit ? state.item.imageUrl : undefined;

  const handleSave = () => {
    if (!name.trim()) { setError("Category name is required."); return; }
    setError("");
    isEdit ? updateMut.mutate() : createMut.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-serif text-xl text-text-primary">
            {isEdit ? `Edit "${state.item.name}"` : "New Category"}
          </h3>
          <button type="button" onClick={onClose}
            className="rounded-full p-1.5 text-text-muted hover:bg-[#f4efe7] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted">
              Category Name *
            </label>
            <input type="text" value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="e.g. Optional Notes, UPSC Prelims…"
              className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm text-text-primary outline-none transition-all focus:border-black/25 focus:bg-white focus:ring-2 focus:ring-[#1d1a17]/8"
            />
          </div>
          <ImageUploadField existingUrl={existingImg} onChange={setImageFile} />
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-full border border-black/10 py-2.5 text-sm text-text-muted transition-all hover:text-text-primary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={!name.trim() || isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#1d1a17] py-2.5 text-sm text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">
            {isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : isEdit ? "Save Changes" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Subcategory modal (create / edit) ─────────────────────────────────────────

type SubModalState =
  | { mode: "create"; categoryId: string; categoryName: string }
  | { mode: "edit";   item: Subcategory };

function SubcategoryModal({ state, onClose }: { state: SubModalState; onClose: () => void }) {
  const qc     = useQueryClient();
  const isEdit = state.mode === "edit";

  const [name,  setName]  = useState(isEdit ? state.item.name : "");
  const [error, setError] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["categories"] });

  const createMut = useMutation({
    mutationFn: () => createSubcategory(
      (state as { mode: "create"; categoryId: string }).categoryId,
      { name: name.trim() },
    ),
    onSuccess:  () => { invalidate(); onClose(); },
    onError:    (e) => setError(errMsg(e, "Failed to create subcategory.")),
  });

  const updateMut = useMutation({
    mutationFn: () => updateSubcategory(
      (state as { mode: "edit"; item: Subcategory }).item.id,
      { name: name.trim() },
    ),
    onSuccess:  () => { invalidate(); onClose(); },
    onError:    (e) => setError(errMsg(e, "Failed to update subcategory.")),
  });

  const isPending = createMut.isPending || updateMut.isPending;
  const title     = isEdit
    ? `Edit "${state.item.name}"`
    : `Add subcategory to "${(state as { categoryName: string }).categoryName}"`;

  const handleSave = () => {
    if (!name.trim()) { setError("Subcategory name is required."); return; }
    setError("");
    isEdit ? updateMut.mutate() : createMut.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg text-text-primary">{title}</h3>
          <button type="button" onClick={onClose}
            className="rounded-full p-1.5 text-text-muted hover:bg-[#f4efe7] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted">
            Subcategory Name *
          </label>
          <input type="text" value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder="e.g. Anthropology, PSIR, Sociology…"
            className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm text-text-primary outline-none transition-all focus:border-black/25 focus:bg-white"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-full border border-black/10 py-2.5 text-sm text-text-muted transition-all hover:text-text-primary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={!name.trim() || isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#1d1a17] py-2.5 text-sm text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">
            {isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : isEdit ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Category Row (expandable) ─────────────────────────────────────────────────

function CategoryRow({
  category,
  onEditCat,
  onDeleteCat,
  onAddSub,
  onEditSub,
  onDeleteSub,
  isDeletingCat,
  deletingSubId,
}: {
  category:     Category;
  onEditCat:    () => void;
  onDeleteCat:  () => void;
  onAddSub:     () => void;
  onEditSub:    (sub: Subcategory) => void;
  onDeleteSub:  (sub: Subcategory) => void;
  isDeletingCat: boolean;
  deletingSubId: string | null;
}) {
  const [open, setOpen] = useState(true);
  const subCount = category.subcategories.length;

  return (
    <div className={`overflow-hidden rounded-2xl border border-black/8 bg-white transition-all ${isDeletingCat ? "opacity-50 scale-[0.98]" : ""}`}>
      {/* Category header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Thumbnail */}
        <div className="shrink-0 h-12 w-12 overflow-hidden rounded-xl bg-[#f4efe7]">
          {category.imageUrl ? (
            <img src={category.imageUrl} alt={category.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon size={18} className="text-[#c9b99a]" />
            </div>
          )}
        </div>

        {/* Name + count */}
        <div className="flex-1 min-w-0">
          <p className="truncate font-semibold text-sm text-text-primary">{category.name}</p>
          <p className="text-xs text-text-muted">{subCount} subcategor{subCount === 1 ? "y" : "ies"}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={onAddSub}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f4efe7] text-text-muted hover:bg-[#ece5d8] hover:text-text-primary transition-all"
            title="Add subcategory">
            <Plus size={13} />
          </button>
          <button type="button" onClick={onEditCat}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f4efe7] text-text-muted hover:bg-[#ece5d8] hover:text-text-primary transition-all"
            title="Edit category">
            <Pencil size={13} />
          </button>
          <button type="button" onClick={onDeleteCat} disabled={isDeletingCat}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f4efe7] text-red-400 hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-40"
            title="Delete category">
            {isDeletingCat ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
          <button type="button" onClick={() => setOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f4efe7] text-text-muted hover:bg-[#ece5d8] transition-all"
            title={open ? "Collapse" : "Expand"}>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>
      </div>

      {/* Subcategory list */}
      {open && (
        <div className="border-t border-black/6 bg-[#faf7f2] px-4 py-2">
          {subCount === 0 ? (
            <p className="py-2 text-xs text-text-muted italic">No subcategories yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 py-1.5">
              {category.subcategories.map((sub) => (
                <div key={sub.id}
                  className={`group flex items-center gap-1 rounded-full border border-black/8 bg-white px-3 py-1 text-xs transition-all hover:border-black/15 hover:shadow-sm ${deletingSubId === sub.id ? "opacity-40" : ""}`}>
                  <Tag size={10} className="text-text-muted shrink-0" />
                  <span className="text-text-primary font-medium">{sub.name}</span>
                  <span className="ml-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => onEditSub(sub)}
                      className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-[#f4efe7] text-text-muted hover:text-text-primary transition-colors">
                      <Pencil size={9} />
                    </button>
                    <button type="button" onClick={() => onDeleteSub(sub)}
                      disabled={deletingSubId === sub.id}
                      className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors disabled:opacity-40">
                      {deletingSubId === sub.id ? <Loader2 size={9} className="animate-spin" /> : <Trash2 size={9} />}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Quick-add button inline */}
          <button type="button" onClick={onAddSub}
            className="mt-1 mb-1 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] text-text-muted hover:text-text-primary hover:bg-[#ece5d8] transition-colors">
            <Plus size={11} /> Add subcategory
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminCategoriesPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn:  getCategories,
  });

  const categories: Category[] = data?.data ?? [];

  const [catModal, setCatModal] = useState<CatModalState | null>(null);
  const [subModal, setSubModal] = useState<SubModalState | null>(null);
  const [error,    setError]    = useState("");

  // ── Delete category ──────────────────────────────────────────────────────────
  const deleteCatMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["categories"] }); setError(""); },
    onError:    (e) => setError(errMsg(e, "Failed to delete category.")),
  });

  const handleDeleteCat = (cat: Category) => {
    if (!confirm(`Delete category "${cat.name}" and all its subcategories?`)) return;
    setError("");
    deleteCatMut.mutate(cat.id);
  };

  // ── Delete subcategory ───────────────────────────────────────────────────────
  const deleteSubMut = useMutation({
    mutationFn: deleteSubcategory,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError:    (e) => setError(errMsg(e, "Failed to delete subcategory.")),
  });

  const handleDeleteSub = (sub: Subcategory) => {
    if (!confirm(`Delete subcategory "${sub.name}"?`)) return;
    deleteSubMut.mutate(sub.id);
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-text-muted">Manage</p>
          <h2 className="mt-0.5 font-serif text-2xl text-text-primary sm:text-3xl">Categories</h2>
          <p className="mt-1 text-sm text-text-muted">
            {categories.length} {categories.length === 1 ? "category" : "categories"} ·{" "}
            {categories.reduce((s, c) => s + c.subcategories.length, 0)} subcategories
          </p>
        </div>
        <button type="button" onClick={() => setCatModal({ mode: "create" })}
          className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-md">
          <Plus size={15} /> New Category
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="ml-3 shrink-0 rounded-full p-1 hover:bg-red-100">
            <X size={13} />
          </button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-black/8 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-[#e8e2d8]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-[#e8e2d8]" />
                  <div className="h-2.5 w-1/5 rounded bg-[#e8e2d8]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-black/10 bg-white px-6 py-20 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f4efe7]">
            <Layers3 size={28} className="text-text-muted" />
          </span>
          <div>
            <p className="font-serif text-xl text-text-primary">No categories yet</p>
            <p className="mt-1 text-sm text-text-muted">Create your first category to organise products.</p>
          </div>
          <button type="button" onClick={() => setCatModal({ mode: "create" })}
            className="mt-1 inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-5 py-2.5 text-sm text-white hover:bg-black">
            <Plus size={14} /> Create Category
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              onEditCat={()  => setCatModal({ mode: "edit", item: cat })}
              onDeleteCat={() => handleDeleteCat(cat)}
              onAddSub={()  => setSubModal({ mode: "create", categoryId: cat.id, categoryName: cat.name })}
              onEditSub={(sub) => setSubModal({ mode: "edit", item: sub })}
              onDeleteSub={(sub) => handleDeleteSub(sub)}
              isDeletingCat={deleteCatMut.isPending && deleteCatMut.variables === cat.id}
              deletingSubId={deleteSubMut.isPending ? (deleteSubMut.variables ?? null) : null}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {catModal && <CategoryModal state={catModal} onClose={() => setCatModal(null)} />}
      {subModal && <SubcategoryModal state={subModal} onClose={() => setSubModal(null)} />}
    </div>
  );
}
