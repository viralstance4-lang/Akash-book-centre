import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getFeaturedBooks } from "../../api/featured.api";
import { addToCart, getCart } from "../../api/cart.api";
import BookCard from "../../components/ui/BookCard";
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
        {!isLoading && (
          <p className="mt-1 text-sm text-text-muted">
            {books.length} book{books.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-black/8" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-text-muted rounded-2xl border border-dashed border-black/10 bg-white">
          <BookOpen size={36} strokeWidth={1.2} />
          <p className="font-serif text-xl text-text-primary">No featured books yet</p>
          <p className="text-sm">Check back later or browse all books.</p>
          <Link to="/"
            className="mt-2 inline-flex items-center gap-1.5 text-sm hover:text-text-primary transition-colors">
            <ArrowLeft size={13} /> Back to home
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
  );
}
