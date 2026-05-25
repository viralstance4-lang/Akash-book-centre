import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, SlidersHorizontal, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getBooks } from "../../api/books.api";
import { addToCart, getCart } from "../../api/cart.api";
import BookCard from "../../components/ui/BookCard";
import { SkeletonGrid } from "../../components/ui/SkeletonLoader";
import { useAuthStore } from "../../store/auth.store";
import type { Book } from "../../types";

const PAGE_SIZE = 20;
const MAX_PRICE = 5000;
const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

export default function AllBooksPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient     = useQueryClient();
  const navigate        = useNavigate();

  const [page,           setPage]           = useState(1);
  const [minPrice,       setMinPrice]       = useState("");
  const [maxPrice,       setMaxPrice]       = useState("");
  const [isFiltersOpen,  setIsFiltersOpen]  = useState(false);

  const { data: booksData, isLoading } = useQuery({
    queryKey: ["books", { page: 1, limit: 500 }],
    queryFn:  () => getBooks({ page: 1, limit: 500 }),
  });

  const { data: cartData } = useQuery({
    queryKey: ["cart"],
    queryFn:  getCart,
    enabled:  isAuthenticated,
  });

  const addToCartMutation = useMutation({
    mutationFn: ({ bookId, quantity }: { bookId: string; quantity: number }) =>
      addToCart(bookId, quantity),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const allBooks: Book[]  = booksData?.data?.books ?? [];
  const cartBookIds       = new Set(cartData?.data?.items.map((i) => i.bookId) ?? []);

  const filtered = useMemo(() => {
    const min = minPrice ? Number(minPrice) : undefined;
    const max = maxPrice ? Number(maxPrice) : undefined;
    return allBooks.filter((b) => {
      const p = Number(b.price);
      return (min === undefined || p >= min) && (max === undefined || p <= max);
    });
  }, [allBooks, minPrice, maxPrice]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage     = Math.min(page, totalPages);
  const visible     = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const filterCount = [minPrice !== "", maxPrice !== ""].filter(Boolean).length;

  const clearFilters = () => { setMinPrice(""); setMaxPrice(""); setPage(1); };

  const handleAddToCart = (book: Book) => {
    if (!isAuthenticated) { navigate("/login"); return; }
    addToCartMutation.mutate({ bookId: book.id, quantity: 1 });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-text-muted">
        <Link to="/" className="hover:text-text-primary transition-colors">Home</Link>
        <span>/</span>
        <span className="text-text-primary font-medium">All Books</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl text-text-primary">All Books</h1>
          {!isLoading && (
            <p className="mt-1 text-sm text-text-muted">{filtered.length} titles</p>
          )}
        </div>

        {/* Filter button */}
        <div className="relative shrink-0">
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
              <div className="flex items-center justify-between mb-4">
                <p className="font-serif text-lg text-text-primary">Price Filter</p>
                <button type="button" onClick={() => setIsFiltersOpen(false)}
                  className="rounded-full p-1.5 text-text-muted hover:bg-[#f4efe7]">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm text-text-muted mb-2">
                    <span>Min</span><span>{fmt(minPrice ? Number(minPrice) : 0)}</span>
                  </div>
                  <input type="range" min="0" max={maxPrice ? Number(maxPrice) : MAX_PRICE} step="100"
                    value={minPrice ? Number(minPrice) : 0}
                    onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6ddd0]" />
                </div>
                <div>
                  <div className="flex justify-between text-sm text-text-muted mb-2">
                    <span>Max</span><span>{fmt(maxPrice ? Number(maxPrice) : MAX_PRICE)}</span>
                  </div>
                  <input type="range" min={minPrice ? Number(minPrice) : 0} max={MAX_PRICE} step="100"
                    value={maxPrice ? Number(maxPrice) : MAX_PRICE}
                    onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6ddd0]" />
                </div>
              </div>
              <div className="mt-4 flex justify-between">
                <button type="button" onClick={clearFilters}
                  className="text-sm text-text-muted hover:text-text-primary">Clear all</button>
                <button type="button" onClick={() => setIsFiltersOpen(false)}
                  className="rounded-full bg-[#1d1a17] px-4 py-2 text-sm text-white hover:bg-black">Apply</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <SkeletonGrid count={20} />
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-text-muted rounded-2xl border border-dashed border-black/10 bg-white">
          <BookOpen size={36} strokeWidth={1.2} />
          <p className="font-serif text-xl text-text-primary">No books found</p>
          <p className="text-sm">Try adjusting your filters.</p>
          {filterCount > 0 && (
            <button type="button" onClick={clearFilters}
              className="mt-2 rounded-full border border-black/10 px-4 py-2 text-sm hover:bg-[#f4efe7] transition-all">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visible.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                isInCart={cartBookIds.has(book.id)}
                onAddToCart={handleAddToCart}
                isAddingToCart={
                  addToCartMutation.isPending &&
                  addToCartMutation.variables?.bookId === book.id
                }
              />
            ))}
          </div>

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
        </>
      )}
    </div>
  );
}
