import { ArrowRight, BookOpen, SlidersHorizontal, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getBooks, getGenres } from "../../api/books.api";
import { addToCart, getCart } from "../../api/cart.api";
import { getBanners } from "../../api/banners.api";
import { getFeaturedBooks } from "../../api/featured.api";
import BookCard from "../../components/ui/BookCard";
import BannerSlider from "../../components/ui/BannerSlider";
import { useAuthStore } from "../../store/auth.store";

const DEFAULT_LIMIT = 20;
const MAX_PRICE = 5000;
const formatPrice = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

// Genre emoji mapping
const genreEmojis: Record<string, string> = {
  fiction: "📖", "non-fiction": "📚", mystery: "🔍", romance: "💕", "sci-fi": "🚀",
  fantasy: "🧙", biography: "👤", history: "🏛️", science: "🔬", technology: "💻",
  children: "🧸", horror: "👻", thriller: "😱", poetry: "✍️", default: "📕",
};

export default function HomePage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const booksSectionRef = useRef<HTMLElement | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setSearch((c) => (c.trim() === q.trim() && c.length > q.length) ? c : q);
  }, [searchParams]);

  useEffect(() => { setPage(1); }, [deferredSearch]);

  const { data: cartData } = useQuery({ queryKey: ["cart"], queryFn: getCart, enabled: isAuthenticated });
  const bookQueryParams = useMemo(() => ({ page: 1, limit: 200 }), []);
  const { data: genresData } = useQuery({ queryKey: ["genres"], queryFn: getGenres });
  const { data: bannersData } = useQuery({ queryKey: ["banners"], queryFn: getBanners });
  const { data: featuredData } = useQuery({ queryKey: ["featured-books"], queryFn: getFeaturedBooks });
  const { data: booksData, isLoading: booksLoading } = useQuery({
    queryKey: ["books", bookQueryParams],
    queryFn: () => getBooks(bookQueryParams),
    placeholderData: (prev) => prev,
  });

  const addToCartMutation = useMutation({
    mutationFn: ({ bookId, quantity }: { bookId: string; quantity: number }) => addToCart(bookId, quantity),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const books = booksData?.data?.books ?? [];
  const genres = genresData?.data ?? [];
  const banners = bannersData?.data ?? [];
  const cartBookIds = new Set(cartData?.data?.items.map((i) => i.bookId) ?? []);

  const filteredBooks = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : undefined;
    const max = maxPrice ? Number(maxPrice) : undefined;
    return books.filter((book) => {
      const matchesSearch = !q || [book.title, book.author, book.isbn, book.description, book.genre?.name].some((v) => v?.toLowerCase().includes(q));
      const matchesGenre = !selectedGenre || book.genre?.slug === selectedGenre;
      const price = Number(book.price);
      return matchesSearch && matchesGenre && (min === undefined || price >= min) && (max === undefined || price <= max);
    });
  }, [books, deferredSearch, maxPrice, minPrice, selectedGenre]);

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / DEFAULT_LIMIT));
  const currentPage = Math.min(page, totalPages);
  const visibleBooks = useMemo(() => filteredBooks.slice((currentPage - 1) * DEFAULT_LIMIT, currentPage * DEFAULT_LIMIT), [currentPage, filteredBooks]);

  const handleGenreChange = (slug: string) => { setSelectedGenre(slug); setPage(1); booksSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const handleMinPriceChange = (v: string) => { const n = Number(v); setMinPrice(String(n)); if (maxPrice !== "" && n > Number(maxPrice)) setMaxPrice(String(n)); setPage(1); };
  const handleMaxPriceChange = (v: string) => { const n = Number(v); setMaxPrice(String(n)); if (minPrice !== "" && n < Number(minPrice)) setMinPrice(String(n)); setPage(1); };
  const clearFilters = () => { setSelectedGenre(""); setMinPrice(""); setMaxPrice(""); setPage(1); };
  const activeFilterCount = [selectedGenre !== "", minPrice !== "", maxPrice !== ""].filter(Boolean).length;
  const handleAddToCart = (bookId: string) => { if (!isAuthenticated) { navigate("/login"); return; } addToCartMutation.mutate({ bookId, quantity: 1 }); };

  // New arrivals = first 6 books
  const newArrivals = books.slice(0, 6);
  const apiFeatured = (featuredData?.data ?? []) as any[];
  const featuredBooks = apiFeatured.length > 0 ? apiFeatured : [...books].sort((a, b) => b.stock - a.stock).slice(0, 4);

  return (
    <div className="space-y-8 pb-8">
      {/* Admin Quick Access */}
      {user?.role === "ADMIN" && (
        <div className="flex items-center justify-between rounded-2xl bg-[#1d1a17] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/70">Admin Mode</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span className="text-sm font-medium">You're logged in as Admin</span>
          </div>
          <Link to="/admin" className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#1d1a17] hover:bg-[#f4efe7] transition-colors">
            Dashboard →
          </Link>
        </div>
      )}

      {/* Banner Slider */}
      {banners.length > 0 && <BannerSlider banners={banners} />}

      {/* Genre Cards - PW Store style */}
      {genres.length > 0 && !deferredSearch && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl text-text-primary sm:text-2xl">Browse by Category</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {genres.map((genre) => {
              const emoji = genreEmojis[genre.slug.toLowerCase()] ?? genreEmojis.default;
              const isActive = selectedGenre === genre.slug;
              return (
                <button key={genre.id} type="button" onClick={() => handleGenreChange(isActive ? "" : genre.slug)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all hover:-translate-y-0.5 ${isActive ? "border-[#1d1a17] bg-[#1d1a17] text-white shadow-md" : "border-black/8 bg-white text-text-primary hover:border-black/15 hover:shadow-sm"}`}>
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-[10px] font-medium leading-tight sm:text-xs">{genre.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* New Arrivals Section - only show on homepage without filters */}
      {!deferredSearch && !selectedGenre && newArrivals.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl text-text-primary sm:text-2xl">New Arrivals</h2>
              <p className="mt-0.5 text-sm text-text-muted">Recently added to our collection</p>
            </div>
            <button type="button" onClick={() => booksSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="hidden items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors sm:flex">
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {newArrivals.map((book) => (
              <BookCard key={book.id} book={book}
                onAddToCart={() => handleAddToCart(book.id)}
                isInCart={cartBookIds.has(book.id)}
                isAddingToCart={addToCartMutation.isPending && addToCartMutation.variables?.bookId === book.id} />
            ))}
          </div>
        </section>
      )}

      {/* Featured Books - horizontal scroll on mobile */}
      {!deferredSearch && !selectedGenre && featuredBooks.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl text-text-primary sm:text-2xl">Featured Books</h2>
              <p className="mt-0.5 text-sm text-text-muted">Our top picks for you</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {featuredBooks.map((book) => (
              <div key={book.id} className="group relative overflow-hidden rounded-2xl bg-white shadow-sm border border-black/5 transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer"
                onClick={() => navigate(`/books/${book.id}`)}>
                <img src={book.coverImageUrl} alt={book.title} className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="font-serif text-sm text-white leading-tight line-clamp-2">{book.title}</p>
                  <p className="mt-1 text-xs text-white/70">{book.author}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-serif text-sm text-white">{formatPrice(book.price)}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleAddToCart(book.id); }}
                      disabled={cartBookIds.has(book.id) || book.stock < 1}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${cartBookIds.has(book.id) ? "bg-emerald-500 text-white" : "bg-white text-[#1d1a17] hover:bg-[#f4efe7]"}`}>
                      {cartBookIds.has(book.id) ? "✓ Added" : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Print Book CTA */}
      {!deferredSearch && (
        <section className="overflow-hidden rounded-2xl bg-[#1d1a17] sm:rounded-3xl">
          <div className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/60">New Service</p>
              <h2 className="mt-1.5 font-serif text-2xl text-white sm:text-3xl">Print Your Custom Book</h2>
              <p className="mt-2 max-w-md text-sm text-white/70">Upload any PDF and we'll print it for you — color or B&W, spiral or stapler binding.</p>
            </div>
            <Link to="/print-book" className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-[#1d1a17] transition-all hover:-translate-y-0.5 hover:bg-[#f4efe7] shrink-0">
              <BookOpen size={15} /> Start Printing
            </Link>
          </div>
        </section>
      )}

      {/* All Books Grid with Filters */}
      <section id="books-grid" ref={booksSectionRef} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-xl text-text-primary sm:text-2xl">
              {selectedGenre ? `${genres.find(g => g.slug === selectedGenre)?.name ?? "Books"}` : deferredSearch ? `Results for "${deferredSearch}"` : "All Books"}
            </h2>
            <p className="mt-0.5 text-sm text-text-muted">{filteredBooks.length} titles</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedGenre && (
              <button type="button" onClick={() => setSelectedGenre("")}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors">
                <X size={12} /> Clear genre
              </button>
            )}
            <div className="relative">
              <button type="button" onClick={() => setIsFiltersOpen((c) => !c)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm text-text-primary hover:-translate-y-0.5 hover:border-black/20 transition-all">
                <SlidersHorizontal size={14} /> Filters
                {activeFilterCount > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1d1a17] px-1.5 text-[11px] text-white">{activeFilterCount}</span>}
              </button>
              {isFiltersOpen && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-72 rounded-2xl border border-black/10 bg-white p-4 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-serif text-lg text-text-primary">Price Filter</p>
                    <button type="button" onClick={() => setIsFiltersOpen(false)} className="rounded-full p-1.5 text-text-muted hover:bg-[#f4efe7]"><X size={14} /></button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm text-text-muted mb-2"><span>Min</span><span>{formatPrice(minPrice ? Number(minPrice) : 0)}</span></div>
                      <input type="range" min="0" max={maxPrice ? Number(maxPrice) : MAX_PRICE} step="100" value={minPrice ? Number(minPrice) : 0} onChange={(e) => handleMinPriceChange(e.target.value)} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6ddd0]" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm text-text-muted mb-2"><span>Max</span><span>{formatPrice(maxPrice ? Number(maxPrice) : MAX_PRICE)}</span></div>
                      <input type="range" min={minPrice ? Number(minPrice) : 0} max={MAX_PRICE} step="100" value={maxPrice ? Number(maxPrice) : MAX_PRICE} onChange={(e) => handleMaxPriceChange(e.target.value)} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6ddd0]" />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-between">
                    <button type="button" onClick={clearFilters} className="text-sm text-text-muted hover:text-text-primary">Clear all</button>
                    <button type="button" onClick={() => setIsFiltersOpen(false)} className="rounded-full bg-[#1d1a17] px-4 py-2 text-sm text-white hover:bg-black">Apply</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {booksLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[3/4.5] animate-pulse rounded-2xl bg-white" />)}
          </div>
        ) : visibleBooks.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {visibleBooks.map((book) => (
                <BookCard key={book.id} book={book}
                  onAddToCart={() => handleAddToCart(book.id)}
                  isInCart={cartBookIds.has(book.id)}
                  isAddingToCart={addToCartMutation.isPending && addToCartMutation.variables?.bookId === book.id} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-text-muted">Page {currentPage} of {totalPages}</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPage((c) => Math.max(1, c - 1))} disabled={currentPage <= 1}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm transition-all hover:-translate-y-0.5 disabled:opacity-40">Previous</button>
                  <button type="button" onClick={() => setPage((c) => Math.min(totalPages, c + 1))} disabled={currentPage >= totalPages}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm transition-all hover:-translate-y-0.5 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-12 text-center">
            <BookOpen size={32} className="mx-auto text-text-muted" />
            <p className="mt-4 font-serif text-xl text-text-primary">No books found</p>
            <p className="mt-2 text-sm text-text-muted">Try adjusting your search or filters.</p>
            {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="mt-4 rounded-full border border-black/10 px-4 py-2 text-sm hover:bg-[#f4efe7] transition-all">Clear filters</button>}
          </div>
        )}
      </section>
    </div>
  );
}
