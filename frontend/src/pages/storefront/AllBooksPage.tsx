import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { getBooks } from "../../api/books.api";
import { addToCart, getCart } from "../../api/cart.api";
import ProductListingGrid from "../../components/ui/ProductListingGrid";
import { useAuthStore } from "../../store/auth.store";
import type { Book } from "../../types";

export default function AllBooksPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient     = useQueryClient();
  const navigate        = useNavigate();

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

  const allBooks: Book[] = booksData?.data?.books ?? [];
  const cartBookIds      = new Map(cartData?.data?.items.map((i) => [i.bookId, i.quantity]) ?? []);
  const addingBookId     = addToCartMutation.isPending ? (addToCartMutation.variables?.bookId ?? null) : null;

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
      <h1 className="font-serif text-3xl text-text-primary">All Books</h1>

      <ProductListingGrid
        books={allBooks}
        isLoading={isLoading}
        cartBookIds={cartBookIds}
        onAddToCart={handleAddToCart}
        addingBookId={addingBookId}
        emptyTitle="No products found"
        emptyMessage="Check back later for new arrivals."
      />
    </div>
  );
}
