/**
 * AdminFeaturedPage
 * ──────────────────────────────────────────────────────────────────────────────
 * Shopify-style featured books manager.
 *
 * Combobox trigger → self-contained dropdown:
 *   ┌─ Search input (top) ──────────────────────────┐
 *   │  Staged chips (across all search queries)      │
 *   │  ─────────────────────────────────────────     │
 *   │  [✓] cover  Title / Author         ₹399        │  ← full-row click
 *   │  [✓] cover  Title / Author         ₹299        │
 *   │  [ ] cover  Title / Author         ₹199        │
 *   │  ─────────────────────────────────────────     │
 *   │  2 selected  [Select all]  [Clear]  [Add 2]    │
 *   └───────────────────────────────────────────────-┘
 *
 * Key decisions:
 *  • pendingBooks: Map<id, Book>   — keeps full book objects across search queries
 *    so chips can show titles without an extra API call
 *  • Full row is clickable (not just the tiny checkbox span)
 *  • 300 ms debounced search → GET /books?q=...&limit=15
 *  • Batch-add fires all adds in parallel then invalidates once
 */

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronDown,
  Loader2,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  addFeaturedBook,
  getFeaturedBooks,
  removeFeaturedBook,
} from "../../api/featured.api";
import { getBooks } from "../../api/books.api";
import type { Book } from "../../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v));

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-8 w-48 rounded-xl" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="skeleton h-12 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminFeaturedPage() {
  const queryClient = useQueryClient();

  // ── Combobox / dropdown state ─────────────────────────────────────────────
  const [open,          setOpen]          = useState(false);
  const [rawQuery,      setRawQuery]      = useState("");
  const [searchQuery,   setSearchQuery]   = useState(""); // debounced
  // Store full Book objects so chips show titles without re-fetching
  const [pendingBooks,  setPendingBooks]  = useState<Map<string, Book>>(new Map());

  const wrapperRef  = useRef<HTMLDivElement>(null);
  const searchRef   = useRef<HTMLInputElement>(null);

  // ── 300 ms debounce ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(rawQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // ── Close on outside-click / Escape ──────────────────────────────────────
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown",   onKey);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: featuredData, isLoading } = useQuery({
    queryKey: ["featured-books"],
    queryFn:  getFeaturedBooks,
  });

  const { data: searchData, isFetching: isSearching } = useQuery({
    queryKey: ["feat-search", searchQuery],
    queryFn:  () => getBooks({ q: searchQuery || undefined, limit: 15, page: 1 }),
    enabled:  open && searchQuery.length >= 1,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const batchAddMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const base = featured.length;
      await Promise.all(ids.map((id, i) => addFeaturedBook(id, base + i)));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["featured-books"] });
      setPendingBooks(new Map());
      setRawQuery("");
      setSearchQuery("");
      setOpen(false);
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeFeaturedBook,
    onSuccess:  () => void queryClient.invalidateQueries({ queryKey: ["featured-books"] }),
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const featured    = (featuredData?.data ?? []) as Book[];
  const featuredIds = new Set(featured.map((b) => b.id));

  // Exclude already-featured AND already-staged from results
  const searchResults = (searchData?.data?.books ?? []).filter(
    (b) => !featuredIds.has(b.id),
  );
  // Separate visible results into staged / unstaged for "select all"
  const visibleUnstaged = searchResults.filter((b) => !pendingBooks.has(b.id));
  const pendingCount    = pendingBooks.size;
  const stagedBooks     = [...pendingBooks.values()];

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleBook = (book: Book) => {
    setPendingBooks((prev) => {
      const next = new Map(prev);
      next.has(book.id) ? next.delete(book.id) : next.set(book.id, book);
      return next;
    });
  };

  const unstageBook = (id: string) =>
    setPendingBooks((prev) => { const n = new Map(prev); n.delete(id); return n; });

  const selectAllVisible = () => {
    setPendingBooks((prev) => {
      const next = new Map(prev);
      visibleUnstaged.forEach((b) => next.set(b.id, b));
      return next;
    });
  };

  const clearAll = () => setPendingBooks(new Map());

  const handleAdd = () => {
    if (pendingCount === 0 || batchAddMutation.isPending) return;
    batchAddMutation.mutate([...pendingBooks.keys()]);
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) return <PageSkeleton />;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-6">

      {/* ── Page header ── */}
      <div>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-text-muted">
          Manage
        </p>
        <h2 className="mt-0.5 font-serif text-2xl text-text-primary sm:text-3xl">
          Featured Section
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Select books to display in the Featured Books section on the homepage.
        </p>
      </div>

      {/* ── Add books combobox ── */}
      <div className="rounded-2xl border border-black/8 bg-white p-4 sm:p-5">
        <p className="mb-3 text-sm font-medium text-text-primary">
          Add books to featured
        </p>

        <div ref={wrapperRef} className="relative">

          {/* ── Combobox trigger ── */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
              open
                ? "border-[#1d1a17]/30 bg-white ring-2 ring-[#1d1a17]/8"
                : "border-black/10 bg-[#f8f4ee] hover:border-black/20 hover:bg-[#f4efe7]"
            }`}
          >
            <Star
              size={15}
              className={`shrink-0 ${open ? "text-[#1d1a17]" : "text-text-muted"}`}
            />
            <span className="flex-1 text-sm text-text-muted">
              {pendingCount > 0
                ? `${pendingCount} book${pendingCount > 1 ? "s" : ""} staged — click to continue selecting`
                : "Click to search and add books to featured…"}
            </span>
            {pendingCount > 0 && (
              <span className="shrink-0 rounded-full bg-[#1d1a17] px-2 py-0.5 text-[11px] font-semibold text-white">
                {pendingCount}
              </span>
            )}
            <ChevronDown
              size={15}
              className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>

          {/* ── Dropdown panel ── */}
          {open && (
            <div className="absolute left-0 right-0 z-50 mt-1.5 flex max-h-[min(520px,70vh)] flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl">

              {/* Search input at top of dropdown */}
              <div className="relative shrink-0 border-b border-black/8 p-2.5">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-text-muted"
                />
                {isSearching && (
                  <Loader2
                    size={13}
                    className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-text-muted"
                  />
                )}
                <input
                  ref={searchRef}
                  type="text"
                  value={rawQuery}
                  onChange={(e) => setRawQuery(e.target.value)}
                  placeholder="Search by title, author, ISBN…"
                  className="w-full rounded-lg bg-[#f8f4ee] py-2 pl-8 pr-8 text-sm text-text-primary placeholder:text-text-muted focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1d1a17]/20 transition-all"
                />
                {rawQuery && (
                  <button
                    type="button"
                    onClick={() => { setRawQuery(""); setSearchQuery(""); searchRef.current?.focus(); }}
                    className="absolute right-5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-text-muted hover:text-text-primary"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Staged chips row (cross-search persistence) */}
              {stagedBooks.length > 0 && (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-black/8 bg-[#f8f4ee]/50 px-3 py-2.5">
                  <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    Staged:
                  </span>
                  {stagedBooks.map((b) => (
                    <span
                      key={b.id}
                      className="inline-flex items-center gap-1 rounded-full border border-[#1d1a17]/15 bg-white px-2.5 py-1 text-[11px] font-medium text-text-primary shadow-sm"
                    >
                      <img
                        src={b.coverImageUrl}
                        alt=""
                        className="h-3.5 w-2.5 rounded object-cover"
                      />
                      <span className="max-w-[120px] truncate">{b.title}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); unstageBook(b.id); }}
                        className="ml-0.5 rounded-full p-0.5 text-text-muted hover:text-red-500 transition-colors"
                      >
                        <X size={10} strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Results list — scrollable */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {searchQuery.length < 1 ? (
                  /* ── Prompt to type ── */
                  <div className="flex flex-col items-center gap-2.5 px-4 py-10 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4efe7]">
                      <Search size={18} className="text-text-muted" />
                    </span>
                    <p className="text-sm font-medium text-text-primary">
                      Search for books to add
                    </p>
                    <p className="text-xs text-text-muted">
                      Type a title, author, or ISBN above
                    </p>
                  </div>
                ) : isSearching ? (
                  /* ── Loading ── */
                  <div className="flex items-center justify-center gap-2.5 py-10 text-sm text-text-muted">
                    <Loader2 size={16} className="animate-spin" />
                    Searching…
                  </div>
                ) : searchResults.length === 0 ? (
                  /* ── No results ── */
                  <div className="flex flex-col items-center gap-2.5 px-4 py-10 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4efe7]">
                      <BookOpen size={18} className="text-text-muted" />
                    </span>
                    <p className="text-sm font-medium text-text-primary">
                      No results found
                    </p>
                    <p className="text-xs text-text-muted">
                      Try a different search term
                    </p>
                  </div>
                ) : (
                  /* ── Book rows ── */
                  <ul>
                    {searchResults.map((book) => {
                      const isStaged = pendingBooks.has(book.id);
                      return (
                        <li key={book.id}>
                          {/*
                           * ENTIRE ROW is clickable — button wrapper handles
                           * the click; no need to aim at a tiny checkbox span.
                           */}
                          <button
                            type="button"
                            onClick={() => toggleBook(book)}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                              isStaged
                                ? "bg-[#1d1a17]/[0.04]"
                                : "hover:bg-[#f8f4ee]"
                            }`}
                          >
                            {/* Custom checkbox */}
                            <span
                              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 transition-all ${
                                isStaged
                                  ? "border-[#1d1a17] bg-[#1d1a17]"
                                  : "border-black/25"
                              }`}
                            >
                              {isStaged && (
                                <Check
                                  size={10}
                                  strokeWidth={3}
                                  className="text-white"
                                />
                              )}
                            </span>

                            {/* Cover */}
                            <img
                              src={book.coverImageUrl}
                              alt={book.title}
                              className="h-12 w-8 shrink-0 rounded-md object-cover shadow-sm"
                            />

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium leading-tight text-text-primary">
                                {book.title}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-text-muted">
                                {book.author}
                              </p>
                            </div>

                            {/* Price */}
                            <p className="shrink-0 text-sm font-semibold text-text-primary">
                              {fmt(book.price)}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* ── Sticky footer ── */}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-black/8 bg-[#f8f4ee]/60 px-4 py-3">
                {/* Left: count + select-all */}
                <div className="flex items-center gap-2">
                  <p className="text-xs text-text-muted">
                    {pendingCount > 0 ? (
                      <>
                        <span className="font-semibold text-text-primary">
                          {pendingCount}
                        </span>{" "}
                        book{pendingCount > 1 ? "s" : ""} staged
                      </>
                    ) : (
                      "None selected"
                    )}
                  </p>
                  {visibleUnstaged.length > 0 && searchQuery.length >= 1 && (
                    <button
                      type="button"
                      onClick={selectAllVisible}
                      className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] text-text-muted transition-all hover:border-black/20 hover:text-text-primary"
                    >
                      Select all {visibleUnstaged.length} visible
                    </button>
                  )}
                </div>

                {/* Right: Clear + Add */}
                <div className="flex items-center gap-2">
                  {pendingCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-text-muted transition-all hover:bg-white hover:text-text-primary"
                    >
                      Clear all
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={pendingCount === 0 || batchAddMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1a17] px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {batchAddMutation.isPending ? (
                      <>
                        <Loader2 size={11} className="animate-spin" />
                        Adding…
                      </>
                    ) : (
                      <>
                        <Star size={11} />
                        {pendingCount > 0
                          ? `Add ${pendingCount} to Featured`
                          : "Add to Featured"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="mt-2 text-xs text-text-muted">
          Search for books, check the ones you want, then click{" "}
          <strong className="text-text-primary">Add to Featured</strong>.
          You can search multiple times — selections carry over.
        </p>
      </div>

      {/* ── Featured books grid ── */}
      {featured.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          <p className="px-0.5 text-xs font-semibold uppercase tracking-widest text-text-muted">
            {featured.length} featured book{featured.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((book, i) => (
              <FeaturedBookCard
                key={book.id}
                book={book}
                index={i}
                isRemoving={
                  removeMutation.isPending && removeMutation.variables === book.id
                }
                onRemove={() => removeMutation.mutate(book.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-black/10 bg-white px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4efe7]">
        <Star size={24} className="text-text-muted" />
      </span>
      <div>
        <p className="font-serif text-lg text-text-primary">
          No featured books yet
        </p>
        <p className="mt-1 text-sm text-text-muted">
          Use the search above to add books to the featured section.
        </p>
      </div>
    </div>
  );
}

// ── Featured book card ────────────────────────────────────────────────────────

interface FeaturedBookCardProps {
  book:       Book;
  index:      number;
  isRemoving: boolean;
  onRemove:   () => void;
}

function FeaturedBookCard({ book, index, isRemoving, onRemove }: FeaturedBookCardProps) {
  return (
    <div
      className={`group relative flex items-start gap-3 overflow-hidden rounded-2xl border border-black/8 bg-white p-4 transition-all ${
        isRemoving
          ? "scale-[0.98] opacity-50"
          : "hover:border-black/15 hover:shadow-sm"
      }`}
    >
      {/* Position badge */}
      <span className="absolute top-3 left-3 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#1d1a17] text-[10px] font-bold text-white">
        {index + 1}
      </span>

      {/* Cover */}
      <div className="mt-4 shrink-0">
        <img
          src={book.coverImageUrl}
          alt={book.title}
          className="h-20 w-14 rounded-lg object-cover shadow-sm"
        />
      </div>

      {/* Meta */}
      <div className="min-w-0 flex-1 pt-4">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-text-primary">
          {book.title}
        </p>
        <p className="mt-1 truncate text-xs text-text-muted">{book.author}</p>
        <p className="mt-1.5 text-sm font-bold text-[#8f2d22]">
          {fmt(Number(book.price))}
        </p>
        {book.stock === 0 && (
          <span className="mt-1.5 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500">
            Out of stock
          </span>
        )}
      </div>

      {/* Remove — visible on hover */}
      <button
        type="button"
        onClick={onRemove}
        disabled={isRemoving}
        title="Remove from featured"
        className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-red-100 text-red-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        {isRemoving ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Trash2 size={12} />
        )}
      </button>
    </div>
  );
}
