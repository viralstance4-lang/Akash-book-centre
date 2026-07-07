import { Layers3 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCategories, type Category } from "../../api/categories.api";

interface Props {
  activeCategorySlug?: string;
}

export default function CategorySidebar({ activeCategorySlug }: Props) {
  const { data: catsData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const categories: Category[] = (catsData?.data ?? []).filter((c) => c.isActive);

  return (
    <aside className="w-[60px] sm:w-[72px] shrink-0 sticky top-[125px] sm:top-16 self-start max-h-[calc(100vh-125px)] sm:max-h-[calc(100vh-4rem)] overflow-y-auto border-r border-gray-100 bg-white scrollbar-none z-10">
      {categories.map((cat) => {
        const active = cat.slug === activeCategorySlug;
        return (
          <Link
            key={cat.id}
            to={`/category/${cat.slug}`}
            className={`flex flex-col items-center gap-0.5 px-1 py-2.5 border-l-[3px] transition-colors ${
              active
                ? "border-red-500 bg-red-50/70"
                : "border-transparent hover:bg-gray-50"
            }`}
          >
            <div className="h-10 w-10 rounded-xl overflow-hidden bg-[#f4efe7] shrink-0 flex items-center justify-center">
              {cat.imageUrl ? (
                <img src={cat.imageUrl} alt={cat.name} className="h-full w-full object-cover" />
              ) : (
                <Layers3 size={15} className="text-text-muted/50" strokeWidth={1.4} />
              )}
            </div>
            <span className={`text-[8px] leading-tight text-center break-words w-full px-0.5 mt-0.5 ${
              active ? "text-red-500 font-semibold" : "text-gray-500"
            }`}>
              {cat.name}
            </span>
          </Link>
        );
      })}
    </aside>
  );
}
