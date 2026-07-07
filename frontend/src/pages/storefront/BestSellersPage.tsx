import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { getFeaturedBooks } from "../../api/featured.api";
import { getBooks } from "../../api/books.api";
import { addToCart, getCart } from "../../api/cart.api";
import ProductListingGrid from "../../components/ui/ProductListingGrid";
import { useAuthStore } from "../../store/auth.store";
import type { Book } from "../../types";

export default function BestSellersPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient     = useQueryClient();
  const navigate        = useNavigate();

  const { data: featuredData, isLoading: featuredLoading } = useQuery({
    queryKey: ["featured-books"],
    queryFn:  getFeaturedBooks,
  });

  const featuredBooks = (featuredData?.data ?? []) as Book[];

  // Fall back to books flagged as featured when no curated best-seller list exists yet
  const { data: allBooksData, isLoading: allBooksLoading } = useQuery({
    queryKey: ["books", { page: 1, limit: 500 }],
    queryFn:  () => getBooks({ page: 1, limit: 500 }),
    enabled:  !featuredLoading && featuredBooks.length === 0,
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

  const isLoading = featuredLoading || (featuredBooks.length === 0 && allBooksLoading);
  const books: Book[] = featuredBooks.length > 0
    ? featuredBooks
    : (allBooksData?.data?.books ?? []).filter((b) => b.isFeatured);

  const cartBookIds = new Set(cartData?.data?.items.map((i) => i.bookId) ?? []);

  const handleAddToCart = (book: Book) => {
    if (!isAuthenticated) { navigate("/login"); return; }
    addToCartMutation.mutate({ bookId: book.id, quantity: 1 });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-text-muted">
        <Link to="/" className="hover:text-text-primary transition-colors">Home</Link>
        <span>/</span>
        <span className="text-text-primary font-medium">Best Sellers</span>
      </nav>

      {/* Header */}
      <div>
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">Most loved</p>
        <h1 className="font-serif text-3xl text-text-primary">Best Sellers</h1>
      </div>

      <ProductListingGrid
        books={books}
        isLoading={isLoading}
        cartBookIds={cartBookIds}
        onAddToCart={handleAddToCart}
        addingBookId={addToCartMutation.isPending ? (addToCartMutation.variables?.bookId ?? null) : null}
        emptyTitle="No best sellers yet"
        emptyMessage="Check back later or browse all books."
      />
    </div>
  );
}
