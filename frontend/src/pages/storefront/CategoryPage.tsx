import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Layers3 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getBooks } from "../../api/books.api";
import { addToCart, getCart } from "../../api/cart.api";
import { getCategories, type Category } from "../../api/categories.api";
import CategorySidebar from "../../components/ui/CategorySidebar";
import ProductListingGrid from "../../components/ui/ProductListingGrid";
import { useAuthStore } from "../../store/auth.store";
import type { Book } from "../../types";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient     = useQueryClient();
  const navigate        = useNavigate();

  const [selectedSubSlug, setSelectedSubSlug] = useState<string | null>(null);

  const { data: catsData, isLoading: catsLoading } = useQuery({
    queryKey: ["categories"],
    queryFn:  getCategories,
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

  const categories: Category[] = catsData?.data ?? [];
  const category = categories.find((c) => c.slug === slug);
  const subcategories = category?.subcategories.filter((s) => s.isActive) ?? [];
  const cartBookIds   = new Set(cartData?.data?.items.map((i) => i.bookId) ?? []);
  const addingBookId  = addToCartMutation.isPending ? (addToCartMutation.variables?.bookId ?? null) : null;

  useEffect(() => {
    setSelectedSubSlug(null);
  }, [slug]);

  useEffect(() => {
    if (subcategories.length > 0 && !selectedSubSlug) {
      setSelectedSubSlug(subcategories[0].slug);
    }
  }, [subcategories, selectedSubSlug]);

  const { data: booksData, isLoading: booksLoading } = useQuery({
    queryKey: ["books-subcategory", selectedSubSlug],
    queryFn:  () => getBooks({ subcategory: selectedSubSlug!, limit: 200 }),
    enabled:  !!selectedSubSlug,
    staleTime: 2 * 60 * 1000,
  });

  const { data: catBooksData, isLoading: catBooksLoading } = useQuery({
    queryKey: ["books-category", slug],
    queryFn:  () => getBooks({ category: slug, limit: 200 }),
    enabled:  !!slug && subcategories.length === 0 && !catsLoading,
    staleTime: 2 * 60 * 1000,
  });

  const books: Book[] = selectedSubSlug
    ? (booksData?.data?.books ?? [])
    : (catBooksData?.data?.books ?? []);

  const isLoadingBooks = selectedSubSlug ? booksLoading : catBooksLoading;
  const selectedSub    = subcategories.find((s) => s.slug === selectedSubSlug);

  const handleAddToCart = (book: Book) => {
    if (!isAuthenticated) { navigate("/login"); return; }
    addToCartMutation.mutate({ bookId: book.id, quantity: 1 });
  };

  const outerClass = "-mx-4 -my-5 sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8 flex min-h-screen";

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (catsLoading) {
    return (
      <div className={outerClass}>
        {/* Category sidebar skeleton */}
        <aside className="w-[60px] sm:w-[72px] shrink-0 border-r border-gray-100 bg-white">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 px-2 py-2.5">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-black/8" />
              <div className="h-2 w-9 animate-pulse rounded bg-black/8" />
            </div>
          ))}
        </aside>
        {/* Subcategory sidebar skeleton */}
        <aside className="w-[72px] sm:w-[90px] shrink-0 border-r border-gray-100 bg-white">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 px-2 py-3">
              <div className="h-11 w-11 animate-pulse rounded-xl bg-black/8" />
              <div className="h-2 w-10 animate-pulse rounded bg-black/8" />
            </div>
          ))}
        </aside>
        <div className="flex-1 px-3 pt-4">
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-black/8" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────────
  if (!category) {
    return (
      <div className={outerClass}>
        <CategorySidebar />
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center px-4">
            <p className="font-serif text-2xl text-text-primary">Category not found</p>
            <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary">
              <ArrowLeft size={14} /> Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── No subcategories ─────────────────────────────────────────────────────────
  if (subcategories.length === 0) {
    return (
      <div className={outerClass}>
        <CategorySidebar activeCategorySlug={slug} />
        <div className="flex-1 min-w-0 px-4 py-6 space-y-4">
          <nav className="flex items-center gap-2 text-xs text-text-muted">
            <Link to="/" className="hover:text-text-primary">Home</Link>
            <span>/</span>
            <span className="text-text-primary font-medium">{category.name}</span>
          </nav>
          <h1 className="font-serif text-2xl text-text-primary">{category.name}</h1>
          <ProductListingGrid
            books={books}
            isLoading={catBooksLoading}
            cartBookIds={cartBookIds}
            onAddToCart={handleAddToCart}
            addingBookId={addingBookId}
            emptyTitle="No products found"
            emptyMessage="No books in this category yet."
          />
        </div>
      </div>
    );
  }

  // ── With subcategories (Blinkit 3-panel layout) ───────────────────────────────
  return (
    <div className={outerClass}>
      <CategorySidebar activeCategorySlug={slug} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Category name header */}
        <div className="px-3 py-2.5 border-b border-gray-100 bg-white">
          <h1 className="font-serif text-base text-text-primary sm:text-lg leading-tight">{category.name}</h1>
        </div>

        <div className="flex flex-1">
          {/* Subcategory sidebar */}
          <aside className="w-[72px] sm:w-[90px] shrink-0 sticky top-[125px] sm:top-16 self-start max-h-[calc(100vh-125px)] sm:max-h-[calc(100vh-4rem)] overflow-y-auto border-r border-gray-100 bg-white scrollbar-none">
            {subcategories.map((sub) => {
              const active = sub.slug === selectedSubSlug;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubSlug(sub.slug)}
                  className={`w-full flex flex-col items-center gap-1 px-1.5 py-3 border-l-[3px] transition-colors ${
                    active
                      ? "border-red-500 bg-red-50/70"
                      : "border-transparent hover:bg-gray-50"
                  }`}
                >
                  <div className="h-11 w-11 rounded-xl overflow-hidden bg-[#f4efe7] shrink-0 flex items-center justify-center">
                    {sub.imageUrl ? (
                      <img src={sub.imageUrl} alt={sub.name} className="h-full w-full object-cover" />
                    ) : (
                      <Layers3 size={16} className="text-text-muted/50" strokeWidth={1.4} />
                    )}
                  </div>
                  <span className={`text-[9px] leading-tight text-center break-words w-full px-0.5 ${
                    active ? "text-red-500 font-semibold" : "text-gray-500"
                  }`}>
                    {sub.name}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* Product content */}
          <div className="flex-1 min-w-0 px-2 pt-3 pb-20">
            <div className="mb-3">
              <h2 className="font-serif text-sm font-medium text-text-primary leading-tight">
                {selectedSub?.name ?? category.name}
              </h2>
            </div>
            <ProductListingGrid
              books={books}
              isLoading={isLoadingBooks}
              cartBookIds={cartBookIds}
              onAddToCart={handleAddToCart}
              addingBookId={addingBookId}
              emptyTitle="No products found"
              emptyMessage="No books in this subcategory yet."
              enableSearch={false}
              enableSort={false}
              enablePriceFilter={false}
              columns={2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
