import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";
import type { CategorySectionItem } from "../../utils/sectionLinks";

type Props = {
  categories: CategorySectionItem[];
};

export default function CategorySlider({ categories }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(false);

  const syncButtons = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    syncButtons();
    const ro = new ResizeObserver(syncButtons);
    ro.observe(el);
    el.addEventListener("scroll", syncButtons, { passive: true });
    return () => {
      el.removeEventListener("scroll", syncButtons);
      ro.disconnect();
    };
  }, [categories]);

  const scroll = (dir: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -el.clientWidth : el.clientWidth, behavior: "smooth" });
  };

  if (!categories.length) return null;

  return (
    <div className="relative">
      {/* Left arrow */}
      {canLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 -translate-x-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/10 text-text-primary transition-all hover:bg-[#f4efe7] hover:scale-105 sm:h-9 sm:w-9"
        >
          <ChevronLeft size={16} />
        </button>
      )}

      {/* Scrollable track */}
      <div
        ref={trackRef}
        className="flex gap-2 overflow-x-auto scrollbar-none scroll-smooth px-0.5 py-1"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {categories.map((cat) => (
          <Link
            key={cat.id}
            to={cat.href}
            style={{ scrollSnapAlign: "start" }}
            className={[
              "shrink-0",
              "w-[calc(25%-6px)] sm:w-[calc(20%-6px)] lg:w-[calc(14.28%-6px)]",
              "group overflow-hidden rounded-2xl border border-black/8",
              "transition-all hover:-translate-y-0.5 hover:border-black/20 hover:shadow-sm",
            ].join(" ")}
          >
            <div className="aspect-square w-full overflow-hidden">
              {cat.imageUrl ? (
                <img
                  src={cat.imageUrl}
                  alt={cat.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#f4efe7]">
                  <Layers3 size={22} className="text-text-muted/60" strokeWidth={1.4} />
                </div>
              )}
            </div>
            <div className="px-1.5 pb-2 pt-1.5">
              <p className="truncate text-[10px] font-semibold leading-tight text-center text-text-primary sm:text-[11px]">
                {cat.name}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Right arrow */}
      {canRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/10 text-text-primary transition-all hover:bg-[#f4efe7] hover:scale-105 sm:h-9 sm:w-9"
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
