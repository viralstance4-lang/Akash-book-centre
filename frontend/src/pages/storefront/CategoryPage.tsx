import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Layers3 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getBooks } from "../../api/books.api";
import { addToCart, getCart } from "../../api/cart.api";
import { getCategories, type Category } from "../../api/categories.api";
import BookCard from "../../components/ui/BookCard";
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

  // Reset selected sub when category changes
  useEffect(() => {
    setSelectedSubSlug(null);
  }, [slug]);

  // Auto-select first subcategory
  useEffect(() => {
    if (subcategories.length > 0 && !selectedSubSlug) {
      setSelectedSubSlug(subcategories[0].slug);
    }
  }, [subcategories, selectedSubSlug]);

  // Fetch books for selected subcategory
  const { data: booksData, isLoading: booksLoading } = useQuery({
    queryKey: ["books-subcategory", selectedSubSlug],
    queryFn:  () => getBooks({ subcategory: selectedSubSlug!, limit: 200 }),
    enabled:  !!selectedSubSlug,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch all category books when no subcategories
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

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (catsLoading) {
    return (
      <div className="-mx-4 -my-5 sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8 flex">
        <aside className="w-[72px] sm:w-[88px] shrink-0 border-r border-gray-100 bg-white">
          {Array.from({ length: 8 }).map((_, i) => (
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
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <p className="font-serif text-2xl text-text-primary">Category not found</p>
        <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary">
          <ArrowLeft size={14} /> Back to home
        </Link>
      </div>
    );
  }

  // ── No subcategories → simple grid ────────────────────────────────────────────
  if (subcategories.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <nav className="flex items-center gap-2 text-xs text-text-muted">
          <Link to="/" className="hover:text-text-primary">Home</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">{category.name}</span>
        </nav>
        <div>
          <h1 className="font-serif text-3xl text-text-primary">{category.name}</h1>
          {!catBooksLoading && (
            <p className="mt-1 text-sm text-text-muted">{books.length} books</p>
          )}
        </div>
        {catBooksLoading ? (
          <div className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-black/8" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-text-muted">
            <BookOpen size={36} strokeWidth={1.2} />
            <p className="text-sm">No books in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-5">
            {books.map((book) => (
              <BookCard key={book.id} book={book}
                isInCart={cartBookIds.has(book.id)}
                onAddToCart={handleAddToCart}
                isAddingToCart={addToCartMutation.isPending && addToCartMutation.variables?.bookId === book.id}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Blinkit layout ────────────────────────────────────────────────────────────
  return (
    <div className="-mx-4 -my-5 sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8 flex min-h-screen">

      {/* ── Left Sidebar ──────────────────────────────────────────────────────── */}
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
                  <img src={sub.imageUrl} alt={sub.name}
                    className="h-full w-full object-cover" />
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

      {/* ── Right Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 px-2.5 pt-3 pb-20">

        {/* Sub-header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-base font-medium text-text-primary leading-tight">
              {selectedSub?.name ?? category.name}
            </h2>
            {!isLoadingBooks && (
              <p className="text-[11px] text-text-muted">{books.length} book{books.length !== 1 ? "s" : ""}</p>
            )}
          </div>
        </div>

        {/* Books */}
        {isLoadingBooks ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-black/8" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-text-muted">
            <BookOpen size={32} strokeWidth={1.2} />
            <p className="text-sm text-center">No books in this subcategory yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {books.map((book) => (
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
        )}
      </div>
    </div>
  );
}
