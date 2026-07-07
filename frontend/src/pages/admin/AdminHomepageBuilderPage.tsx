/**
 * AdminHomepageBuilderPage — fully dynamic homepage builder.
 * Supports create / edit / delete / duplicate / reorder sections.
 */
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  BookOpen, ChevronDown, ChevronUp, Copy, GripVertical,
  Image, LayoutDashboard, LayoutGrid, Layers3, Library,
  Loader2, Plus, Printer, RotateCcw, Save, Trash2, X, Check,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminGetAllSections, adminCreateSection, adminUpdateSection,
  adminDeleteSection, adminDuplicateSection, adminReorderSections,
  type HomepageSection, type SectionType, type LayoutType, type BookFilterType,
  type CategoryDisplayMode, type CreateSectionPayload,
} from "../../api/homepage-sections.api";
import { getCategories } from "../../api/categories.api";
import type { Category } from "../../api/categories.api";
import FeaturedProductsPicker from "../../components/admin/FeaturedProductsPicker";

// ─── Metadata ────────────────────────────────────────────────────────────────

const TYPE_META: Record<SectionType, { label: string; icon: React.ElementType; color: string }> = {
  books:      { label: "Book Section",        icon: BookOpen,      color: "bg-blue-50 text-blue-600" },
  banner:     { label: "Banner Slider",       icon: Image,         color: "bg-purple-50 text-purple-600" },
  categories: { label: "Browse by Category",  icon: Layers3,       color: "bg-orange-50 text-orange-600" },
  printCta:   { label: "Print CTA",           icon: Printer,       color: "bg-green-50 text-green-600" },
  allBooks:   { label: "All Books Grid",      icon: Library,       color: "bg-gray-50 text-gray-600" },
};

const LAYOUT_OPTIONS: { value: LayoutType; label: string; icon: React.ElementType }[] = [
  { value: "horizontal", label: "Horizontal Scroll", icon: LayoutDashboard },
  { value: "carousel",   label: "Carousel",          icon: LayoutDashboard },
  { value: "grid",       label: "Grid",              icon: LayoutGrid },
];

const FILTER_OPTIONS: { value: BookFilterType; label: string; desc: string }[] = [
  { value: "newArrivals",  label: "New Arrivals",  desc: "Recently added books" },
  { value: "bestSellers",  label: "Best Sellers",  desc: "Featured / popular books" },
  { value: "featured",     label: "Featured",      desc: "Manually featured books" },
  { value: "all",          label: "All Books",     desc: "All books from category" },
];

const DISPLAY_MODE_OPTIONS: { value: CategoryDisplayMode; label: string; desc: string }[] = [
  { value: "auto",          label: "Auto (Recommended)", desc: "Subcategories if available, else the category" },
  { value: "categories",    label: "Show Categories",    desc: "Always show the category itself" },
  { value: "subcategories", label: "Show Subcategories", desc: "Show this category's subcategories" },
];

const FIXED_TYPES: SectionType[] = ["banner", "printCta", "allBooks"];

const EMPTY_SECTION: CreateSectionPayload = {
  title: "", subtitle: "", description: "",
  type: "books", layoutType: "horizontal", bookFilter: "newArrivals",
  categoryId: null, subcategoryId: null,
  isEnabled: true, order: 0,
  config: { limit: 8 },
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function LimitSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-text-muted">
        <span className="font-semibold uppercase tracking-wide">Books to show</span>
        <span className="font-semibold text-text-primary">{value}</span>
      </div>
      <input type="range" min={2} max={24} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-[#1d1a17]" />
      <div className="flex justify-between text-[10px] text-text-muted"><span>2</span><span>24</span></div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{children}</p>;
}

// ─── Section Create / Edit Modal ──────────────────────────────────────────────

interface SectionModalProps {
  initial: HomepageSection | null;        // null = create mode
  categories: Category[];
  onSave: (data: CreateSectionPayload) => void;
  onClose: () => void;
  isSaving: boolean;
  error?: string;
}

function SectionModal({ initial, categories, onSave, onClose, isSaving, error }: SectionModalProps) {
  const isNew = initial === null;
  const [form, setForm] = useState<CreateSectionPayload>(() => {
    if (!initial) return { ...EMPTY_SECTION };
    const next: CreateSectionPayload = {
      title: initial.title, subtitle: initial.subtitle ?? "", description: initial.description ?? "",
      type: initial.type, layoutType: initial.layoutType, bookFilter: initial.bookFilter,
      categoryId: initial.categoryId ?? null, subcategoryId: initial.subcategoryId ?? null,
      isEnabled: initial.isEnabled, order: initial.order, config: { ...initial.config },
    };
    // Migrate a legacy single categoryId on "categories" sections into the
    // multi-select picker so it shows up checked, then drop the old field.
    if (next.type === "categories" && !next.config.selectedCategoryIds?.length && next.categoryId) {
      next.config     = { ...next.config, selectedCategoryIds: [next.categoryId] };
      next.categoryId = null;
    }
    return next;
  });

  const set = <K extends keyof CreateSectionPayload>(k: K, v: CreateSectionPayload[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const selectedCat = categories.find(c => c.id === form.categoryId);
  const subcats = selectedCat?.subcategories ?? [];

  const overlayRef = useRef<HTMLDivElement>(null);

  const isBooks = form.type === "books";
  const isCats  = form.type === "categories";

  return (
    <div ref={overlayRef} onClick={e => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
          <h2 className="font-serif text-lg text-text-primary">
            {isNew ? "Add New Section" : "Edit Section"}
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-text-muted hover:bg-[#f4efe7]">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-5">

          {/* Section Type */}
          <div>
            <FieldLabel>Section Type</FieldLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.entries(TYPE_META) as [SectionType, typeof TYPE_META[SectionType]][]).map(([type, meta]) => {
                const Icon = meta.icon;
                const sel  = form.type === type;
                return (
                  <button key={type} type="button" onClick={() => set("type", type)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all
                      ${sel ? "border-[#1d1a17] bg-[#1d1a17] text-white" : "border-black/10 bg-[#f8f4ee] text-text-primary hover:border-black/30"}`}>
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate text-xs">{meta.label}</span>
                    {sel && <Check size={10} className="ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <FieldLabel>Section Title *</FieldLabel>
            <input value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="e.g. New Arrivals, Best Sellers, Science Books…"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/8" />
          </div>

          {/* Subtitle */}
          <div>
            <FieldLabel>Subtitle <span className="normal-case font-normal">(optional)</span></FieldLabel>
            <input value={form.subtitle ?? ""} onChange={e => set("subtitle", e.target.value)}
              placeholder="e.g. Hand-picked for you"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/8" />
          </div>

          {/* ── Books-specific fields ── */}
          {isBooks && (
            <>
              {/* Layout type */}
              <div>
                <FieldLabel>Layout</FieldLabel>
                <div className="flex gap-2">
                  {LAYOUT_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => set("layoutType", opt.value)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-all
                        ${form.layoutType === opt.value ? "border-[#1d1a17] bg-[#1d1a17] text-white" : "border-black/10 bg-[#f8f4ee] text-text-primary hover:border-black/30"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Book filter */}
              <div>
                <FieldLabel>Books to Display</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {FILTER_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => set("bookFilter", opt.value)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-all
                        ${form.bookFilter === opt.value ? "border-[#1d1a17] bg-[#1d1a17] text-white" : "border-black/10 bg-[#f8f4ee] text-text-primary hover:border-black/30"}`}>
                      <p className={`text-sm font-medium ${form.bookFilter === opt.value ? "text-white" : "text-text-primary"}`}>{opt.label}</p>
                      <p className={`mt-0.5 text-[10px] ${form.bookFilter === opt.value ? "text-white/70" : "text-text-muted"}`}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Featured picker */}
              {form.bookFilter === "featured" && (
                <div className="rounded-2xl border border-black/8 bg-[#f8f4ee] p-3">
                  <FeaturedProductsPicker
                    selectedProductIds={form.config.selectedProductIds ?? []}
                    useManual={form.config.useManual ?? false}
                    limit={form.config.limit ?? 4}
                    onChangeSelectedIds={ids => set("config", { ...form.config, selectedProductIds: ids })}
                    onToggleManual={() => set("config", { ...form.config, useManual: !form.config.useManual })}
                    onChangeLimit={v => set("config", { ...form.config, limit: v })}
                  />
                </div>
              )}

              {/* Category */}
              {form.bookFilter !== "featured" && (
                <>
                  <div>
                    <FieldLabel>Category Filter <span className="normal-case font-normal">(optional)</span></FieldLabel>
                    <select value={form.categoryId ?? ""}
                      onChange={e => { set("categoryId", e.target.value || null); set("subcategoryId", null); }}
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/30">
                      <option value="">All Categories</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* Subcategory */}
                  {form.categoryId && subcats.length > 0 && (
                    <div>
                      <FieldLabel>Subcategory Filter <span className="normal-case font-normal">(optional)</span></FieldLabel>
                      <select value={form.subcategoryId ?? ""}
                        onChange={e => set("subcategoryId", e.target.value || null)}
                        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/30">
                        <option value="">All Subcategories</option>
                        {subcats.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}

                  <LimitSlider value={form.config.limit ?? 8}
                    onChange={v => set("config", { ...form.config, limit: v })} />
                </>
              )}
            </>
          )}

          {/* ── Categories-section fields ── */}
          {isCats && (
            <>
              <div>
                <FieldLabel>Categories <span className="normal-case font-normal">(leave empty to browse all categories)</span></FieldLabel>
                <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-xl border border-black/10 bg-white p-2">
                  {categories.map(c => {
                    const ids     = form.config.selectedCategoryIds ?? [];
                    const checked = ids.includes(c.id);
                    return (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[#f8f4ee]">
                        <input type="checkbox" checked={checked}
                          onChange={() => {
                            const next = checked ? ids.filter(id => id !== c.id) : [...ids, c.id];
                            set("config", { ...form.config, selectedCategoryIds: next });
                          }}
                          className="h-4 w-4 rounded border-black/20 accent-[#1d1a17]" />
                        <span className="text-text-primary">{c.name}</span>
                        {c.subcategories.length > 0 && (
                          <span className="ml-auto shrink-0 text-[10px] text-text-muted">{c.subcategories.length} subcategories</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {(form.config.selectedCategoryIds?.length ?? 0) > 0 && (
                <div>
                  <FieldLabel>Display Type</FieldLabel>
                  <div className="space-y-1.5">
                    {DISPLAY_MODE_OPTIONS.map(opt => {
                      const active = (form.config.displayMode ?? "auto") === opt.value;
                      return (
                        <button key={opt.value} type="button" onClick={() => set("config", { ...form.config, displayMode: opt.value })}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition-all
                            ${active ? "border-[#1d1a17] bg-[#1d1a17] text-white" : "border-black/10 bg-[#f8f4ee] text-text-primary hover:border-black/30"}`}>
                          <p className={`text-sm font-medium ${active ? "text-white" : "text-text-primary"}`}>{opt.label}</p>
                          <p className={`mt-0.5 text-[10px] ${active ? "text-white/70" : "text-text-muted"}`}>{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <FieldLabel>Max items to show</FieldLabel>
                <input type="number" min={2} max={20} value={form.config.limit ?? 8}
                  onChange={e => set("config", { ...form.config, limit: Number(e.target.value) })}
                  className="w-24 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30" />
              </div>
            </>
          )}

          {/* Status */}
          <div className="flex items-center gap-3 rounded-xl border border-black/8 px-4 py-3">
            <button type="button" onClick={() => set("isEnabled", !form.isEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${form.isEnabled ? "bg-[#1d1a17]" : "bg-black/20"}`}>
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.isEnabled ? "translate-x-5" : ""}`} />
            </button>
            <div>
              <p className="text-sm font-medium text-text-primary">
                {form.isEnabled ? "Active" : "Inactive"}
              </p>
              <p className="text-xs text-text-muted">
                {form.isEnabled ? "Visible on homepage" : "Hidden from homepage"}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-black/8 px-5 py-4 space-y-3">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose}
              className="rounded-full border border-black/10 px-4 py-2 text-sm text-text-muted hover:bg-[#f4efe7]">
              Cancel
            </button>
            <button onClick={() => onSave(form)} disabled={!form.title.trim() || isSaving}
              className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-5 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed">
              {isSaving && <Loader2 size={13} className="animate-spin" />}
              {isNew ? "Create Section" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  section: HomepageSection;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isFixed: boolean;
  categories: Category[];
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SectionCard({ section, index, isFirst, isLast, isFixed, onEdit, onDelete, onDuplicate, onToggle, onMoveUp, onMoveDown }: SectionCardProps) {
  const meta = TYPE_META[section.type];
  const Icon = meta.icon;
  const [confirmDel, setConfirmDel] = useState(false);


  return (
    <Draggable draggableId={section.id} index={index}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.draggableProps}
          className={`rounded-2xl border bg-white transition-all select-none
            ${snapshot.isDragging ? "border-[#1d1a17] shadow-xl ring-2 ring-[#1d1a17]/20 rotate-[0.5deg]" : "border-black/10 hover:border-black/20 hover:shadow-sm"}
            ${!section.isEnabled ? "opacity-55" : ""}`}>

          <div className="flex items-center gap-3 px-4 py-3.5">
            {/* Drag handle */}
            <span {...provided.dragHandleProps}
              className="cursor-grab touch-none text-text-muted/40 hover:text-text-muted active:cursor-grabbing shrink-0">
              <GripVertical size={18} />
            </span>

            {/* Icon */}
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.color}`}>
              <Icon size={16} />
            </span>

            {/* Info */}
            <div className="min-w-0 flex-1 cursor-pointer" onClick={onEdit}>
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-medium text-text-primary truncate">{section.title}</p>
                {!section.isEnabled && (
                  <span className="rounded-full bg-black/8 px-2 py-0.5 text-[10px] text-text-muted">Hidden</span>
                )}
                {isFixed && (
                  <span className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] text-text-muted">Fixed</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-text-muted">{meta.label}</p>
                {section.type === "books" && (
                  <>
                    <span className="text-text-muted/40">·</span>
                    <span className="text-xs text-text-muted capitalize">{section.bookFilter}</span>
                    <span className="text-text-muted/40">·</span>
                    <span className="text-xs text-text-muted capitalize">{section.layoutType}</span>
                  </>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={onMoveUp} disabled={isFirst}
                className="rounded-lg p-1.5 text-text-muted hover:bg-[#f4efe7] disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronUp size={14} />
              </button>
              <button onClick={onMoveDown} disabled={isLast}
                className="rounded-lg p-1.5 text-text-muted hover:bg-[#f4efe7] disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronDown size={14} />
              </button>
              <button onClick={onDuplicate} title="Duplicate"
                className="rounded-lg p-1.5 text-text-muted hover:bg-[#f4efe7]">
                <Copy size={14} />
              </button>
              {!isFixed && (
                confirmDel ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => { onDelete(); setConfirmDel(false); }}
                      className="rounded-lg px-2 py-1 text-xs font-medium bg-red-500 text-white hover:bg-red-600">
                      Delete
                    </button>
                    <button onClick={() => setConfirmDel(false)}
                      className="rounded-lg px-2 py-1 text-xs text-text-muted hover:bg-[#f4efe7]">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDel(true)} title="Delete"
                    className="rounded-lg p-1.5 text-text-muted hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                )
              )}
              {/* Show/hide toggle */}
              <button onClick={onToggle}
                className={`relative ml-1 h-6 w-11 rounded-full transition-colors ${section.isEnabled ? "bg-[#1d1a17]" : "bg-black/20"}`}>
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${section.isEnabled ? "translate-x-5" : ""}`} />
              </button>
            </div>
          </div>

          {/* Subtitle strip */}
          {section.subtitle && (
            <p className="px-16 pb-2.5 text-xs text-text-muted">{section.subtitle}</p>
          )}
        </div>
      )}
    </Draggable>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminHomepageBuilderPage() {
  const qc = useQueryClient();
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [modalSection, setModalSection] = useState<HomepageSection | "new" | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [modalError, setModalError] = useState("");
  const [reorderError, setReorderError] = useState("");

  // Queries
  const { data: rawSections = [], isLoading } = useQuery({
    queryKey: ["homepage-sections-admin"],
    queryFn:  adminGetAllSections,
  });
  const { data: categoriesData } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const categories: Category[] = categoriesData?.data ?? [];

  useEffect(() => {
    if (rawSections.length) {
      setSections([...rawSections].sort((a, b) => a.order - b.order));
      setIsDirty(false);
    }
  }, [rawSections]);

  // Mutations
  const createMut = useMutation({
    mutationFn: adminCreateSection,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["homepage-sections-admin"] }); setModalSection(null); setModalError(""); },
    onError: (e: any) => setModalError(e?.response?.data?.message ?? "Create failed"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminUpdateSection(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["homepage-sections-admin"] }); setModalSection(null); setModalError(""); },
    onError: (e: any) => setModalError(e?.response?.data?.message ?? "Update failed"),
  });

  const deleteMut = useMutation({
    mutationFn: adminDeleteSection,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["homepage-sections-admin"] }),
  });

  const dupMut = useMutation({
    mutationFn: adminDuplicateSection,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["homepage-sections-admin"] }),
  });

  const reorderMut = useMutation({
    mutationFn: adminReorderSections,
    onSuccess: (updated) => {
      setSections([...updated].sort((a, b) => a.order - b.order));
      setIsDirty(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
      qc.invalidateQueries({ queryKey: ["homepage-sections-admin"] });
    },
    onError: (e: any) => setReorderError(e?.response?.data?.message ?? "Reorder failed"),
  });

  // Drag end
  const handleDragEnd = (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    const next = Array.from(sections);
    const [moved] = next.splice(r.source.index, 1);
    next.splice(r.destination.index, 0, moved);
    setSections(next.map((s, i) => ({ ...s, order: i + 1 })));
    setIsDirty(true);
  };

  // Move by button
  const move = (id: string, dir: "up" | "down") => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === id);
      const swap = dir === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
    setIsDirty(true);
  };

  // Toggle enable inline
  const toggle = (id: string) => {
    updateMut.mutate({ id, data: { isEnabled: !sections.find(s => s.id === id)?.isEnabled } });
  };

  // Save reorder
  const saveOrder = () => {
    reorderMut.mutate(sections.map(s => s.id));
  };

  // Reset
  const reset = () => {
    setSections([...rawSections].sort((a, b) => a.order - b.order));
    setIsDirty(false);
  };

  // Modal save
  const handleModalSave = (data: CreateSectionPayload) => {
    if (modalSection === "new") {
      createMut.mutate(data);
    } else if (modalSection) {
      updateMut.mutate({ id: modalSection.id, data });
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  const visibleCount = sections.filter(s => s.isEnabled).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">

      {/* ── Reorder error ── */}
      {reorderError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600 flex items-center justify-between gap-3">
          <span>{reorderError}</span>
          <button onClick={() => setReorderError("")} className="shrink-0 text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-text-muted">
            Drag <GripVertical size={11} className="inline align-middle" /> to reorder ·
            toggle to show/hide · click row to edit · <Copy size={11} className="inline align-middle" /> to duplicate
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 py-2 text-sm text-text-muted hover:bg-[#f4efe7]">
              <RotateCcw size={13} /> Reset
            </button>
          )}
          {isDirty && (
            <button onClick={saveOrder} disabled={reorderMut.isPending}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all disabled:opacity-50
                ${saveOk ? "bg-emerald-600 text-white" : "bg-[#1d1a17] text-white hover:bg-black"}`}>
              {saveOk ? <><Check size={13} /> Saved!</> : reorderMut.isPending ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save Order</>}
            </button>
          )}
          <button onClick={() => setModalSection("new")}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1a17] px-4 py-2 text-sm font-medium text-white hover:bg-black">
            <Plus size={14} /> Add Section
          </button>
        </div>
      </div>

      {/* ── Section count ── */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Sections ({visibleCount} of {sections.length} visible)
        </p>
        <p className="text-xs text-text-muted">Drag <GripVertical size={11} className="inline align-middle" /> to reorder</p>
      </div>

      {/* ── Drag & drop list ── */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="sections">
          {(provided, snapshot) => (
            <div ref={provided.innerRef} {...provided.droppableProps}
              className={`space-y-2 rounded-2xl transition-colors ${snapshot.isDraggingOver ? "bg-[#f4efe7]/50 p-2" : ""}`}>
              {sections.map((section, idx) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  index={idx}
                  isFirst={idx === 0}
                  isLast={idx === sections.length - 1}
                  isFixed={FIXED_TYPES.includes(section.type)}
                  categories={categories}
                  onEdit={() => setModalSection(section)}
                  onDelete={() => deleteMut.mutate(section.id)}
                  onDuplicate={() => dupMut.mutate(section.id)}
                  onToggle={() => toggle(section.id)}
                  onMoveUp={() => move(section.id, "up")}
                  onMoveDown={() => move(section.id, "down")}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Empty state */}
      {sections.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-black/10 py-12 text-center">
          <LayoutDashboard size={32} className="mx-auto mb-3 text-text-muted/50" />
          <p className="font-medium text-text-primary">No sections yet</p>
          <p className="mt-1 text-sm text-text-muted">Click "Add Section" to build your homepage</p>
          <button onClick={() => setModalSection("new")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#1d1a17] px-4 py-2 text-sm font-medium text-white hover:bg-black">
            <Plus size={14} /> Add First Section
          </button>
        </div>
      )}

      {/* ── Render order strip ── */}
      {sections.length > 0 && (
        <div className="rounded-2xl border border-black/8 bg-white px-5 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Current render order</p>
          <div className="flex flex-wrap gap-2">
            {sections.map((s, i) => (
              <span key={s.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${s.isEnabled ? "bg-[#1d1a17] text-white" : "bg-black/8 text-text-muted line-through"}`}>
                <span className="opacity-60">{i + 1}.</span>{s.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Live preview ── */}
      <div className="rounded-2xl border border-dashed border-black/10 bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <LayoutDashboard size={18} className="shrink-0 text-text-muted" />
          <div>
            <p className="text-sm font-medium text-text-primary">Live Preview</p>
            <p className="mt-0.5 text-xs text-text-muted">
              After saving,{" "}
              <a href="/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-text-primary">
                open the homepage
              </a>{" "}
              to see your changes.
            </p>
          </div>
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      {modalSection !== null && (
        <SectionModal
          initial={modalSection === "new" ? null : modalSection}
          categories={categories}
          onSave={handleModalSave}
          onClose={() => { setModalSection(null); setModalError(""); }}
          isSaving={createMut.isPending || updateMut.isPending}
          error={modalError}
        />
      )}
    </div>
  );
}
