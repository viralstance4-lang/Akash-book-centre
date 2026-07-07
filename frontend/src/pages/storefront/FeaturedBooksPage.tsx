import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { getFeaturedBooks } from "../../api/featured.api";
import { addToCart, getCart } from "../../api/cart.api";
import ProductListingGrid from "../../components/ui/ProductListingGrid";
import { useAuthStore } from "../../store/auth.store";
import type { Book } from "../../types";

export default function FeaturedBooksPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient     = useQueryClient();
  const navigate        = useNavigate();

  const { data: featuredData, isLoading } = useQuery({
    queryKey: ["featured-books"],
    queryFn:  getFeaturedBooks,
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

  const books: Book[] = (featuredData?.data ?? []) as Book[];
  const cartBookIds   = new Set(cartData?.data?.items.map((i) => i.bookId) ?? []);
  const addingBookId  = addToCartMutation.isPending ? (addToCartMutation.variables?.bookId ?? null) : null;

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
        <span className="text-text-primary font-medium">Featured Books</span>
      </nav>

      {/* Header */}
      <div>
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">Curated picks</p>
        <h1 className="font-serif text-3xl text-text-primary">Featured Books</h1>
      </div>

      <ProductListingGrid
        books={books}
        isLoading={isLoading}
        cartBookIds={cartBookIds}
        onAddToCart={handleAddToCart}
        addingBookId={addingBookId}
        emptyTitle="No featured books yet"
        emptyMessage="Check back later or browse all books."
      />
    </div>
  );
}
