/**
 * FeaturedProductsPicker
 * ──────────────────────────────────────────────────────────────────────────────
 * Multi-select + debounced-search component for picking Featured Products
 * inside the Homepage Builder config modal.
 *
 * Design decisions:
 *  • useQueries — fetches currently-selected books by ID in parallel (cached)
 *  • Debounced search — 300 ms, calls GET /books?q=...&limit=15 (not all books)
 *  • Dropdown closes on outside click and on Escape
 *  • Selected books displayed as rich chips (thumbnail + name + price + ✕)
 */

import { Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { getBook, getBooks } from "../../api/books.api";
import type { Book } from "../../types";

const formatPrice = (v: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v));

// ── Limit slider ─────────────────────────────────────────────────────────────

function LimitSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Auto-select top N books
        </p>
        <span className="text-sm font-medium text-text-primary">{value}</span>
      </div>
      <input
        type="range"
        min={2}
        max={12}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6ddd0]"
      />
      <div className="flex justify-between text-[10px] text-text-muted">
        <span>2</span>
        <span>12</span>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FeaturedProductsPickerProps {
  selectedProductIds: string[];
  useManual: boolean;
  limit: number;
  onChangeSelectedIds: (ids: string[]) => void;
  onToggleManual: () => void;
  onChangeLimit: (v: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FeaturedProductsPicker({
  selectedProductIds,
  useManual,
  limit,
  onChangeSelectedIds,
  onToggleManual,
  onChangeLimit,
}: FeaturedProductsPickerProps) {
  const [rawQuery,      setRawQuery]      = useState("");
  const [searchQuery,   setSearchQuery]   = useState("");   // debounced
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const wrapperRef  = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  // ── 300 ms debounce ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(rawQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // ── Close dropdown on outside click ───────────────────────────────────────
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown",   onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown",   onKeyDown);
    };
  }, []);

  // ── Fetch selected books in parallel (for chip display) ───────────────────
  // Each book is cached individually — refetch only on stale TTL
  const selectedQueries = useQueries({
    queries: selectedProductIds.map((id) => ({
      queryKey:  ["book", id],
      queryFn:   () => getBook(id),
      staleTime: 5 * 60 * 1000,
      enabled:   useManual,
    })),
  });
  const selectedBooks = selectedQueries
    .map((r) => r.data?.data)
    .filter((b): b is Book => !!b);

  // ── API-based search (fires only when query ≥ 1 char & dropdown open) ─────
  const { data: searchData, isFetching: isSearching } = useQuery({
    queryKey: ["featured-picker-search", searchQuery],
    queryFn:  () => getBooks({ q: searchQuery, limit: 15, page: 1 }),
    enabled:  searchQuery.length >= 1 && dropdownOpen,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  // Filter out already-selected from results
  const searchResults = (searchData?.data?.books ?? []).filter(
    (b) => !selectedProductIds.includes(b.id),
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelect = (book: Book) => {
    console.log("[FeaturedPicker] Added book:", book.id, book.title);
    onChangeSelectedIds([...selectedProductIds, book.id]);
    setRawQuery("");
    setSearchQuery("");
    // keep dropdown open so admin can add another
    inputRef.current?.focus();
  };

  const handleRemove = (id: string) => {
    console.log("[FeaturedPicker] Removed book:", id);
    onChangeSelectedIds(selectedProductIds.filter((x) => x !== id));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Manual / Auto toggle ── */}
      <label className="flex cursor-pointer items-center gap-3">
        <button
          type="button"
          onClick={onToggleManual}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            useManual ? "bg-[#1d1a17]" : "bg-black/20"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              useManual ? "translate-x-5" : ""
            }`}
          />
        </button>
        <div>
          <p className="text-sm font-medium text-text-primary">
            Manually pick books
          </p>
          <p className="text-xs text-text-muted">
            Off = auto-select top {limit} books by stock
          </p>
        </div>
      </label>

      {/* ════════════════════ MANUAL MODE ════════════════════ */}
      {useManual ? (
        <>
          {/* ── Selected chips ── */}
          {selectedBooks.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Selected books ({selectedBooks.length})
              </p>
              <div className="flex flex-col gap-1.5">
                {selectedBooks.map((book) => (
                  <div
                    key={book.id}
                    className="flex items-center gap-2.5 rounded-xl border border-[#1d1a17]/15 bg-[#1d1a17]/5 px-3 py-2"
                  >
                    <img
                      src={book.coverImageUrl}
                      alt={book.title}
                      className="h-9 w-6 shrink-0 rounded object-cover shadow-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {book.title}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {book.author} · {formatPrice(book.price)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(book.id)}
                      title="Remove"
                      className="shrink-0 rounded-full p-1.5 text-text-muted transition-all hover:bg-red-50 hover:text-red-500"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Loading chips (IDs resolved but books still fetching) ── */}
          {selectedProductIds.length > 0 &&
            selectedBooks.length < selectedProductIds.length && (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Loader2 size={12} className="animate-spin" />
                Loading selected books…
              </div>
            )}

          {/* ── Empty state ── */}
          {selectedProductIds.length === 0 && (
            <div className="rounded-xl border border-dashed border-black/10 bg-[#f8f4ee] px-4 py-4 text-center">
              <p className="text-xs text-text-muted">
                No books selected. Search below to add books.
              </p>
            </div>
          )}

          {/* ── Search box + dropdown ── */}
          <div ref={wrapperRef} className="relative">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
              Add products
            </p>

            {/* Input */}
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              {isSearching && (
                <Loader2
                  size={13}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-text-muted"
                />
              )}
              <input
                ref={inputRef}
                type="text"
                value={rawQuery}
                onChange={(e) => {
                  setRawQuery(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                placeholder="Search by title, author, ISBN…"
                className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-muted focus:border-[#1d1a17]/40 focus:outline-none focus:ring-2 focus:ring-[#1d1a17]/10 transition-shadow"
              />
              {rawQuery && (
                <button
                  type="button"
                  onClick={() => { setRawQuery(""); setSearchQuery(""); inputRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-text-muted hover:text-text-primary"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {dropdownOpen && (
              <div className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl">
                {searchQuery.length < 1 ? (
                  <p className="px-4 py-5 text-center text-xs text-text-muted">
                    Start typing to search products…
                  </p>
                ) : isSearching ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-5 text-xs text-text-muted">
                    <Loader2 size={13} className="animate-spin" /> Searching…
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="px-4 py-5 text-center text-xs text-text-muted">
                    No results for &ldquo;{searchQuery}&rdquo;
                  </p>
                ) : (
                  <ul className="max-h-56 divide-y divide-black/5 overflow-y-auto">
                    {searchResults.map((book) => {
                      const isAlreadySelected = selectedProductIds.includes(book.id);
                      return (
                        <li key={book.id}>
                          <button
                            type="button"
                            onClick={() => !isAlreadySelected && handleSelect(book)}
                            disabled={isAlreadySelected}
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                              isAlreadySelected
                                ? "cursor-default bg-emerald-50/70"
                                : "hover:bg-[#f8f4ee] active:bg-[#f0ebe2]"
                            }`}
                          >
                            {/* Cover */}
                            <img
                              src={book.coverImageUrl}
                              alt={book.title}
                              className="h-11 w-8 shrink-0 rounded object-cover shadow-sm"
                            />
                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-text-primary">
                                {book.title}
                              </p>
                              <p className="truncate text-xs text-text-muted">
                                {book.author}
                              </p>
                            </div>
                            {/* Price / Added badge */}
                            <div className="shrink-0 text-right">
                              {isAlreadySelected ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                  <Check size={10} /> Added
                                </span>
                              ) : (
                                <p className="text-sm font-medium text-text-primary">
                                  {formatPrice(book.price)}
                                </p>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ════════════════════ AUTO MODE ════════════════════ */
        <LimitSlider value={limit} onChange={onChangeLimit} />
      )}
    </div>
  );
}
