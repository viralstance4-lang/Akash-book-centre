import { ArrowRight, BookOpen, Layers3, SlidersHorizontal, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getBook, getBooks } from "../../api/books.api";
import { getCategories, type Category } from "../../api/categories.api";
import type { Book } from "../../types";
import { addToCart, getCart } from "../../api/cart.api";
import { getBanners } from "../../api/banners.api";
import { getFeaturedBooks } from "../../api/featured.api";
import { getHomepageConfig } from "../../api/homepage.api";
import type { HomepageSection } from "../../api/homepage.api";
import BookCard from "../../components/ui/BookCard";
import BannerSlider from "../../components/ui/BannerSlider";
import { SkeletonCategory, SkeletonGrid } from "../../components/ui/SkeletonLoader";
import { useAuthStore } from "../../store/auth.store";

const DEFAULT_LIMIT = 20;
const MAX_PRICE     = 5000;
const formatPrice   = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

export default function HomePage() {
  const [searchParams]          = useSearchParams();
  const [search, setSearch]     = useState(searchParams.get("q") ?? "");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [page, setPage]         = useState(1);
  const deferredSearch          = useDeferredValue(search);
  const booksSectionRef         = useRef<HTMLElement | null>(null);
  const queryClient             = useQueryClient();
  const navigate                = useNavigate();
  const isAuthenticated         = useAuthStore((s) => s.isAuthenticated);
  const user                    = useAuthStore((s) => s.user);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setSearch((c) => (c.trim() === q.trim() && c.length > q.length) ? c : q);
  }, [searchParams]);

  useEffect(() => { setPage(1); }, [deferredSearch]);

  // ── Data queries ──────────────────────────────────────────────────────────────
  const { data: configData   } = useQuery({ queryKey: ["homepage-config"], queryFn: getHomepageConfig });
  const { data: cartData     } = useQuery({ queryKey: ["cart"],            queryFn: getCart,          enabled: isAuthenticated });
  const { data: categoriesData} = useQuery({ queryKey: ["categories"],     queryFn: getCategories });
  const { data: bannersData  } = useQuery({ queryKey: ["banners"],         queryFn: getBanners });
  const { data: featuredData } = useQuery({ queryKey: ["featured-books"],  queryFn: getFeaturedBooks });
  const { data: booksData, isLoading: booksLoading } = useQuery({
    queryKey: ["books", { page: 1, limit: 200 }],
    queryFn:  () => getBooks({ page: 1, limit: 200 }),
    placeholderData: (prev) => prev,
  });

  const addToCartMutation = useMutation({
    mutationFn: ({ bookId, quantity }: { bookId: string; quantity: number }) => addToCart(bookId, quantity),
    onSuccess:  () => void queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  // ── Derived data ──────────────────────────────────────────────────────────────
  const books      = booksData?.data?.books ?? [];
  const categories: Category[] = categoriesData?.data ?? [];
  const banners    = bannersData?.data ?? [];
  const cartBookIds = new Set(cartData?.data?.items.map((i) => i.bookId) ?? []);

  const sections: HomepageSection[] = useMemo(() => {
    if (!configData?.sections?.length) return [];
    return [...configData.sections].sort((a, b) => a.order - b.order).filter((s) => s.enabled);
  }, [configData]);

  // Featured manual products
  const featuredSection   = useMemo(() => configData?.sections?.find((s) => s.type === "featuredProducts"), [configData]);
  const manualProductIds: string[] = useMemo(() => {
    if (!featuredSection?.config?.useManual) return [];
    return featuredSection.config.selectedProductIds ?? [];
  }, [featuredSection]);
  const manualFeaturedQueries = useQueries({
    queries: manualProductIds.map((id) => ({
      queryKey:  ["book", id],
      queryFn:   () => getBook(id),
      staleTime: 5 * 60 * 1000,
      enabled:   manualProductIds.length > 0,
    })),
  });
  const manualFeaturedBooks: Book[] = manualFeaturedQueries
    .map((r) => r.data?.data)
    .filter((b): b is Book => !!b);

  // ── Section-specific helpers ──────────────────────────────────────────────────
  // books array is already sorted newest-first from the API (orderBy createdAt desc)
  const getNewArrivals = (section: HomepageSection) => {
    const limit      = section.config.limit ?? 6;
    const categoryId = section.categoryId ?? section.config.categoryId;
    const filtered   = categoryId
      ? books.filter((b) => b.category?.id === categoryId)
      : books;
    return filtered.slice(0, limit);
  };

  const getFeatured = (cfg: HomepageSection["config"]) => {
    if (cfg.useManual) return manualFeaturedBooks;
    const apiFeatured = (featuredData?.data ?? []) as Book[];
    if (apiFeatured.length > 0) return apiFeatured.slice(0, cfg.limit ?? 4);
    return [...books].sort((a, b) => b.stock - a.stock).slice(0, cfg.limit ?? 4);
  };

  const getVisibleCategories = (cfg: HomepageSection["config"]) => {
    const limit = cfg.limit ?? 8;
    if (cfg.showAll !== false) return categories.filter((c) => c.isActive).slice(0, limit);
    const ids = cfg.selectedCategoryIds ?? [];
    const filtered = ids.length ? categories.filter((c) => ids.includes(c.id) && c.isActive) : categories.filter((c) => c.isActive);
    return filtered.slice(0, limit);
  };

  // ── All-books filtering ───────────────────────────────────────────────────────
  const filteredBooks = useMemo(() => {
    const q   = deferredSearch.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : undefined;
    const max = maxPrice ? Number(maxPrice) : undefined;
    return books.filter((book) => {
      const matchesSearch = !q || [book.title, book.author, book.isbn, book.description, book.category?.name].some(
        (v) => v?.toLowerCase().includes(q)
      );
      const price = Number(book.price);
      return matchesSearch && (min === undefined || price >= min) && (max === undefined || price <= max);
    });
  }, [books, deferredSearch, maxPrice, minPrice]);

  const totalPages   = Math.max(1, Math.ceil(filteredBooks.length / DEFAULT_LIMIT));
  const currentPage  = Math.min(page, totalPages);
  const visibleBooks = useMemo(
    () => filteredBooks.slice((currentPage - 1) * DEFAULT_LIMIT, currentPage * DEFAULT_LIMIT),
    [currentPage, filteredBooks],
  );

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
  const clearFilters      = () => { setMinPrice(""); setMaxPrice(""); setPage(1); };
  const activeFilterCount = [minPrice !== "", maxPrice !== ""].filter(Boolean).length;
  const handleAddToCart   = (bookId: string) => {
    if (!isAuthenticated) { navigate("/login"); return; }
    addToCartMutation.mutate({ bookId, quantity: 1 });
  };

  const isPageLoading = booksLoading;
  const [showPageContent, setShowPageContent] = useState(false);
  useEffect(() => {
    if (isPageLoading) { setShowPageContent(false); return; }
    const frame = window.requestAnimationFrame(() => setShowPageContent(true));
    return () => cancelAnimationFrame(frame);
  }, [isPageLoading]);

  // ── Section renderers ─────────────────────────────────────────────────────────
  const renderSection = (section: HomepageSection) => {
    const { type, config, id } = section;

    switch (type) {

      case "banner":
        return banners.length > 0 ? <BannerSlider key={id} banners={banners} /> : null;

      // ── Browse by Category ──────────────────────────────────────────────────
      case "categories": {
        const visibleCats = getVisibleCategories(config);
        if (!visibleCats.length || deferredSearch) return null;
        return (
          <section key={id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-text-primary sm:text-2xl">Browse by Category</h2>
              <Link to="/categories" className="hidden items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors sm:flex">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {visibleCats.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/category/${cat.slug}`}
                  className="group relative overflow-hidden rounded-2xl border border-black/8 transition-all hover:-translate-y-0.5 hover:border-black/20 hover:shadow-sm"
                >
                  <div className="aspect-square w-full overflow-hidden">
                    {cat.imageUrl ? (
                      <img
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#f4efe7]">
                        <Layers3 size={22} className="text-text-muted/60" strokeWidth={1.4} />
                      </div>
                    )}
                  </div>
                  {cat.imageUrl && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent pointer-events-none" />
                  )}
                  <div className={`${cat.imageUrl ? "absolute bottom-0 left-0 right-0 px-1.5 pb-2" : "relative px-1.5 pb-2 pt-1.5"}`}>
                    <p className={`truncate text-[10px] font-semibold leading-tight text-center sm:text-[11px] ${
                      cat.imageUrl ? "text-white drop-shadow-sm" : "text-text-primary"
                    }`}>
                      {cat.name}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      }

      // ── New Arrivals ──────────────────────────────────────────────────────────
      case "newArrivals": {
        const arrivals = getNewArrivals(section);
        if (!arrivals.length || deferredSearch) return null;
        const naTitle      = section.config?.title?.trim() || section.title?.trim() || "New Arrivals";
        const naCategoryId = section.categoryId ?? section.config?.categoryId;
        const naCatName    = naCategoryId ? categories.find((c) => c.id === naCategoryId)?.name : null;
        return (
          <section key={id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-text-primary sm:text-2xl">{naTitle}</h2>
                <p className="mt-0.5 text-sm text-text-muted">
                  {naCatName ? `From ${naCatName}` : "Recently added to our collection"}
                </p>
              </div>
              <button type="button"
                onClick={() => booksSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="hidden items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors sm:flex">
                View all <ArrowRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {arrivals.map((book) => (
                <BookCard key={book.id} book={book}
                  onAddToCart={() => handleAddToCart(book.id)}
                  isInCart={cartBookIds.has(book.id)}
                  isAddingToCart={addToCartMutation.isPending && addToCartMutation.variables?.bookId === book.id} />
              ))}
            </div>
          </section>
        );
      }

      // ── Featured Products ─────────────────────────────────────────────────────
      case "featuredProducts": {
        const featured = getFeatured(config);
        if (!featured.length || deferredSearch) return null;
        return (
          <section key={id} className="space-y-4">
            <div>
              <h2 className="font-serif text-xl text-text-primary sm:text-2xl">Featured Books</h2>
              <p className="mt-0.5 text-sm text-text-muted">Our top picks for you</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {featured.map((book: any) => (
                <div key={book.id}
                  className="group relative overflow-hidden rounded-2xl bg-white shadow-sm border border-black/5 transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer"
                  onClick={() => navigate(`/books/${book.id}`)}>
                  <img src={book.coverImageUrl} alt={book.title} className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="font-serif text-sm text-white leading-tight line-clamp-2">{book.title}</p>
                    <p className="mt-1 text-xs text-white/70">{book.author}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-serif text-sm text-white">{formatPrice(book.price)}</span>
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); handleAddToCart(book.id); }}
                        disabled={cartBookIds.has(book.id) || book.stock < 1}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all
                          ${cartBookIds.has(book.id) ? "bg-emerald-500 text-white" : "bg-white text-[#1d1a17] hover:bg-[#f4efe7]"}`}>
                        {cartBookIds.has(book.id) ? "✓ Added" : "Add"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      }

      // ── Print CTA ─────────────────────────────────────────────────────────────
      case "printSection":
        if (deferredSearch) return null;
        return (
          <section key={id} className="overflow-hidden rounded-2xl bg-[#1d1a17] sm:rounded-3xl">
            <div className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/60">New Service</p>
                <h2 className="mt-1.5 font-serif text-2xl text-white sm:text-3xl">Print Your Custom Book</h2>
                <p className="mt-2 max-w-md text-sm text-white/70">Upload any PDF and we'll print it for you — color or B&W, spiral or stapler binding.</p>
              </div>
              <Link to="/print-book"
                className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-[#1d1a17] transition-all hover:-translate-y-0.5 hover:bg-[#f4efe7] shrink-0">
                <BookOpen size={15} /> Start Printing
              </Link>
            </div>
          </section>
        );

      // ── All Books ─────────────────────────────────────────────────────────────
      case "allBooks":
        return (
          <section key={id} id="books-grid" ref={booksSectionRef} className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-serif text-xl text-text-primary sm:text-2xl">
                  {deferredSearch ? `Results for "${deferredSearch}"` : "All Books"}
                </h2>
                <p className="mt-0.5 text-sm text-text-muted">{filteredBooks.length} titles</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button type="button" onClick={() => setIsFiltersOpen((c) => !c)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm text-text-primary hover:-translate-y-0.5 hover:border-black/20 transition-all">
                    <SlidersHorizontal size={14} /> Filters
                    {activeFilterCount > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1d1a17] px-1.5 text-[11px] text-white">
                        {activeFilterCount}
                      </span>
                    )}
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
                          <input type="range" min="0" max={maxPrice ? Number(maxPrice) : MAX_PRICE} step="100"
                            value={minPrice ? Number(minPrice) : 0}
                            onChange={(e) => handleMinPriceChange(e.target.value)}
                            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6ddd0]" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm text-text-muted mb-2"><span>Max</span><span>{formatPrice(maxPrice ? Number(maxPrice) : MAX_PRICE)}</span></div>
                          <input type="range" min={minPrice ? Number(minPrice) : 0} max={MAX_PRICE} step="100"
                            value={maxPrice ? Number(maxPrice) : MAX_PRICE}
                            onChange={(e) => handleMaxPriceChange(e.target.value)}
                            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e6ddd0]" />
                        </div>
                      </div>
                      <div className="mt-4 flex justify-between">
                        <button type="button" onClick={clearFilters} className="text-sm text-text-muted hover:text-text-primary">Clear all</button>
                        <button type="button" onClick={() => setIsFiltersOpen(false)}
                          className="rounded-full bg-[#1d1a17] px-4 py-2 text-sm text-white hover:bg-black">Apply</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {booksLoading ? (
              <SkeletonGrid count={12} />
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
                {activeFilterCount > 0 && (
                  <button type="button" onClick={clearFilters}
                    className="mt-4 rounded-full border border-black/10 px-4 py-2 text-sm hover:bg-[#f4efe7] transition-all">Clear filters</button>
                )}
              </div>
            )}
          </section>
        );

      default:
        return null;
    }
  };

  const fallbackSections: HomepageSection[] = [
    { id: "banner",           type: "banner",           enabled: true, order: 1, config: {} },
    { id: "categories",       type: "categories",       enabled: true, order: 2, config: { showAll: true, limit: 8 } },
    { id: "newArrivals",      type: "newArrivals",      enabled: true, order: 3, config: { limit: 6 } },
    { id: "featuredProducts", type: "featuredProducts", enabled: true, order: 4, config: { useManual: false, limit: 4 } },
    { id: "printSection",     type: "printSection",     enabled: true, order: 5, config: {} },
    { id: "allBooks",         type: "allBooks",         enabled: true, order: 6, config: {} },
  ];
  const activeSections = sections.length ? sections : fallbackSections;

  return (
    <div className="space-y-8 pb-8">
      {user?.role === "ADMIN" && (
        <div className="flex items-center justify-between rounded-2xl bg-[#1d1a17] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/70">Admin Mode</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span className="text-sm font-medium">You're logged in as Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/homepage-builder"
              className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30 transition-colors">
              Edit Homepage
            </Link>
            <Link to="/admin"
              className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#1d1a17] hover:bg-[#f4efe7] transition-colors">
              Dashboard →
            </Link>
          </div>
        </div>
      )}

      {isPageLoading && (
        <div className="space-y-8">
          <section className="space-y-4 rounded-[2rem] border border-black/10 bg-white/95 p-5 shadow-sm">
            <div className="skeleton h-6 w-48 rounded-full" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCategory key={i} />)}
            </div>
          </section>
          <section className="space-y-4 rounded-[2rem] border border-black/10 bg-white/95 p-5 shadow-sm">
            <div className="skeleton h-6 w-48 rounded-full" />
            <SkeletonGrid count={12} />
          </section>
        </div>
      )}

      <div className={`transition-opacity duration-500 ease-out ${showPageContent ? "opacity-100" : "opacity-0"}`}>
        <div className="space-y-8">
          {activeSections.map((section) => renderSection(section))}
        </div>
      </div>
    </div>
  );
}
