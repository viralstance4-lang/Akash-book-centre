/**
 * AdminHomepageBuilderPage
 * ─────────────────────────────────────────────────────────────────────────────
 * Drag-and-drop homepage section builder.
 * DnD library: @hello-pangea/dnd  (API-identical to react-beautiful-dnd,
 *              but fully supports React 18 StrictMode — react-beautiful-dnd
 *              has a known upstream bug in StrictMode that breaks dragging).
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
  Edit2,
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
import FeaturedProductsPicker from "../../components/admin/FeaturedProductsPicker";

// ─── Section metadata ────────────────────────────────────────────────────────

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
    description: "Recently added books from a chosen category",
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

// ─── Limit slider sub-component ──────────────────────────────────────────────

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
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {label}
        </p>
        <span className="text-sm font-medium text-text-primary">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6ddd0]"
      />
      <div className="flex justify-between text-[10px] text-text-muted">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// ─── Config editor modal ─────────────────────────────────────────────────────

interface ConfigModalProps {
  section: HomepageSection;
  onSave: (config: SectionConfig) => void;
  onClose: () => void;
}

function ConfigModal({ section, onSave, onClose }: ConfigModalProps) {
  const [draft, setDraft] = useState<SectionConfig>({
    ...section.config,
    title: section.title ?? section.config?.title ?? "",
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const categories = categoriesData?.data ?? [];

  const toggleBool = (key: "showAll" | "useManual") =>
    setDraft((d) => ({ ...d, [key]: !d[key] }));

  const toggleCategory = (id: string) =>
    setDraft((d) => {
      const prev = d.selectedCategoryIds ?? [];
      return {
        ...d,
        selectedCategoryIds: prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id],
      };
    });


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <div>
            <p className="font-serif text-lg text-text-primary">
              Configure: {SECTION_META[section.type].label}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {SECTION_META[section.type].description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-text-muted hover:bg-[#f4efe7]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] space-y-5 overflow-y-auto p-5">
          {/* ── categories ── */}
          {section.type === "categories" && (
            <>
              <label className="flex cursor-pointer items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleBool("showAll")}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    draft.showAll ? "bg-[#1d1a17]" : "bg-black/20"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      draft.showAll ? "translate-x-5" : ""
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-text-primary">
                  Show all categories
                </span>
              </label>
              {!draft.showAll && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Select categories to display
                  </p>
                  <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto pr-1">
                    {categories.map((g) => {
                      const sel = (draft.selectedCategoryIds ?? []).includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleCategory(g.id)}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-all ${
                            sel
                              ? "border-[#1d1a17] bg-[#1d1a17] text-white"
                              : "border-black/10 bg-[#f8f4ee] text-text-primary hover:border-black/20"
                          }`}
                        >
                          {sel && <Check size={12} />}
                          {g.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <LimitInput
                value={draft.limit ?? 8}
                onChange={(v) => setDraft((d) => ({ ...d, limit: v }))}
                label="Max categories to show"
                min={2}
                max={20}
              />
            </>
          )}

          {/* ── newArrivals ── */}
          {section.type === "newArrivals" && (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-medium uppercase tracking-wide text-text-muted">
                  Section title
                </label>
                <input
                  type="text"
                  value={draft.title ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Enter section title (e.g., Best Sellers)"
                  className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:border-black/20 focus:ring-2 focus:ring-black/10"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  Filter by category (optional)
                </p>
                <select
                  value={draft.categoryId ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, categoryId: e.target.value }))
                  }
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-text-primary"
                >
                  <option value="">All categories</option>
                  {categories.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <LimitInput
                value={draft.limit ?? 6}
                onChange={(v) => setDraft((d) => ({ ...d, limit: v }))}
                label="Number of books to show"
                min={2}
                max={24}
              />
            </>
          )}

          {/* ── featuredProducts ── */}
          {section.type === "featuredProducts" && (
            <FeaturedProductsPicker
              selectedProductIds={draft.selectedProductIds ?? []}
              useManual={draft.useManual ?? false}
              limit={draft.limit ?? 4}
              onChangeSelectedIds={(ids) =>
                setDraft((d) => ({ ...d, selectedProductIds: ids }))
              }
              onToggleManual={() =>
                setDraft((d) => ({ ...d, useManual: !d.useManual }))
              }
              onChangeLimit={(v) => setDraft((d) => ({ ...d, limit: v }))}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 px-4 py-2 text-sm text-text-muted transition-all hover:bg-[#f4efe7]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="rounded-full bg-[#1d1a17] px-5 py-2 text-sm text-white transition-all hover:bg-black"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Draggable section card ──────────────────────────────────────────────────

interface SectionCardProps {
  section: HomepageSection;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEditConfig: () => void;
}

function SectionCard({
  section,
  index,
  isFirst,
  isLast,
  onToggle,
  onMoveUp,
  onMoveDown,
  onEditConfig,
}: SectionCardProps) {
  const meta = SECTION_META[section.type];
  const Icon = meta.icon;

  return (
    <Draggable draggableId={section.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 transition-all select-none
            ${
              snapshot.isDragging
                ? "border-[#1d1a17] shadow-lg ring-2 ring-[#1d1a17]/20 rotate-[1deg] scale-[1.02]"
                : "border-black/10 hover:border-black/20 hover:shadow-sm"
            }
            ${!section.enabled ? "opacity-60" : ""}`}
        >
          {/* Drag handle — only this element activates the drag */}
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

          {/* Label + description */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-text-primary">
                {meta.label}
              </p>
              {!section.enabled && (
                <span className="shrink-0 rounded-full bg-black/8 px-2 py-0.5 text-[10px] text-text-muted">
                  Hidden
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-text-muted">
              {meta.description}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-1">
            {/* ↑ Move Up */}
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              title="Move up"
              className="rounded-lg p-1.5 text-text-muted transition-all hover:bg-[#f4efe7] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronUp size={14} />
            </button>

            {/* ↓ Move Down */}
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              title="Move down"
              className="rounded-lg p-1.5 text-text-muted transition-all hover:bg-[#f4efe7] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronDown size={14} />
            </button>

            {/* ✎ Configure */}
            {meta.configurable && (
              <button
                type="button"
                onClick={onEditConfig}
                title="Configure section"
                className="rounded-lg p-1.5 text-text-muted transition-all hover:bg-[#f4efe7]"
              >
                <Edit2 size={14} />
              </button>
            )}

            {/* Toggle on/off */}
            <button
              type="button"
              onClick={onToggle}
              title={section.enabled ? "Hide section" : "Show section"}
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
      )}
    </Draggable>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AdminHomepageBuilderPage() {
  const queryClient = useQueryClient();
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [editingSection, setEditingSection] = useState<HomepageSection | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Fetch current config ──────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ["homepage-config"],
    queryFn: getHomepageConfig,
  });

  useEffect(() => {
    if (data) {
      const sorted = [...data.sections].sort((a, b) => a.order - b.order);
      console.log("[HomepageBuilder] Loaded config from API:", sorted);
      setSections(sorted);
      setIsDirty(false);
    }
  }, [data]);

  // ── Save mutation ─────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (secs: HomepageSection[]) => {
      console.log("[HomepageBuilder] Saving to API:", secs);
      return updateHomepageConfig(secs);
    },
    onSuccess: (updated) => {
      const sorted = [...updated.sections].sort((a, b) => a.order - b.order);
      console.log("[HomepageBuilder] Save successful, DB returned:", sorted);
      setSections(sorted);
      setIsDirty(false);
      setSaveSuccess(true);
      void queryClient.invalidateQueries({ queryKey: ["homepage-config"] });
      setTimeout(() => setSaveSuccess(false), 2500);
    },
    onError: (err: any) => {
      console.error("[HomepageBuilder] Save failed:", err);
      console.error("[HomepageBuilder] Error response:", err?.response?.data);
      console.error("[HomepageBuilder] Error status:", err?.response?.status);
      console.error("[HomepageBuilder] Error message:", err?.message);
      alert(`Failed to save layout: ${err?.response?.data?.message || err?.message || "Unknown error"}`);
    },
  });

  // ── Drag end handler (react-beautiful-dnd / @hello-pangea/dnd) ────────────

  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;

    // Dropped outside any droppable zone — do nothing
    if (!destination) {
      console.log("[HomepageBuilder] Drag cancelled (dropped outside)");
      return;
    }

    // Dropped in same position — do nothing
    if (destination.index === source.index) {
      console.log("[HomepageBuilder] Drag ended at same position — no change");
      return;
    }

    // Reorder array
    const reordered = Array.from(sections);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    // Reassign sequential order numbers
    const withOrder = reordered.map((s, i) => ({ ...s, order: i + 1 }));

    console.log(
      `[HomepageBuilder] Dragged "${moved.type}" from index ${source.index} → ${destination.index}`,
    );
    console.log("[HomepageBuilder] Updated section order:", withOrder.map((s) => `${s.order}. ${s.type}`));

    setSections(withOrder);
    setIsDirty(true);
  };

  // ── Up / Down button reorder ──────────────────────────────────────────────

  const moveSection = (id: string, dir: "up" | "down") => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      const withOrder = next.map((s, i) => ({ ...s, order: i + 1 }));
      console.log(
        `[HomepageBuilder] Moved "${id}" ${dir}:`,
        withOrder.map((s) => `${s.order}. ${s.type}`),
      );
      return withOrder;
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

  // ── Save section config ───────────────────────────────────────────────────

  const saveSectionConfig = (id: string, config: SectionConfig) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              config,
              title: config.title?.trim() ? config.title : s.title,
              categoryId: config.categoryId ? config.categoryId : undefined,
            }
          : s,
      ),
    );
    setIsDirty(true);
    console.log("[HomepageBuilder] Updated config for section:", id, config);
  };

  // ── Reset to last saved ───────────────────────────────────────────────────

  const resetToSaved = () => {
    if (data) {
      const sorted = [...data.sections].sort((a, b) => a.order - b.order);
      setSections(sorted);
      setIsDirty(false);
      console.log("[HomepageBuilder] Reset to saved state");
    }
  };

  // ── Save handler ──────────────────────────────────────────────────────────

  const handleSave = () => {
    const payload = sections.map((s, i) => {
      const updated = { ...s, order: i + 1 };
      console.log(`[HomepageBuilder] Preparing section ${updated.order}: ${updated.type} (${updated.enabled ? 'enabled' : 'disabled'})`);
      return updated;
    });
    
    console.log("[HomepageBuilder] handleSave: sending payload with", payload.length, 'sections');
    console.log("[HomepageBuilder] Full payload:", JSON.stringify(payload, null, 2));
    
    saveMutation.mutate(payload);
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
          <GripVertical
            size={12}
            className="inline-block align-middle text-text-muted"
          />{" "}
          handle to reorder · toggle switch to show/hide · pencil to configure.
          Changes are not live until you save.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={resetToSaved}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 py-2 text-sm text-text-muted transition-all hover:bg-[#f4efe7]"
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending || !isDirty}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all
              ${saveSuccess ? "bg-emerald-600 text-white" : "bg-[#1d1a17] text-white hover:bg-black"}
              disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {saveSuccess ? (
              <>
                <Check size={13} /> Saved!
              </>
            ) : saveMutation.isPending ? (
              <>
                <Save size={13} /> Saving…
              </>
            ) : (
              <>
                <Save size={13} /> Save Layout
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Unsaved-changes banner ── */}
      {isDirty && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You have unsaved changes.{" "}
          <strong>Click Save Layout</strong> to publish them to the homepage.
        </div>
      )}

      {/* ── Section list ── */}
      <div className="space-y-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Sections ({visibleCount} of {sections.length} visible)
          </p>
          <p className="text-xs text-text-muted">
            Drag <GripVertical size={11} className="inline align-middle" /> to
            reorder
          </p>
        </div>

        {/* DragDropContext wraps the entire droppable list */}
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
                    onToggle={() => toggleSection(section.id)}
                    onMoveUp={() => moveSection(section.id, "up")}
                    onMoveDown={() => moveSection(section.id, "down")}
                    onEditConfig={() => setEditingSection(section)}
                  />
                ))}
                {/* Required placeholder keeps list height stable during drag */}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* ── Order preview strip ── */}
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
            <p className="text-sm font-medium text-text-primary">
              Live Preview
            </p>
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

      {/* ── Config modal ── */}
      {editingSection && (
        <ConfigModal
          section={editingSection}
          onSave={(config) => {
            saveSectionConfig(editingSection.id, config);
            setEditingSection(null);
          }}
          onClose={() => setEditingSection(null)}
        />
      )}
    </div>
  );
}
