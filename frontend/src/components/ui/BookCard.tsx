import { ArrowRight, ShoppingBag } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { Book } from "../../types";

type BookCardProps = {
  book: Book;
  onAddToCart?: (book: Book) => void;
  isAddingToCart?: boolean;
  isInCart?: boolean;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

export default function BookCard({
  book,
  onAddToCart,
  isAddingToCart = false,
  isInCart = false,
}: BookCardProps) {
  const isOutOfStock = book.stock < 1;
  const navigate = useNavigate();

  // Compare price & discount calculation
  const comparePrice = (book as any).comparePrice ? Number((book as any).comparePrice) : null;
  const salePrice = Number(book.price);
  const discountPct = comparePrice && comparePrice > salePrice
    ? Math.round(((comparePrice - salePrice) / comparePrice) * 100)
    : 0;

  const handleOpenBook = () => navigate(`/books/${book.id}`);

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={handleOpenBook}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpenBook(); }
      }}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(42,30,18,0.1)] focus:outline-none focus:ring-2 focus:ring-black/15"
    >
      {/* Image */}
      <div className="relative block overflow-hidden rounded-t-2xl bg-[#efe6d8]">
        <img
          src={book.coverImageUrl}
          alt={book.title}
          className="aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-text-primary">Out of stock</span>
          </div>
        )}

        {/* Genre badge */}
        {book.genre && (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-text-muted backdrop-blur-sm">
            {book.genre.name}
          </span>
        )}

        {/* Discount % badge */}
        {discountPct > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            {discountPct}% OFF
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-3">
        <div className="flex-1">
          <Link
            to={`/books/${book.id}`}
            className="inline-flex items-start gap-1.5 text-text-primary transition-colors hover:text-black"
          >
            <h3 className="line-clamp-2 min-h-[2.5rem] font-serif text-[0.93rem] leading-snug">
              {book.title}
            </h3>
            <ArrowRight size={12} className="mt-1 shrink-0 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
          </Link>
          <p className="mt-0.5 text-[0.7rem] text-text-muted line-clamp-1">{book.author}</p>
        </div>

        {/* Price row */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <p className="font-serif text-[0.9rem] font-medium text-text-primary">
              {formatPrice(salePrice)}
            </p>
            {comparePrice && comparePrice > salePrice && (
              <p className="text-[0.7rem] text-text-muted line-through">
                {formatPrice(comparePrice)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddToCart?.(book); }}
            disabled={!onAddToCart || isAddingToCart || isOutOfStock}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[0.65rem] font-medium text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-55 ${
              isInCart ? "bg-emerald-700 hover:bg-emerald-800" : "bg-[#1d1a17] hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0"
            }`}
          >
            <ShoppingBag size={12} />
            {isAddingToCart ? "Adding..." : isInCart ? "In cart" : "Add"}
          </button>
        </div>
      </div>
    </article>
  );
}
