import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Book } from "../../types";
import BookCard from "./BookCard";

type Props = {
  books: Book[];
  onAddToCart: (book: Book) => void;
  cartBookIds: Set<string>;
  addingBookId?: string | null;
};

export default function BookSlider({ books, onAddToCart, cartBookIds, addingBookId }: Props) {
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
  }, [books]);

  const scroll = (dir: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -el.clientWidth : el.clientWidth, behavior: "smooth" });
  };

  if (!books.length) return null;

  return (
    <div className="relative">
      {/* Left arrow */}
      {canLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          className="absolute left-0 top-[40%] z-10 -translate-y-1/2 -translate-x-1 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/10 text-text-primary transition-all hover:bg-[#f4efe7] hover:scale-105"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      {/*
       * Scrollable track
       * Mobile  : 3 cards visible  — w-[calc(33.33%-8px)]
       * Tablet  : 4 cards visible  — sm:w-[calc(25%-9px)]
       * Desktop : 6 cards visible  — lg:w-[calc(16.67%-10px)]
       */}
      <div
        ref={trackRef}
        className="flex gap-3 overflow-x-auto scrollbar-none scroll-smooth px-0.5 py-1"
      >
        {books.map((book) => (
          <div
            key={book.id}
            className="shrink-0 w-[calc(33.33%-8px)] sm:w-[calc(25%-9px)] lg:w-[calc(16.67%-10px)]"
          >
            <BookCard
              book={book}
              onAddToCart={onAddToCart}
              isInCart={cartBookIds.has(book.id)}
              isAddingToCart={addingBookId === book.id}
            />
          </div>
        ))}
      </div>

      {/* Right arrow */}
      {canRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          className="absolute right-0 top-[40%] z-10 -translate-y-1/2 translate-x-1 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/10 text-text-primary transition-all hover:bg-[#f4efe7] hover:scale-105"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}
