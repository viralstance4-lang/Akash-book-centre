import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getBooks } from "../../api/books.api";
import { getCategories, type Category } from "../../api/categories.api";
import { addToCart, getCart } from "../../api/cart.api";
import BookCard from "../../components/ui/BookCard";
import { useAuthStore } from "../../store/auth.store";
import type { Book } from "../../types";

export default function SubcategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient     = useQueryClient();

  // Find which category owns this subcategory
  const { data: catsData } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const categories: Category[] = catsData?.data ?? [];

  let categorySlug: string | undefined;
  let subcategoryName = "";
  let categoryName    = "";
  for (const cat of categories) {
    const sub = cat.subcategories.find((s) => s.slug === slug);
    if (sub) {
      categorySlug    = cat.slug;
      categoryName    = cat.name;
      subcategoryName = sub.name;
      break;
    }
  }

  const { data: booksData, isLoading } = useQuery({
    queryKey: ["books-subcategory", slug],
    queryFn:  () => getBooks({ subcategory: slug, limit: 100 }),
    enabled:  !!slug,
  });

  const { data: cartData } = useQuery({
    queryKey: ["cart"],
    queryFn:  getCart,
    enabled:  isAuthenticated,
  });

  const addToCartMutation = useMutation({
    mutationFn: ({ bookId, quantity }: { bookId: string; quantity: number }) => addToCart(bookId, quantity),
    onSuccess:  () => void queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const books: Book[]  = booksData?.data?.books ?? [];
  const cartBookIds    = new Set(cartData?.data?.items.map((i) => i.bookId) ?? []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-text-muted">
        <Link to="/" className="hover:text-text-primary transition-colors">Home</Link>
        <span>/</span>
        {categorySlug ? (
          <Link to={`/category/${categorySlug}`} className="hover:text-text-primary transition-colors">
            {categoryName}
          </Link>
        ) : (
          <span>Category</span>
        )}
        <span>/</span>
        <span className="text-text-primary font-medium">{subcategoryName || slug}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">
          {categoryName && `${categoryName} › `}Books
        </p>
        <h1 className="font-serif text-3xl text-text-primary">{subcategoryName || slug}</h1>
        {!isLoading && (
          <p className="mt-1 text-sm text-text-muted">
            {books.length} book{books.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-black/8" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-text-muted">
          <BookOpen size={36} strokeWidth={1.2} />
          <p className="text-sm">No books in this subcategory yet.</p>
          {categorySlug && (
            <Link to={`/category/${categorySlug}`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm hover:text-text-primary transition-colors">
              <ArrowLeft size={13} /> Back to {categoryName}
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              isInCart={cartBookIds.has(book.id)}
              onAddToCart={isAuthenticated
                ? (b) => addToCartMutation.mutate({ bookId: b.id, quantity: 1 })
                : undefined}
              isAddingToCart={addToCartMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
