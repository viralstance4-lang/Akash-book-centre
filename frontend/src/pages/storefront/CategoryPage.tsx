import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers3 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getCategories, type Category } from "../../api/categories.api";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn:  getCategories,
  });

  const categories: Category[] = data?.data ?? [];
  const category = categories.find((c) => c.slug === slug);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-black/8 mb-8" />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-black/8" />
          ))}
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <p className="font-serif text-2xl text-text-primary">Category not found</p>
        <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary">
          <ArrowLeft size={14} /> Back to home
        </Link>
      </div>
    );
  }

  const subcategories = category.subcategories.filter((s) => s.isActive);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-text-muted">
        <Link to="/" className="hover:text-text-primary transition-colors">Home</Link>
        <span>/</span>
        <span className="text-text-primary font-medium">{category.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        {category.imageUrl ? (
          <img src={category.imageUrl} alt={category.name}
            className="h-16 w-16 rounded-2xl object-cover shadow-sm ring-1 ring-black/10" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f4efe7] text-text-muted">
            <Layers3 size={24} strokeWidth={1.4} />
          </div>
        )}
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">Browse by</p>
          <h1 className="font-serif text-3xl text-text-primary">{category.name}</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {subcategories.length} subcategor{subcategories.length !== 1 ? "ies" : "y"}
          </p>
        </div>
      </div>

      {subcategories.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-text-muted">
          <Layers3 size={36} strokeWidth={1.2} />
          <p className="text-sm">No subcategories yet.</p>
          <Link to="/" className="mt-2 inline-flex items-center gap-1.5 text-sm hover:text-text-primary transition-colors">
            <ArrowLeft size={13} /> Back to home
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {subcategories.map((sub) => (
            <Link
              key={sub.id}
              to={`/subcategory/${sub.slug}`}
              className="group flex flex-col items-start gap-3 rounded-2xl border border-black/8 bg-[#fbf8f2] p-5 transition-all hover:-translate-y-1 hover:shadow-md hover:border-black/15"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1d1a17]/8 text-text-primary group-hover:bg-[#1d1a17] group-hover:text-white transition-colors">
                <Layers3 size={18} strokeWidth={1.6} />
              </div>
              <div>
                <p className="font-serif text-lg leading-snug text-text-primary group-hover:text-[#1d1a17]">
                  {sub.name}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">Browse books →</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
