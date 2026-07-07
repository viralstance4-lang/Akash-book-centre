import { useMemo, useState } from "react";
import { BookOpen, Search, SlidersHorizontal, X } from "lucide-react";
import BookCard from "./BookCard";
import { SkeletonGrid } from "./SkeletonLoader";
import type { Book } from "../../types";

const MAX_PRICE = 5000;
const formatPrice = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

export type SortOption = "default" | "newest" | "price-asc" | "price-desc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "default",    label: "Relevance" },
  { value: "newest",     label: "Newest first" },
  { value: "price-asc",  label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

type Props = {
  books: Book[];
  isLoading: boolean;
  cartBookIds: Set<string>;
  onAddToCart: (book: Book) => void;
  addingBookId?: string | null;
  pageSize?: number;
  emptyTitle?: string;
  emptyMessage?: string;
  enableSearch?: boolean;
  enableSort?: boolean;
  enablePriceFilter?: boolean;
  columns?: 2 | 3;
};

/**
 * Shared product grid with search, sort, price filter and pagination.
 * Used by every "View all" destination (category, subcategory, best sellers,
 * featured, all books) so the experience and empty/fallback states stay
 * consistent and new listing pages get them for free.
 */
export default function ProductListingGrid({
  books, isLoading, cartBookIds, onAddToCart, addingBookId = null,
  pageSize = 20,
  emptyTitle = "No products found",
  emptyMessage = "Check back later for new arrivals.",
  enableSearch = true,
  enableSort = true,
  enablePriceFilter = true,
  columns = 3,
}: Props) {
  const [search, setSearch]               = useState("");
  const [sort, setSort]                   = useState<SortOption>("default");
  const [minPrice, setMinPrice]           = useState("");
  const [maxPrice, setMaxPrice]           = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [page, setPage]                   = useState(1);

  const filterCount     = [minPrice !== "", maxPrice !== ""].filter(Boolean).length;
  const hasActiveFilters = search.trim() !== "" || filterCount > 0 || sort !== "default";

  const filtered = useMemo(() => {
    const q   = search.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : undefined;
    const max = maxPrice ? Number(maxPrice) : undefined;

    const result = books.filter((book) => {
      const matchesSearch = !q || [book.title, book.author, book.isbn, book.description]
        .some((v) => v?.toLowerCase().includes(q));
      const price = Number(book.price);
      return matchesSearch && (min === undefined || price >= min) && (max === undefined || price <= max);
    });

    switch (sort) {
      case "price-asc":  return [...result].sort((a, b) => Number(a.price) - Number(b.price));
      case "price-desc": return [...result].sort((a, b) => Number(b.price) - Number(a.price));
      case "newest":     return [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      default:           return result;
    }
  }, [books, search, minPrice, maxPrice, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage     = Math.min(page, totalPages);
  const visible     = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);

  const resetFilters = () => { setSearch(""); setMinPrice(""); setMaxPrice(""); setSort("default"); setPage(1); };

  const handleMinPriceChange = (v: string) => {
    const n = Number(v);
    setMinPrice(String(n));
    if (maxPrice !== "" && n > Number(maxPrice)) setMaxPrice(String(n));
    setPage(1);
  };
  const handleMaxPriceChange = (v: string) => {
    const n = Number(v);
    setMaxPrice(String(n));
    if (minPrice !== "" && n < Number(minPrice)) setMinPrice(String(n));
    setPage(1);
  };

  if (isLoading) return <SkeletonGrid count={pageSize} />;

  // Nothing in the source list at all (e.g. empty category / no best sellers yet)
  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-black/10 bg-white px-6 py-20 text-center text-text-muted">
        <BookOpen size={36} strokeWidth={1.2} />
        <p className="font-serif text-xl text-text-primary">{emptyTitle}</p>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-muted">
          {filtered.length} {filtered.length === 1 ? "title" : "titles"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {enableSearch && (
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search in this list..."
                className="h-9 w-40 rounded-xl border border-black/10 bg-white pl-8 pr-3 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/8 sm:w-56"
              />
            </div>
          )}
          {enableSort && (
            <select value={sort} onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
              className="h-9 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-black/30">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {enablePriceFilter && (
            <div className="relative">
              <button type="button" onClick={() => setIsFiltersOpen((c) => !c)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-sm text-text-primary hover:-translate-y-0.5 hover:border-black/20 transition-all">
                <SlidersHorizontal size={13} /> Filters
                {filterCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1d1a17] px-1.5 text-[11px] text-white">
                    {filterCount}
                  </span>
                )}
              </button>
              {isFiltersOpen && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-72 rounded-2xl border border-black/10 bg-white p-4 shadow-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-serif text-lg text-text-primary">Price Filter</p>
                    <button type="button" onClick={() => setIsFiltersOpen(false)} className="rounded-full p-1.5 text-text-muted hover:bg-[#f4efe7]">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex justify-between text-sm text-text-muted">
                        <span>Min</span><span>{formatPrice(minPrice ? Number(minPrice) : 0)}</span>
                      </div>
                      <input type="range" min="0" max={maxPrice ? Number(maxPrice) : MAX_PRICE} step="100"
                        value={minPrice ? Number(minPrice) : 0}
                        onChange={(e) => handleMinPriceChange(e.target.value)}
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6ddd0]" />
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between text-sm text-text-muted">
                        <span>Max</span><span>{formatPrice(maxPrice ? Number(maxPrice) : MAX_PRICE)}</span>
                      </div>
                      <input type="range" min={minPrice ? Number(minPrice) : 0} max={MAX_PRICE} step="100"
                        value={maxPrice ? Number(maxPrice) : MAX_PRICE}
                        onChange={(e) => handleMaxPriceChange(e.target.value)}
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6ddd0]" />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between">
                    <button type="button" onClick={resetFilters} className="text-sm text-text-muted hover:text-text-primary">Clear all</button>
                    <button type="button" onClick={() => setIsFiltersOpen(false)}
                      className="rounded-full bg-[#1d1a17] px-4 py-2 text-sm text-white hover:bg-black">Apply</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid / empty */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-black/10 bg-white px-6 py-16 text-center text-text-muted">
          <BookOpen size={32} strokeWidth={1.2} />
          <p className="font-serif text-xl text-text-primary">No books found</p>
          <p className="text-sm">Try adjusting your search or filters.</p>
          {hasActiveFilters && (
            <button type="button" onClick={resetFilters}
              className="mt-2 rounded-full border border-black/10 px-4 py-2 text-sm transition-all hover:bg-[#f4efe7]">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className={`grid gap-2 ${columns === 2 ? "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"}`}>
          {visible.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              isInCart={cartBookIds.has(book.id)}
              onAddToCart={onAddToCart}
              isAddingToCart={addingBookId === book.id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-text-muted">Page {curPage} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((c) => Math.max(1, c - 1))}
              disabled={curPage <= 1}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm transition-all hover:-translate-y-0.5 disabled:opacity-40">
              Previous
            </button>
            <button type="button" onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
              disabled={curPage >= totalPages}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm transition-all hover:-translate-y-0.5 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
