/**
 * AdminHomepageBuilderPage — drag-and-drop homepage section builder
 * with inline expandable config panels (category + subcategory picker).
 */

import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";

import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Image,
  LayoutDashboard,
  Layers3,
  Library,
  Printer,
  RotateCcw,
  Save,
  Star,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getHomepageConfig,
  updateHomepageConfig,
} from "../../api/homepage.api";
import type {
  HomepageSection,
  SectionConfig,
  SectionType,
} from "../../api/homepage.api";
import { getCategories } from "../../api/categories.api";
import type { Category, Subcategory } from "../../api/categories.api";
import FeaturedProductsPicker from "../../components/admin/FeaturedProductsPicker";

// ─── Section metadata ─────────────────────────────────────────────────────────

interface SectionMeta {
  label: string;
  description: string;
  icon: React.ElementType;
  configurable: boolean;
}

const SECTION_META: Record<SectionType, SectionMeta> = {
  banner: {
    label: "Banner Slider",
    description: "Rotating image banners at the top of the page",
    icon: Image,
    configurable: false,
  },
  categories: {
    label: "Browse by Category",
    description: "Category cards for quick catalogue filtering",
    icon: Layers3,
    configurable: true,
  },
  newArrivals: {
    label: "New Arrivals",
    description: "Recently added books from a chosen category / subcategory",
    icon: BookOpen,
    configurable: true,
  },
  featuredProducts: {
    label: "Featured Books",
    description: "Curated or auto-selected highlight books",
    icon: Star,
    configurable: true,
  },
  printSection: {
    label: "Print CTA",
    description: "Call-to-action banner for the print service",
    icon: Printer,
    configurable: false,
  },
  allBooks: {
    label: "All Books Grid",
    description: "Full catalogue with search & price filters",
    icon: Library,
    configurable: false,
  },
};

// ─── Limit slider ─────────────────────────────────────────────────────────────

function LimitInput({
  value,
  onChange,
  label,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </p>
        <span className="text-sm font-semibold text-text-primary">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6ddd0] accent-[#1d1a17]"
      />
      <div className="flex justify-between text-[10px] text-text-muted">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          value ? "bg-[#1d1a17]" : "bg-black/20"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-5" : ""
          }`}
        />
      </button>
      <span className="text-sm font-medium text-text-primary">{label}</span>
    </label>
  );
}

// ─── Category chip grid ───────────────────────────────────────────────────────

function CategoryChips({
  categories,
  selectedIds,
  onToggle,
}: {
  categories: Category[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  if (!categories.length)
    return <p className="text-xs text-text-muted">No categories found.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {categories.map((cat) => {
        const sel = selectedIds.includes(cat.id);
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onToggle(cat.id)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
              sel
                ? "border-[#1d1a17] bg-[#1d1a17] text-white"
                : "border-black/10 bg-[#f8f4ee] text-text-primary hover:border-black/30"
            }`}
          >
            {cat.imageUrl && (
              <img
                src={cat.imageUrl}
                alt=""
                className="h-6 w-6 rounded-md object-cover shrink-0"
              />
            )}
            <span className="truncate leading-tight">{cat.name}</span>
            {sel && <Check size={12} className="ml-auto shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Subcategory chip grid ────────────────────────────────────────────────────

function SubcategoryChips({
  subcategories,
  selectedIds,
  onToggle,
}: {
  subcategories: Subcategory[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  if (!subcategories.length)
    return (
      <p className="text-xs italic text-text-muted">
        No subcategories for this category.
      </p>
    );
  return (
    <div className="flex flex-wrap gap-2">
      {subcategories.map((sub) => {
        const sel = selectedIds.includes(sub.id);
        return (
          <button
            key={sub.id}
            type="button"
            onClick={() => onToggle(sub.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              sel
                ? "border-[#1d1a17] bg-[#1d1a17] text-white"
                : "border-black/10 bg-white text-text-primary hover:border-black/30"
            }`}
          >
            {sub.name}
            {sel && <Check size={10} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Inline config panel ──────────────────────────────────────────────────────

interface InlineConfigProps {
  section: HomepageSection;
  categories: Category[];
  onChange: (config: SectionConfig) => void;
}

function InlineConfig({ section, categories, onChange }: InlineConfigProps) {
  const cfg = section.config;

  const setField = <K extends keyof SectionConfig>(key: K, val: SectionConfig[K]) =>
    onChange({ ...cfg, [key]: val });

  const toggleCategoryId = (id: string) => {
    const prev = cfg.selectedCategoryIds ?? [];
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    onChange({ ...cfg, selectedCategoryIds: next });
  };

  const toggleSubcategoryId = (id: string) => {
    const prev = cfg.selectedSubcategoryIds ?? [];
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    onChange({ ...cfg, selectedSubcategoryIds: next });
  };

  // Subcategories of the selected category (for newArrivals)
  const selectedCat = categories.find((c) => c.id === (cfg.categoryId ?? ""));
  const availableSubcategories: Subcategory[] = selectedCat?.subcategories ?? [];

  // ── categories section ────────────────────────────────────────────────────
  if (section.type === "categories") {
    return (
      <div className="space-y-5 pt-4 border-t border-black/8">
        <Toggle
          value={cfg.showAll ?? true}
          onChange={(v) => setField("showAll", v)}
          label="Show all categories"
        />

        {!(cfg.showAll ?? true) && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Select categories to display
            </p>
            <CategoryChips
              categories={categories}
              selectedIds={cfg.selectedCategoryIds ?? []}
              onToggle={toggleCategoryId}
            />
          </div>
        )}

        <LimitInput
          value={cfg.limit ?? 8}
          onChange={(v) => setField("limit", v)}
          label="Max categories to show"
          min={2}
          max={20}
        />
      </div>
    );
  }

  // ── newArrivals section ───────────────────────────────────────────────────
  if (section.type === "newArrivals") {
    return (
      <div className="space-y-5 pt-4 border-t border-black/8">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Section Title
          </label>
          <input
            type="text"
            value={cfg.title ?? ""}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="e.g. New Arrivals, Best Sellers…"
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:border-black/30 focus:ring-2 focus:ring-black/8"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Filter by Category
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onChange({ ...cfg, categoryId: "", selectedSubcategoryIds: [] })}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                !cfg.categoryId
                  ? "border-[#1d1a17] bg-[#1d1a17] text-white"
                  : "border-black/10 bg-[#f8f4ee] text-text-primary hover:border-black/30"
              }`}
            >
              {!cfg.categoryId && <Check size={12} />}
              All Categories
            </button>
            {categories.map((cat) => {
              const sel = cfg.categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    onChange({ ...cfg, categoryId: cat.id, selectedSubcategoryIds: [] })
                  }
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                    sel
                      ? "border-[#1d1a17] bg-[#1d1a17] text-white"
                      : "border-black/10 bg-[#f8f4ee] text-text-primary hover:border-black/30"
                  }`}
                >
                  {cat.imageUrl && (
                    <img
                      src={cat.imageUrl}
                      alt=""
                      className="h-5 w-5 rounded object-cover shrink-0"
                    />
                  )}
                  <span className="truncate">{cat.name}</span>
                  {sel && <Check size={12} className="ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subcategory — only when category is selected */}
        {cfg.categoryId && (
          <div className="space-y-2 rounded-2xl border border-black/8 bg-[#f8f4ee] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Filter by Subcategory{" "}
              <span className="font-normal normal-case text-text-muted/70">
                (optional — leave empty to show all from category)
              </span>
            </p>
            <SubcategoryChips
              subcategories={availableSubcategories}
              selectedIds={cfg.selectedSubcategoryIds ?? []}
              onToggle={toggleSubcategoryId}
            />
            {(cfg.selectedSubcategoryIds ?? []).length > 0 && (
              <button
                type="button"
                onClick={() => setField("selectedSubcategoryIds", [])}
                className="mt-1 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
              >
                <X size={10} /> Clear subcategory filter
              </button>
            )}
          </div>
        )}

        <LimitInput
          value={cfg.limit ?? 6}
          onChange={(v) => setField("limit", v)}
          label="Books to show"
          min={2}
          max={24}
        />
      </div>
    );
  }

  // ── featuredProducts section ──────────────────────────────────────────────
  if (section.type === "featuredProducts") {
    return (
      <div className="pt-4 border-t border-black/8">
        <FeaturedProductsPicker
          selectedProductIds={cfg.selectedProductIds ?? []}
          useManual={cfg.useManual ?? false}
          limit={cfg.limit ?? 4}
          onChangeSelectedIds={(ids) => setField("selectedProductIds", ids)}
          onToggleManual={() => setField("useManual", !(cfg.useManual ?? false))}
          onChangeLimit={(v) => setField("limit", v)}
        />
      </div>
    );
  }

  return null;
}

// ─── Draggable section card ───────────────────────────────────────────────────

interface SectionCardProps {
  section: HomepageSection;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  categories: Category[];
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onConfigChange: (config: SectionConfig) => void;
}

function SectionCard({
  section,
  index,
  isFirst,
  isLast,
  isExpanded,
  categories,
  onToggleExpand,
  onToggleEnabled,
  onMoveUp,
  onMoveDown,
  onConfigChange,
}: SectionCardProps) {
  const meta = SECTION_META[section.type];
  const Icon = meta.icon;

  return (
    <Draggable draggableId={section.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`rounded-2xl border bg-white transition-all select-none
            ${
              snapshot.isDragging
                ? "border-[#1d1a17] shadow-lg ring-2 ring-[#1d1a17]/20 rotate-[0.5deg] scale-[1.01]"
                : isExpanded
                ? "border-[#1d1a17]/30 shadow-md"
                : "border-black/10 hover:border-black/20 hover:shadow-sm"
            }
            ${!section.enabled ? "opacity-60" : ""}`}
        >
          {/* ── Header row ── */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            {/* Drag handle */}
            <span
              {...provided.dragHandleProps}
              className="cursor-grab touch-none text-text-muted/40 hover:text-text-muted active:cursor-grabbing shrink-0"
              title="Drag to reorder"
            >
              <GripVertical size={18} />
            </span>

            {/* Section icon */}
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                section.enabled ? "bg-[#f4efe7]" : "bg-black/5"
              }`}
            >
              <Icon
                size={16}
                className={section.enabled ? "text-[#1d1a17]" : "text-text-muted"}
              />
            </span>

            {/* Label — clicking expands if configurable */}
            <button
              type="button"
              onClick={meta.configurable ? onToggleExpand : undefined}
              className={`min-w-0 flex-1 text-left ${
                meta.configurable ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-text-primary">
                  {meta.label}
                </p>
                {!section.enabled && (
                  <span className="shrink-0 rounded-full bg-black/8 px-2 py-0.5 text-[10px] text-text-muted">
                    Hidden
                  </span>
                )}
                {isExpanded && (
                  <span className="shrink-0 rounded-full bg-[#1d1a17]/8 px-2 py-0.5 text-[10px] font-medium text-[#1d1a17]">
                    Editing
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-text-muted">
                {meta.description}
              </p>
            </button>

            {/* Action buttons */}
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={isFirst}
                className="rounded-lg p-1.5 text-text-muted transition-all hover:bg-[#f4efe7] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={isLast}
                className="rounded-lg p-1.5 text-text-muted transition-all hover:bg-[#f4efe7] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronDown size={14} />
              </button>

              {/* Expand/collapse toggle for configurable sections */}
              {meta.configurable && (
                <button
                  type="button"
                  onClick={onToggleExpand}
                  title={isExpanded ? "Collapse" : "Configure section"}
                  className={`rounded-lg p-1.5 transition-all ${
                    isExpanded
                      ? "bg-[#1d1a17] text-white"
                      : "text-text-muted hover:bg-[#f4efe7]"
                  }`}
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>
              )}

              {/* Show/hide toggle */}
              <button
                type="button"
                onClick={onToggleEnabled}
                className={`relative ml-1 h-6 w-11 rounded-full transition-colors ${
                  section.enabled ? "bg-[#1d1a17]" : "bg-black/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    section.enabled ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ── Expanded inline config ── */}
          {isExpanded && meta.configurable && (
            <div className="px-4 pb-5">
              <InlineConfig
                section={section}
                categories={categories}
                onChange={onConfigChange}
              />
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminHomepageBuilderPage() {
  const queryClient = useQueryClient();
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Fetch config ──────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ["homepage-config"],
    queryFn: getHomepageConfig,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const categories: Category[] = categoriesData?.data ?? [];

  useEffect(() => {
    if (data) {
      setSections([...data.sections].sort((a, b) => a.order - b.order));
      setIsDirty(false);
    }
  }, [data]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (secs: HomepageSection[]) => updateHomepageConfig(secs),
    onSuccess: (updated) => {
      setSections([...updated.sections].sort((a, b) => a.order - b.order));
      setIsDirty(false);
      setSaveSuccess(true);
      void queryClient.invalidateQueries({ queryKey: ["homepage-config"] });
      setTimeout(() => setSaveSuccess(false), 2500);
    },
    onError: (err: any) => {
      alert(`Save failed: ${err?.response?.data?.message ?? err?.message ?? "Unknown error"}`);
    },
  });

  // ── Drag end ──────────────────────────────────────────────────────────────

  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;
    if (!destination || destination.index === source.index) return;
    const reordered = Array.from(sections);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);
    setSections(reordered.map((s, i) => ({ ...s, order: i + 1 })));
    setIsDirty(true);
  };

  // ── Move ──────────────────────────────────────────────────────────────────

  const moveSection = (id: string, dir: "up" | "down") => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
    setIsDirty(true);
  };

  // ── Toggle visibility ─────────────────────────────────────────────────────

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
    setIsDirty(true);
  };

  // ── Config change (inline) ────────────────────────────────────────────────

  const updateConfig = (id: string, config: SectionConfig) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              config,
              title: config.title?.trim() || s.title,
              categoryId: config.categoryId || undefined,
            }
          : s,
      ),
    );
    setIsDirty(true);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetToSaved = () => {
    if (data) {
      setSections([...data.sections].sort((a, b) => a.order - b.order));
      setIsDirty(false);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = () => {
    saveMutation.mutate(sections.map((s, i) => ({ ...s, order: i + 1 })));
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  const visibleCount = sections.filter((s) => s.enabled).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ── Toolbar ── */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-text-muted">
          Drag{" "}
          <GripVertical size={12} className="inline-block align-middle" />{" "}
          to reorder · toggle to show/hide · click{" "}
          <ChevronDown size={12} className="inline-block align-middle" />{" "}
          to configure a section.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={resetToSaved}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 py-2 text-sm text-text-muted hover:bg-[#f4efe7]"
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending || !isDirty}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50
              ${saveSuccess ? "bg-emerald-600 text-white" : "bg-[#1d1a17] text-white hover:bg-black"}`}
          >
            {saveSuccess ? (
              <><Check size={13} /> Saved!</>
            ) : saveMutation.isPending ? (
              <><Save size={13} /> Saving…</>
            ) : (
              <><Save size={13} /> Save Layout</>
            )}
          </button>
        </div>
      </div>

      {/* ── Unsaved banner ── */}
      {isDirty && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You have unsaved changes.{" "}
          <strong>Click Save Layout</strong> to publish to the homepage.
        </div>
      )}

      {/* ── Section list ── */}
      <div className="space-y-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Sections ({visibleCount} of {sections.length} visible)
          </p>
          <p className="text-xs text-text-muted">
            Drag <GripVertical size={11} className="inline align-middle" /> to reorder
          </p>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="homepage-sections">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`space-y-2 rounded-2xl transition-colors ${
                  snapshot.isDraggingOver ? "bg-[#f4efe7]/60 p-2" : ""
                }`}
              >
                {sections.map((section, index) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === sections.length - 1}
                    isExpanded={expandedId === section.id}
                    categories={categories}
                    onToggleExpand={() =>
                      setExpandedId(expandedId === section.id ? null : section.id)
                    }
                    onToggleEnabled={() => toggleSection(section.id)}
                    onMoveUp={() => moveSection(section.id, "up")}
                    onMoveDown={() => moveSection(section.id, "down")}
                    onConfigChange={(config) => updateConfig(section.id, config)}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* ── Render order strip ── */}
      <div className="rounded-2xl border border-black/8 bg-white px-5 py-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          Current render order
        </p>
        <div className="flex flex-wrap gap-2">
          {sections.map((s, i) => (
            <span
              key={s.id}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                s.enabled
                  ? "bg-[#1d1a17] text-white"
                  : "bg-black/8 text-text-muted line-through"
              }`}
            >
              <span className="opacity-60">{i + 1}.</span>
              {SECTION_META[s.type].label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Live preview hint ── */}
      <div className="rounded-2xl border border-dashed border-black/10 bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <LayoutDashboard size={18} className="shrink-0 text-text-muted" />
          <div>
            <p className="text-sm font-medium text-text-primary">Live Preview</p>
            <p className="mt-0.5 text-xs text-text-muted">
              Save the layout, then{" "}
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-text-primary"
              >
                open the homepage
              </a>{" "}
              to see your changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
