import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Save, Trash2, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  adminCreateCategorySection,
  adminDeleteCategorySection,
  adminGetCategorySections,
  adminReorderCategorySections,
  adminUpdateCategorySection,
  type CategorySection,
} from "../../api/category-sections.api";
import { getCategories, type Category } from "../../api/categories.api";
import { getBooks } from "../../api/books.api";
import type { Book } from "../../types";

type FormState = {
  heading: string;
  contentType: "category" | "manual";
  categoryId: string;
  subcategoryIds: string[];
  selectedBookIds: string[];
};

const EMPTY_FORM: FormState = {
  heading: "",
  contentType: "category",
  categoryId: "",
  subcategoryIds: [],
  selectedBookIds: [],
};

export default function AdminCategorySectionsPage() {
  const qc = useQueryClient();

  // ── data ──────────────────────────────────────────────────────────────────
  const { data: sectionsData, isLoading } = useQuery({
    queryKey: ["admin-category-sections"],
    queryFn: adminGetCategorySections,
  });
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });
  const { data: booksData } = useQuery({
    queryKey: ["admin-all-books"],
    queryFn: () => getBooks({ limit: 500 }),
  });

  const sections: CategorySection[] = sectionsData?.data ?? [];
  const allCategories: Category[]   = categoriesData?.data ?? [];
  const allBooks: Book[]             = booksData?.data?.books ?? [];

  // ── panel state ───────────────────────────────────────────────────────────
  const [panelOpen,     setPanelOpen]     = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [form,          setForm]          = useState<FormState>(EMPTY_FORM);
  const [bookSearch,    setBookSearch]    = useState("");
  const [dragIndex,     setDragIndex]     = useState<number | null>(null);
  const [toast,         setToast]         = useState<{ ok: boolean; msg: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── derived ───────────────────────────────────────────────────────────────
  const subcategories =
    allCategories.find((c) => c.id === form.categoryId)?.subcategories ?? [];

  // books that match the live search and are not yet selected
  const searchResults =
    bookSearch.trim().length >= 1
      ? allBooks
          .filter(
            (b) =>
              !form.selectedBookIds.includes(b.id) &&
              (b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
                b.author.toLowerCase().includes(bookSearch.toLowerCase())),
          )
          .slice(0, 25)
      : [];

  // full Book objects for selected IDs (for chip labels)
  const selectedBooks = form.selectedBookIds
    .map((id) => allBooks.find((b) => b.id === id))
    .filter(Boolean) as Book[];

  // ── ordered list mirrors sections ─────────────────────────────────────────
  const [orderedSections, setOrderedSections] = useState<CategorySection[]>([]);
  useEffect(() => {
    setOrderedSections(sections);
  }, [sections]);

  // ── mutations ──────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: adminCreateCategorySection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-category-sections"] });
      closePanel();
      showToast(true, "Section created!");
    },
    onError: (e: any) =>
      showToast(false, e?.response?.data?.message ?? "Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, fd }: { id: string; fd: FormData }) =>
      adminUpdateCategorySection(id, fd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-category-sections"] });
      closePanel();
      showToast(true, "Section updated!");
    },
    onError: (e: any) =>
      showToast(false, e?.response?.data?.message ?? "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: adminDeleteCategorySection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-category-sections"] });
      setDeleteConfirm(null);
      showToast(true, "Section deleted.");
    },
    onError: (e: any) =>
      showToast(false, e?.response?.data?.message ?? "Failed to delete"),
  });

  const reorderMut = useMutation({
    mutationFn: adminReorderCategorySections,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin-category-sections"] }),
  });

  // ── panel helpers ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setBookSearch("");
    setPanelOpen(true);
  };

  const openEdit = (s: CategorySection) => {
    setEditingId(s.id);
    const subcategoryIds =
      s.sectionSubcategories && s.sectionSubcategories.length > 0
        ? s.sectionSubcategories.map((ss) => ss.subcategory.id)
        : s.subcategoryId
        ? [s.subcategoryId]
        : [];
    const selectedBookIds = s.sectionBooks?.map((sb) => sb.bookId) ?? [];
    setForm({
      heading: s.heading,
      contentType: s.contentType as "category" | "manual",
      categoryId: s.categoryId ?? "",
      subcategoryIds,
      selectedBookIds,
    });
    setBookSearch("");
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setBookSearch("");
  };

  const addBook = (book: Book) => {
    setForm((p) => ({ ...p, selectedBookIds: [...p.selectedBookIds, book.id] }));
    setBookSearch("");
  };

  const removeBook = (bookId: string) => {
    setForm((p) => ({
      ...p,
      selectedBookIds: p.selectedBookIds.filter((id) => id !== bookId),
    }));
  };

  const toggleSubcategory = (scId: string) => {
    setForm((p) => ({
      ...p,
      subcategoryIds: p.subcategoryIds.includes(scId)
        ? p.subcategoryIds.filter((id) => id !== scId)
        : [...p.subcategoryIds, scId],
    }));
  };

  const handleSave = () => {
    if (!form.heading.trim()) return showToast(false, "Heading is required.");
    if (form.contentType === "category" && !form.categoryId)
      return showToast(false, "Please select a category.");
    if (form.contentType === "manual" && form.selectedBookIds.length === 0)
      return showToast(false, "Please select at least one book.");

    const fd = new FormData();
    fd.append("heading", form.heading.trim());
    fd.append("contentType", form.contentType);
    if (form.contentType === "category") {
      fd.append("categoryId", form.categoryId);
      fd.append("subcategoryIds", JSON.stringify(form.subcategoryIds));
      fd.append("bookIds", JSON.stringify([]));
    } else {
      fd.append("categoryId", "");
      fd.append("subcategoryIds", JSON.stringify([]));
      fd.append("bookIds", JSON.stringify(form.selectedBookIds));
    }
    if (editingId) {
      updateMut.mutate({ id: editingId, fd });
    } else {
      createMut.mutate(fd);
    }
  };

  // ── reorder helpers ────────────────────────────────────────────────────────
  const moveSection = (index: number, dir: -1 | 1) => {
    const next = [...orderedSections];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrderedSections(next);
    reorderMut.mutate(next.map((s, i) => ({ id: s.id, sortOrder: i })));
  };

  if (isLoading)
    return <div className="h-64 animate-pulse rounded-2xl bg-white" />;

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg max-w-sm ${
            toast.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">
            Admin
          </p>
          <h2 className="font-serif text-2xl text-text-primary">
            Category Control
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Manage the sections shown on the customer Categories page.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-4 py-2.5 text-sm font-medium text-white hover:bg-black transition-colors"
        >
          <Plus size={14} /> New Section
        </button>
      </div>

      {/* Section list */}
      {orderedSections.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-black/15 py-16 text-text-muted">
          <p className="text-sm">No sections yet.</p>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-4 py-2 text-xs text-text-primary hover:bg-[#f4efe7] transition-colors"
          >
            <Plus size={12} /> Create your first section
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {orderedSections.map((s, index) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIndex === null || dragIndex === index) return;
                const next = [...orderedSections];
                const [moved] = next.splice(dragIndex, 1);
                next.splice(index, 0, moved);
                setOrderedSections(next);
                setDragIndex(index);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                reorderMut.mutate(
                  orderedSections.map((sec, i) => ({ id: sec.id, sortOrder: i })),
                );
              }}
              className={`flex items-center gap-3 rounded-2xl border border-black/8 bg-white p-3 transition-all select-none ${
                dragIndex === index
                  ? "opacity-50"
                  : "cursor-grab hover:border-black/15 hover:shadow-sm"
              }`}
            >
              <GripVertical size={16} className="shrink-0 text-text-muted/40" />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {s.heading}
                </p>
                <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      s.contentType === "category"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-violet-50 text-violet-600"
                    }`}
                  >
                    {s.contentType === "category" ? "Category" : "Manual"}
                  </span>
                  {s.contentType === "category" && (
                    <span className="text-[11px] text-text-muted truncate">
                      {s.sectionSubcategories && s.sectionSubcategories.length > 0
                        ? s.sectionSubcategories
                            .map((ss) => ss.subcategory.name)
                            .join(", ")
                        : s.category?.name ?? ""}
                    </span>
                  )}
                  {s.contentType === "manual" && (
                    <span className="text-[11px] text-text-muted">
                      {s._count?.sectionBooks ?? 0} books
                    </span>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moveSection(index, -1)}
                  disabled={index === 0}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-[#f4efe7] disabled:opacity-30 transition-colors"
                  title="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 1)}
                  disabled={index === orderedSections.length - 1}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-[#f4efe7] disabled:opacity-30 transition-colors"
                  title="Move down"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(s)}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-[#f4efe7] transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(s.id)}
                  className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="font-serif text-lg text-text-primary">
              Delete section?
            </h3>
            <p className="text-sm text-text-muted">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-full border border-black/10 py-2.5 text-sm font-medium text-text-primary hover:bg-[#f4efe7] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMut.mutate(deleteConfirm)}
                disabled={deleteMut.isPending}
                className="flex-1 rounded-full bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleteMut.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm">
          <div className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/8 bg-white px-5 py-4">
              <h3 className="font-serif text-lg text-text-primary">
                {editingId ? "Edit Section" : "New Section"}
              </h3>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-full p-1.5 text-text-muted hover:bg-[#f4efe7] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-5 p-5">
              {/* Heading */}
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">
                  Heading
                </label>
                <input
                  type="text"
                  value={form.heading}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, heading: e.target.value }))
                  }
                  placeholder="e.g. BPSC Prelims Test Series"
                  className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white"
                />
              </div>

              {/* Content type toggle */}
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">
                  Content Type
                </label>
                <div className="flex rounded-xl border border-black/10 overflow-hidden">
                  {(["category", "manual"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          contentType: t,
                          categoryId: "",
                          subcategoryIds: [],
                          selectedBookIds: [],
                        }))
                      }
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                        form.contentType === t
                          ? "bg-[#1d1a17] text-white"
                          : "bg-white text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {t === "category" ? "Category" : "Manual Books"}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {form.contentType === "category"
                    ? "Show subcategory tiles from a chosen category."
                    : "Hand-pick specific books to display."}
                </p>
              </div>

              {/* ── Category fields ─────────────────────────────────────── */}
              {form.contentType === "category" && (
                <div className="space-y-4">
                  {/* Category dropdown */}
                  <div>
                    <label className="mb-1.5 block text-xs uppercase tracking-widest text-text-muted">
                      Category
                    </label>
                    <select
                      value={form.categoryId}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          categoryId: e.target.value,
                          subcategoryIds: [],
                        }))
                      }
                      className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-3 py-2.5 text-sm outline-none focus:bg-white"
                    >
                      <option value="">-- Select a category --</option>
                      {allCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subcategory multi-select (only when a category is chosen) */}
                  {form.categoryId && subcategories.length > 0 && (
                    <div>
                      <label className="mb-1.5 flex items-center gap-2 text-xs uppercase tracking-widest text-text-muted">
                        Subcategories
                        {form.subcategoryIds.length > 0 && (
                          <span className="rounded-full bg-[#1d1a17] px-2 py-0.5 text-[10px] font-semibold text-white normal-case tracking-normal">
                            {form.subcategoryIds.length} selected
                          </span>
                        )}
                      </label>
                      <div className="max-h-52 overflow-y-auto space-y-1 rounded-xl border border-black/10 bg-[#f8f4ee] p-2">
                        {subcategories.map((sc) => {
                          const checked = form.subcategoryIds.includes(sc.id);
                          return (
                            <label
                              key={sc.id}
                              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 transition-colors ${
                                checked
                                  ? "bg-[#1d1a17] text-white"
                                  : "bg-white hover:bg-[#f4efe7] text-text-primary"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSubcategory(sc.id)}
                                className="h-3.5 w-3.5 accent-white shrink-0"
                              />
                              <span className="text-sm">{sc.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      {form.subcategoryIds.length === 0 && (
                        <p className="mt-1 text-[11px] text-text-muted">
                          None selected — all subcategories will show.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Manual book picker ──────────────────────────────────── */}
              {form.contentType === "manual" && (
                <div className="space-y-3">
                  <label className="block text-xs uppercase tracking-widest text-text-muted">
                    Pick Books
                  </label>

                  {/* Selected chips */}
                  {selectedBooks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBooks.map((book) => (
                        <span
                          key={book.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1a17] pl-2.5 pr-1.5 py-1 text-[11px] font-medium text-white max-w-[200px]"
                        >
                          <span className="truncate">{book.title}</span>
                          <button
                            type="button"
                            onClick={() => removeBook(book.id)}
                            className="shrink-0 rounded-full p-0.5 hover:bg-white/20 transition-colors"
                            aria-label="Remove"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Live search input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={bookSearch}
                      onChange={(e) => setBookSearch(e.target.value)}
                      placeholder="Type to search books by title or author..."
                      className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-3 py-2.5 text-sm outline-none focus:border-black/25 focus:bg-white"
                    />
                    {bookSearch && (
                      <button
                        type="button"
                        onClick={() => setBookSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Search results */}
                  {bookSearch.trim().length >= 1 && (
                    <div className="max-h-52 overflow-y-auto rounded-xl border border-black/10 bg-white">
                      {searchResults.length === 0 ? (
                        <p className="py-6 text-center text-xs text-text-muted">
                          No books found.
                        </p>
                      ) : (
                        searchResults.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => addBook(b)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#f8f4ee] transition-colors border-b border-black/5 last:border-0"
                          >
                            <img
                              src={b.coverImageUrl}
                              alt=""
                              className="h-9 w-6 shrink-0 rounded object-cover shadow-sm"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block truncate text-xs font-medium text-text-primary">
                                {b.title}
                              </span>
                              <span className="block truncate text-[10px] text-text-muted">
                                {b.author}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full border border-black/10 px-2 py-0.5 text-[10px] text-text-muted">
                              + Add
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {selectedBooks.length === 0 && !bookSearch && (
                    <p className="text-[11px] text-text-muted">
                      Search and add books above.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 border-t border-black/8 bg-white p-5">
              <button
                type="button"
                onClick={handleSave}
                disabled={createMut.isPending || updateMut.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1d1a17] py-3 text-sm font-medium text-white hover:bg-black disabled:opacity-60 transition-all"
              >
                <Save size={14} />
                {createMut.isPending || updateMut.isPending
                  ? "Saving..."
                  : "Save Section"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
