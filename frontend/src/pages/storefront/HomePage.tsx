import { ArrowRight, BookOpen, SlidersHorizontal, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getBook, getBooks } from "../../api/books.api";
import { getCategories, type Category } from "../../api/categories.api";
import type { Book } from "../../types";
import { addToCart, getCart } from "../../api/cart.api";
import { getBanners } from "../../api/banners.api";
import { getFeaturedBooks } from "../../api/featured.api";
import { getHomepageSections } from "../../api/homepage-sections.api";
import type { HomepageSection } from "../../api/homepage-sections.api";
import BookSlider from "../../components/ui/BookSlider";
import BannerSlider from "../../components/ui/BannerSlider";
import CategorySlider from "../../components/ui/CategorySlider";
import { SkeletonCategory, SkeletonGrid } from "../../components/ui/SkeletonLoader";
import { getErrorMessage, useToast, ToastViewport } from "../../components/ui/Toast";
import { useAuthStore } from "../../store/auth.store";
import { getSectionViewAllHref, getCategorySectionItems } from "../../utils/sectionLinks";

const MAX_PRICE     = 5000;
const formatPrice   = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

export default function HomePage() {
  const [searchParams]          = useSearchParams();
  const [search, setSearch]     = useState(searchParams.get("q") ?? "");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const deferredSearch          = useDeferredValue(search);
  const queryClient             = useQueryClient();
  const navigate                = useNavigate();
  const isAuthenticated         = useAuthStore((s) => s.isAuthenticated);
  const user                    = useAuthStore((s) => s.user);
  const { toast, showToast }    = useToast();

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setSearch((c) => (c.trim() === q.trim() && c.length > q.length) ? c : q);
  }, [searchParams]);

  // ── Data queries ──────────────────────────────────────────────────────────────
  const { data: homepageSections = [] } = useQuery({ queryKey: ["homepage-sections"], queryFn: getHomepageSections });
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
    onError:    (e) => showToast(false, getErrorMessage(e, "Couldn't add to cart. Please try again.")),
  });

  // ── Derived data ──────────────────────────────────────────────────────────────
  const books      = booksData?.data?.books ?? [];
  const categories: Category[] = categoriesData?.data ?? [];
  const banners    = bannersData?.data ?? [];
  const cartBookIds = new Map(cartData?.data?.items.map((i) => [i.bookId, i.quantity]) ?? []);

  const sections: HomepageSection[] = useMemo(() => {
    return [...homepageSections].sort((a, b) => a.order - b.order).filter((s) => s.isEnabled);
  }, [homepageSections]);

  // Featured manual products
  const featuredSection   = useMemo(() => homepageSections.find((s) => s.bookFilter === "featured"), [homepageSections]);
  const manualProductIds: string[] = useMemo(() => {
    if (!featuredSection?.config?.useManual) return [];
    return featuredSection?.config?.selectedProductIds ?? [];
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

  const handleMinPriceChange = (v: string) => {
    const n = Number(v);
    setMinPrice(String(n));
    if (maxPrice !== "" && n > Number(maxPrice)) setMaxPrice(String(n));
  };
  const handleMaxPriceChange = (v: string) => {
    const n = Number(v);
    setMaxPrice(String(n));
    if (minPrice !== "" && n < Number(minPrice)) setMinPrice(String(n));
  };
  const clearFilters      = () => { setMinPrice(""); setMaxPrice(""); };
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

  // ── Dynamic books helper (new HomepageSection format) ───────────────────────────
  const getBooksForSection = (section: HomepageSection) => {
    const limit  = section.config?.limit ?? 8;
    const catId  = section.categoryId ?? null;
    const subId  = section.subcategoryId ?? null;
    const filter = section.bookFilter ?? 'newArrivals';

    let pool = books;
    if (catId)  pool = pool.filter((b) => b.categoryId === catId || b.bookSubcategories?.some((bs: any) => bs.subcategory?.categoryId === catId));
    if (subId)  pool = pool.filter((b) => b.subcategoryId === subId || b.bookSubcategories?.some((bs: any) => bs.subcategory?.id === subId));

    if (filter === 'featured' || filter === 'bestSellers') {
      const apiFeatured = (featuredData?.data ?? []) as Book[];
      const ids = section.config?.selectedProductIds ?? [];
      if (ids.length && section.config?.useManual) {
        return manualFeaturedBooks.slice(0, limit);
      }
      if (apiFeatured.length) return apiFeatured.slice(0, limit);
      return [...pool].sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)).slice(0, limit);
    }
    return pool.slice(0, limit);
  };

  // ── Section renderers ─────────────────────────────────────────────────────────
  const renderSection = (section: HomepageSection) => {
    const { type, id } = section;

    switch (type) {

      case "banner":
        return banners.length > 0 ? <BannerSlider key={id} banners={banners} /> : null;

      // ── Browse by Category ──────────────────────────────────────────────────
      case "categories": {
        const items = getCategorySectionItems(section, categories);
        if (!items.length || deferredSearch) return null;
        const heading = section.title?.trim() || "Browse by Category";
        return (
          <section key={id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-text-primary sm:text-2xl">{heading}</h2>
              <Link to="/categories" className="flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text-primary transition-colors shrink-0">
                View all <ArrowRight size={13} />
              </Link>
            </div>
            <CategorySlider categories={items} />
          </section>
        );
      }

      // ── Print CTA ─────────────────────────────────────────────────────────────
      case "printCta":
        if (deferredSearch) return null;
        return (
          <section key={id} className="overflow-hidden rounded-2xl bg-[#1d1a17] sm:rounded-3xl">
            <div className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/60">{section.subtitle?.trim() || "New Service"}</p>
                <h2 className="mt-1.5 font-serif text-2xl text-white sm:text-3xl">{section.title?.trim() || "Print Your Custom Book"}</h2>
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
          <section key={id} id="books-grid" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-serif text-xl text-text-primary sm:text-2xl">
                  {deferredSearch ? `Results for "${deferredSearch}"` : (section.title?.trim() || "All Books")}
                </h2>
                <p className="mt-0.5 text-sm text-text-muted">{filteredBooks.length} titles</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link to="/all-books"
                  className="flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text-primary transition-colors">
                  View all <ArrowRight size={13} />
                </Link>
                <div className="relative">
                  <button type="button" onClick={() => setIsFiltersOpen((c) => !c)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-sm text-text-primary hover:-translate-y-0.5 hover:border-black/20 transition-all">
                    <SlidersHorizontal size={13} /> Filters
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
            ) : filteredBooks.length > 0 ? (
              <BookSlider
                books={filteredBooks}
                onAddToCart={(book) => handleAddToCart(book.id)}
                cartBookIds={cartBookIds}
                addingBookId={addToCartMutation.isPending ? (addToCartMutation.variables?.bookId ?? null) : null}
              />
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

      // ── Dynamic Book Section (new HomepageSection) ──────────────────────────
      case "books": {
        const sectionBooks = getBooksForSection(section);
        if (!sectionBooks.length || deferredSearch) return null;
        const cat = section.categoryId ? categories.find((c) => c.id === section.categoryId) : null;
        const sub = section.subcategoryId ? cat?.subcategories?.find((s) => s.id === section.subcategoryId) : null;
        const subtitle = section.subtitle ?? (sub ? sub.name : cat ? cat.name : null);
        const viewHref = getSectionViewAllHref(section, categories);
        return (
          <section key={id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl text-text-primary sm:text-2xl">{section.title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>}
              </div>
              <Link to={viewHref} className="flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text-primary transition-colors shrink-0">
                View all <ArrowRight size={13} />
              </Link>
            </div>
            <BookSlider books={sectionBooks} onAddToCart={(book) => handleAddToCart(book.id)}
              cartBookIds={cartBookIds}
              addingBookId={addToCartMutation.isPending ? (addToCartMutation.variables?.bookId ?? null) : null} />
          </section>
        );
      }

      default:
        return null;
    }
  };

  const activeSections = sections;

  return (
    <div className="space-y-8 pb-8">
      <ToastViewport toast={toast} />
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
