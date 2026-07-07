import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getCategorySectionWithBooks } from "../../api/category-sections.api";
import { addToCart, getCart } from "../../api/cart.api";
import BookCard from "../../components/ui/BookCard";
import { useAuthStore } from "../../store/auth.store";
import type { Book } from "../../types";

export default function SectionBooksPage() {
  const { id } = useParams<{ id: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["section-books", id],
    queryFn: () => getCategorySectionWithBooks(id!),
    enabled: !!id,
  });

  const { data: cartData } = useQuery({
    queryKey: ["cart"],
    queryFn: getCart,
    enabled: isAuthenticated,
  });

  const addToCartMutation = useMutation({
    mutationFn: ({ bookId, quantity }: { bookId: string; quantity: number }) =>
      addToCart(bookId, quantity),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const section = data?.data;
  const books: Book[] = (section?.books ?? []) as Book[];
  const cartBookIds = new Set(cartData?.data?.items.map((i) => i.bookId) ?? []);
  const addingBookId = addToCartMutation.isPending
    ? (addToCartMutation.variables?.bookId ?? null)
    : null;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-8 w-56 animate-pulse rounded-xl bg-black/8 mb-8" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-black/8" />
          ))}
        </div>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center text-text-muted">
        <p className="text-sm">Section not found.</p>
        <Link to="/categories" className="mt-3 inline-flex items-center gap-1.5 text-sm hover:text-text-primary transition-colors">
          <ArrowLeft size={13} /> Back to Categories
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-text-muted">
        <Link to="/" className="hover:text-text-primary transition-colors">Home</Link>
        <span>/</span>
        <Link to="/categories" className="hover:text-text-primary transition-colors">Categories</Link>
        <span>/</span>
        <span className="text-text-primary font-medium">{section.heading}</span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex items-end gap-4">
        {section.imageUrl && (
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
            <img src={section.imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">Browse</p>
          <h1 className="font-serif text-4xl text-text-primary">{section.heading}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {books.length} book{books.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {books.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-text-muted">
          <BookOpen size={36} strokeWidth={1.2} />
          <p className="text-sm">No books in this section yet.</p>
          <Link to="/categories" className="mt-2 inline-flex items-center gap-1.5 text-sm hover:text-text-primary transition-colors">
            <ArrowLeft size={13} /> Back to Categories
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onAddToCart={() => addToCartMutation.mutate({ bookId: book.id, quantity: 1 })}
              isAddingToCart={addingBookId === book.id}
              isInCart={cartBookIds.has(book.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
