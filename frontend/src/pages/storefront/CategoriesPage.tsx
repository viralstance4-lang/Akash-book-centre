import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Layers3 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { addToCart, getCart } from "../../api/cart.api";
import {
  getCategorySections,
  type CategorySectionPublic,
} from "../../api/category-sections.api";
import { getCategories, type Category } from "../../api/categories.api";
import BookCard from "../../components/ui/BookCard";
import { useAuthStore } from "../../store/auth.store";
import type { Book } from "../../types";

// ── Subcategory tile ──────────────────────────────────────────────────────────

function SubcategoryTile({
  id,
  name,
  slug,
  imageUrl,
}: {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
}) {
  return (
    <Link
      key={id}
      to={`/subcategory/${slug}`}
      className="group flex-none w-24 sm:w-28 overflow-hidden rounded-xl border border-black/8 transition-all hover:-translate-y-0.5 hover:border-black/20 hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-[#f4efe7]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen size={18} className="text-text-muted/50" strokeWidth={1.4} />
          </div>
        )}
      </div>
      <div className="px-1.5 py-1.5">
        <p className="font-serif text-[0.6rem] leading-tight text-center text-text-primary">
          {name}
        </p>
      </div>
    </Link>
  );
}

// ── Category tile (fallback) ──────────────────────────────────────────────────

function CategoryTile({
  id,
  name,
  slug,
  imageUrl,
}: {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
}) {
  return (
    <Link
      key={id}
      to={`/category/${slug}`}
      className="group overflow-hidden rounded-xl border border-black/8 transition-all hover:-translate-y-0.5 hover:border-black/15 hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-[#f4efe7]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Layers3 size={20} className="text-text-muted/60" strokeWidth={1.4} />
          </div>
        )}
      </div>
      <div className="px-1.5 py-1.5">
        <p className="font-serif text-[0.65rem] leading-tight text-center text-text-primary">
          {name}
        </p>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient     = useQueryClient();
  const navigate        = useNavigate();

  const { data: sectionsData, isLoading: sectionsLoading } = useQuery({
    queryKey: ["category-sections-public"],
    queryFn:  getCategorySections,
  });

  const { data: categoriesData, isLoading: catsLoading } = useQuery({
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

  const sections: CategorySectionPublic[] = sectionsData?.data ?? [];
  const allCategories: Category[]         = categoriesData?.data ?? [];
  const cartBookIds = new Set(cartData?.data?.items.map((i) => i.bookId) ?? []);
  const addingBookId = addToCartMutation.isPending
    ? (addToCartMutation.variables?.bookId ?? null)
    : null;

  const useSections = sections.length > 0;
  const isLoading   = sectionsLoading || catsLoading;

  const handleAddToCart = (book: Book) => {
    if (!isAuthenticated) { navigate("/login"); return; }
    addToCartMutation.mutate({ bookId: book.id, quantity: 1 });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-black/8" />
        {[1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-5 w-40 animate-pulse rounded-lg bg-black/8" />
            <div className="flex gap-2">
              {Array.from({ length: 6 }).map((_, j) => (
                <div
                  key={j}
                  className="flex-none w-24 aspect-square animate-pulse rounded-xl bg-black/8"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const activeCategories = allCategories.filter((c) => c.isActive);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-text-muted">
        <Link to="/" className="hover:text-text-primary transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="text-text-primary font-medium">Categories</span>
      </nav>

      {/* Header */}
      <div>
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">
          Browse
        </p>
        <h1 className="font-serif text-4xl text-text-primary">All Categories</h1>
      </div>

      {/* ── Sections mode ─────────────────────────────────────────────────── */}
      {useSections ? (
        <div className="space-y-10">
          {sections.map((section) => (
            <div key={section.id} className="space-y-4">
              {/* Section heading */}
              <h2 className="font-serif text-xl text-text-primary border-b border-black/8 pb-2">
                {section.heading}
              </h2>

              {/* Category type: subcategory tiles */}
              {section.contentType === "category" && (
                <>
                  {section.subcategories.length === 0 ? (
                    <p className="text-sm text-text-muted italic">
                      No subcategories selected for this section.
                    </p>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide snap-x">
                      {section.subcategories.map((sc) => (
                        <SubcategoryTile
                          key={sc.id}
                          id={sc.id}
                          name={sc.name}
                          slug={sc.slug}
                          imageUrl={sc.imageUrl}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Manual type: book card grid */}
              {section.contentType === "manual" && (
                <>
                  {section.books.length === 0 ? (
                    <p className="text-sm text-text-muted italic">
                      No books selected for this section.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {section.books.map((b) => (
                        <BookCard
                          key={b.id}
                          book={b as unknown as Book}
                          onAddToCart={handleAddToCart}
                          isAddingToCart={addingBookId === b.id}
                          isInCart={cartBookIds.has(b.id)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* ── Fallback: raw category tiles ─────────────────────────────────── */
        activeCategories.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-text-muted">
            <Layers3 size={36} strokeWidth={1.2} />
            <p className="text-sm">No categories available.</p>
            <Link
              to="/"
              className="mt-2 inline-flex items-center gap-1.5 text-sm hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={13} /> Back to home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 md:grid-cols-4 lg:grid-cols-6">
            {activeCategories.map((c) => (
              <CategoryTile
                key={c.id}
                id={c.id}
                name={c.name}
                slug={c.slug}
                imageUrl={c.imageUrl}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
