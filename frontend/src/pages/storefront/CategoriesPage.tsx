import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";
import { getCategories, type Category } from "../../api/categories.api";

export default function CategoriesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const categories: Category[] = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-black/8 mb-8" />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-black/8" />
          ))}
        </div>
      </div>
    );
  }

  const activeCategories = categories.filter((c) => c.isActive);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-text-muted">
        <Link to="/" className="hover:text-text-primary transition-colors">Home</Link>
        <span>/</span>
        <span className="text-text-primary font-medium">Categories</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">Browse</p>
        <h1 className="font-serif text-4xl text-text-primary">All Categories</h1>
        <p className="mt-2 text-sm text-text-muted">
          {activeCategories.length} categor{activeCategories.length !== 1 ? "ies" : "y"} available
        </p>
      </div>

      {activeCategories.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-text-muted">
          <Layers3 size={36} strokeWidth={1.2} />
          <p className="text-sm">No categories available.</p>
          <Link to="/" className="mt-2 inline-flex items-center gap-1.5 text-sm hover:text-text-primary transition-colors">
            <ArrowLeft size={13} /> Back to home
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {activeCategories.map((category) => (
            <Link
              key={category.id}
              to={`/category/${category.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-black/8 transition-all hover:-translate-y-1 hover:border-black/15 hover:shadow-md"
            >
              <div className="aspect-square w-full overflow-hidden bg-[#f4efe7]">
                {category.imageUrl ? (
                  <img
                    src={category.imageUrl}
                    alt={category.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Layers3 size={32} className="text-text-muted/60" strokeWidth={1.4} />
                  </div>
                )}
              </div>
              {category.imageUrl && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent pointer-events-none" />
              )}
              <div className={`${category.imageUrl ? "absolute bottom-0 left-0 right-0 px-4 pb-4" : "relative px-4 py-4"}`}>
                <p className={`font-serif text-lg leading-tight ${
                  category.imageUrl ? "text-white drop-shadow-sm" : "text-text-primary"
                }`}>
                  {category.name}
                </p>
                {!category.imageUrl && (
                  <p className="mt-1 text-xs text-text-muted">Browse subcategories →</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
