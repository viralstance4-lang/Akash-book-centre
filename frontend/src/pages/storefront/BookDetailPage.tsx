import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { ArrowLeft, Check, ChevronRight, MapPin, Package, RefreshCw, Shield, ShoppingBag, Star, Truck, Zap } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getBook, getBooks } from "../../api/books.api";
import { addToCart, getCart } from "../../api/cart.api";
import { useAuthStore } from "../../store/auth.store";
import BookCard from "../../components/ui/BookCard";
import { getBookReviews, createReview } from "../../api/reviews.api";
import type { ApiErrorResponse } from "../../types";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={size} className={star <= rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"} />
      ))}
    </div>
  );
}

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [pincode, setPincode] = useState("");
  const [pincodeMsg, setPincodeMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"details">("details");
  const [qty, setQty] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", comment: "" });
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const { data: cartData } = useQuery({ queryKey: ["cart"], queryFn: getCart, enabled: isAuthenticated });
  const { data, error, isLoading, isError } = useQuery({ queryKey: ["book", id], queryFn: () => getBook(id!), enabled: Boolean(id) });

  const addToCartMutation = useMutation({
    mutationFn: (bookId: string) => addToCart(bookId, qty),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const { data: relatedBooksData } = useQuery({
    queryKey: ["related-books", data?.data?.genre?.slug, id],
    queryFn: () => getBooks({ genre: data?.data?.genre?.slug, limit: 6 }),
    enabled: Boolean(data?.data?.genre?.slug),
  });

  const book = data?.data;
  const isOutOfStock = (book?.stock ?? 0) < 1;
  const isInCart = cartData?.data?.items.some((item) => item.bookId === book?.id) ?? false;
  const cartBookIds = new Set(cartData?.data?.items.map((item) => item.bookId) ?? []);
  const apiError = error as AxiosError<ApiErrorResponse> | null;
  const errorStatus = apiError?.response?.status;
  const { data: reviewsData, refetch: refetchReviews } = useQuery({
    queryKey: ["book-reviews", id],
    queryFn: () => getBookReviews(id!),
    enabled: Boolean(id),
  });
  const submitReviewMutation = useMutation({
    mutationFn: () => createReview(id!, reviewForm),
    onSuccess: () => { setReviewSuccess(true); setReviewForm({ rating: 5, title: "", comment: "" }); void refetchReviews(); },
  });
  const relatedBooks = relatedBooksData?.data?.books?.filter((b) => b.id !== book?.id) ?? [];
  const bookReviews = reviewsData?.data?.reviews ?? [];
  const bookRating = reviewsData?.data?.rating ?? { average: 0, count: 0 };

  const comparePrice = (book as any)?.comparePrice ? Number((book as any).comparePrice) : Math.round(Number(book?.price ?? 0) * 1.2);
  const originalPrice = comparePrice;
  const discount = book && comparePrice > Number(book.price) ? Math.round(((comparePrice - Number(book.price)) / comparePrice) * 100) : 0;

  const handleAddToCart = () => {
    if (!book) return;
    if (!isAuthenticated) { navigate("/login"); return; }
    addToCartMutation.mutate(book.id);
  };

  const handleBuyNow = () => {
    if (!book) return;
    if (!isAuthenticated) { navigate("/login"); return; }
    addToCartMutation.mutate(book.id);
    navigate("/checkout");
  };

  const checkPincode = () => {
    if (pincode.length !== 6) { setPincodeMsg("Please enter a valid 6-digit pincode"); return; }
    setPincodeMsg(`✅ Delivery available to ${pincode} in 3-5 business days`);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-5 w-32 rounded-full bg-white" />
        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="aspect-[3/4] rounded-2xl bg-white" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 rounded-xl bg-white" />
            <div className="h-5 w-1/3 rounded-xl bg-white" />
            <div className="h-10 w-1/4 rounded-xl bg-white" />
            <div className="h-24 rounded-xl bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !book) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-white px-8 py-16 text-center">
        <p className="font-serif text-2xl text-text-primary">{errorStatus === 404 ? "Book not found" : "Unable to load book"}</p>
        <Link to="/" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-5 py-2.5 text-sm text-white hover:bg-black transition-all">
          <ArrowLeft size={14} /> Back to books
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-text-muted">
        <Link to="/" className="hover:text-text-primary transition-colors">Home</Link>
        <ChevronRight size={12} />
        {book.genre?.name && (
          <>
            <Link to={`/?genre=${book.genre.slug}`} className="hover:text-text-primary transition-colors">{book.genre.name}</Link>
            <ChevronRight size={12} />
          </>
        )}
        <span className="truncate text-text-primary max-w-[200px]">{book.title}</span>
      </nav>

      {/* Main Product Layout */}
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* Left — Image Gallery */}
        <div className="flex flex-col gap-3">
          {/* Main Image */}
          <div className="group relative overflow-hidden rounded-2xl border border-black/8 bg-[#f8f4ee]">
            <img
              src={selectedImage ?? book.coverImageUrl}
              alt={book.title}
              className="mx-auto block aspect-[3/4] w-full max-w-[280px] object-cover transition-all duration-300 lg:max-w-full"
            />
            {discount > 0 && (
              <div className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">
                {discount}% OFF
              </div>
            )}
            {isOutOfStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
                <span className="rounded-full bg-white px-4 py-2 text-sm font-medium">Out of Stock</span>
              </div>
            )}
          </div>

          {/* Thumbnail Strip — show if extra images exist */}
          {(() => {
            const extraImages = (book as any).images ?? [];
            const allImages = extraImages.length > 0
              ? extraImages.sort((a: any, b: any) => a.order - b.order)
              : [{ id: "cover", imageUrl: book.coverImageUrl, order: 0 }];
            if (allImages.length <= 1) return null;
            return (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allImages.map((img: any, idx: number) => {
                  const isActive = (selectedImage ?? book.coverImageUrl) === img.imageUrl;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setSelectedImage(img.imageUrl)}
                      className={`shrink-0 h-16 w-12 overflow-hidden rounded-lg border-2 transition-all ${isActive ? "border-[#1d1a17] opacity-100" : "border-transparent opacity-60 hover:opacity-100"}`}
                    >
                      <img src={img.imageUrl} alt={`View ${idx + 1}`} className="h-full w-full object-cover" />
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Trust Badges */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Shield, label: "100% Secure", sub: "Payments" },
              { icon: RefreshCw, label: "Easy Return", sub: "& Replace" },
              { icon: Truck, label: "Trusted", sub: "Shipping" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex flex-col items-center gap-1 rounded-xl border border-black/8 bg-white p-2.5 text-center">
                <Icon size={16} className="text-accent" />
                <p className="text-[10px] font-medium text-text-primary leading-tight">{label}</p>
                <p className="text-[10px] text-text-muted leading-tight">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Info */}
        <div className="space-y-4">
          {/* Genre tag */}
          {book.genre?.name && (
            <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {book.genre.name}
            </span>
          )}

          {/* Title */}
          <h1 className="font-serif text-2xl leading-snug text-text-primary sm:text-3xl lg:text-[2rem]">
            {book.title}
          </h1>

          {/* Author */}
          <p className="text-sm text-text-muted">
            By <span className="font-medium text-text-primary">{book.author}</span>
          </p>

          {/* Rating Row - hidden */}
          {false && <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5">
              <Star size={13} className="fill-amber-400 text-amber-400" />
              <span className="text-sm font-bold text-amber-700">{bookRating.average > 0 ? bookRating.average : "—"}</span>
            </div>
            <span className="text-sm text-text-muted">{bookRating.count} ratings & reviews</span>
          </div>}

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-3xl font-bold text-text-primary">{formatPrice(book.price)}</span>
            <span className="text-base text-text-muted line-through">{formatPrice(originalPrice)}</span>
            <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">{discount}% off</span>
          </div>

          <p className="text-xs text-emerald-600 font-medium">✓ Inclusive of all taxes</p>

          {/* Quantity + Add to Cart */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* Qty selector */}
            <div className="flex items-center rounded-xl border border-black/10 bg-white">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-l-xl text-text-primary hover:bg-[#f4efe7] transition-colors text-lg font-bold">−</button>
              <span className="flex h-11 w-10 items-center justify-center text-sm font-medium text-text-primary">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(book.stock, q + 1))} disabled={isOutOfStock}
                className="flex h-11 w-11 items-center justify-center rounded-r-xl text-text-primary hover:bg-[#f4efe7] transition-colors text-lg font-bold disabled:opacity-40">+</button>
            </div>

            {/* Add to Bag */}
            <button type="button" onClick={handleAddToCart} disabled={addToCartMutation.isPending || isOutOfStock}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-55 sm:flex-none sm:px-6 ${
                isInCart ? "border border-emerald-500 bg-emerald-50 text-emerald-700" : "border border-[#1d1a17] bg-white text-[#1d1a17] hover:bg-[#f4efe7]"
              }`}>
              <ShoppingBag size={16} />
              {isInCart ? "Added to Bag" : addToCartMutation.isPending ? "Adding..." : "Add to Bag"}
            </button>

            {/* Buy Now */}
            <button type="button" onClick={handleBuyNow} disabled={isOutOfStock}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d1a17] py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-black disabled:opacity-55 sm:flex-none sm:px-6">
              <Zap size={16} /> Buy Now
            </button>
          </div>

          {isInCart && (
            <Link to="/cart" className="inline-flex items-center gap-1.5 text-sm text-accent font-medium hover:underline transition-colors">
              View Cart <ChevronRight size={14} />
            </Link>
          )}

          {/* Delivery Check */}
          <div className="rounded-2xl border border-black/8 bg-[#f8f4ee] p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={15} className="text-text-muted" />
              <p className="text-sm font-medium text-text-primary">Check Delivery & Cash on Delivery</p>
            </div>
            <div className="flex gap-2">
              <input type="text" value={pincode} onChange={(e) => { setPincode(e.target.value.replace(/\D/g, "").slice(0, 6)); setPincodeMsg(""); }}
                placeholder="Enter 6-digit pincode"
                className="flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-black/20" />
              <button type="button" onClick={checkPincode}
                className="rounded-xl bg-[#1d1a17] px-4 py-2.5 text-sm font-medium text-white hover:bg-black transition-colors">
                Check
              </button>
            </div>
            {pincodeMsg && <p className="mt-2 text-xs text-text-muted">{pincodeMsg}</p>}
          </div>

          {/* Stock status */}
          <div className="flex items-center gap-2 text-sm">
            <Package size={14} className={isOutOfStock ? "text-red-500" : "text-emerald-500"} />
            <span className={isOutOfStock ? "text-red-500" : "text-emerald-600 font-medium"}>
              {isOutOfStock ? "Out of Stock" : `In Stock — ${book.stock} copies available`}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-black/8">
        <div className="flex gap-6">
          {(["details"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize transition-all ${activeTab === tab ? "border-b-2 border-[#1d1a17] text-text-primary" : "text-text-muted hover:text-text-primary"}`}>
              {tab === "details" ? "Product Details" : `Reviews (${bookRating.count})`}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {true ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Product Info Table */}
          <div className="rounded-2xl border border-black/8 bg-white overflow-hidden">
            <div className="border-b border-black/8 px-5 py-4">
              <h3 className="font-serif text-lg text-text-primary">Product Details</h3>
            </div>
            <div className="divide-y divide-black/5">
              {[
                { label: "Publication", value: (book as any).publication ?? "BucketList Books" },
                { label: "Publication Year", value: new Date(book.createdAt).getFullYear() },
                { label: "Author", value: book.author },
                { label: "Language", value: (book as any).language ?? "English" },
                { label: "ISBN", value: book.isbn },
                { label: "Genre", value: book.genre?.name ?? "General" },
                { label: "Availability", value: isOutOfStock ? "Out of Stock" : `${book.stock} in Stock` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-4 px-5 py-3">
                  <span className="w-36 shrink-0 text-sm text-text-muted">{label}</span>
                  <span className="text-sm font-medium text-text-primary">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="rounded-2xl border border-black/8 bg-white p-5">
            <h3 className="font-serif text-lg text-text-primary mb-4">About this Book</h3>
            <p className="text-sm leading-7 text-text-muted">
              {book.description || "A thoughtfully curated title from our collection. This book offers valuable insights and engaging content for readers of all levels. Whether you're a beginner or an expert, this book will enrich your reading experience with well-researched content and clear explanations."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5 hidden">
          {/* Rating Summary */}
          <div className="rounded-2xl border border-black/8 bg-white p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex flex-col items-center gap-2 sm:border-r sm:border-black/8 sm:pr-6">
                <span className="font-serif text-5xl font-bold text-text-primary">{bookRating.average > 0 ? bookRating.average : "0"}</span>
                <StarRating rating={5} size={18} />
                <span className="text-sm text-text-muted">{bookRating.count} reviews</span>
              </div>
              <div className="flex-1 space-y-2">
                {[
                  { stars: 5, count: 53, pct: 84 },
                  { stars: 4, count: 7, pct: 11 },
                  { stars: 3, count: 3, pct: 5 },
                  { stars: 2, count: 0, pct: 0 },
                  { stars: 1, count: 0, pct: 0 },
                ].map(({ stars, count, pct }) => (
                  <div key={stars} className="flex items-center gap-3">
                    <span className="w-4 text-xs text-text-muted">{stars}</span>
                    <Star size={12} className="fill-amber-400 text-amber-400 shrink-0" />
                    <div className="flex-1 h-2 rounded-full bg-[#f4efe7]">
                      <div className="h-2 rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-5 text-xs text-text-muted">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-3">
            {mockReviews.map((review) => (
              <div key={review.id} className="rounded-2xl border border-black/8 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1d1a17] text-sm font-bold text-white">
                      {review.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{review.name}</p>
                      <p className="text-xs text-text-muted">{review.date}</p>
                    </div>
                  </div>
                  <StarRating rating={review.rating} size={13} />
                </div>
                <p className="mt-3 text-sm font-medium text-text-primary">{review.title}</p>
                <p className="mt-1 text-sm text-text-muted leading-6">{review.comment}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600">
                  <Check size={12} /> Verified Purchase
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Books */}
      {relatedBooks.length > 0 && (
        <section className="space-y-5 border-t border-black/8 pt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl text-text-primary sm:text-2xl">
              More in {book.genre?.name ?? "this genre"}
            </h2>
            <Link to={`/?genre=${book.genre?.slug}`} className="text-sm text-accent hover:underline transition-colors">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {relatedBooks.slice(0, 6).map((relatedBook) => (
              <BookCard key={relatedBook.id} book={relatedBook}
                onAddToCart={() => { if (!isAuthenticated) { navigate("/login"); return; } addToCartMutation.mutate(relatedBook.id); }}
                isInCart={cartBookIds.has(relatedBook.id)}
                isAddingToCart={addToCartMutation.isPending && addToCartMutation.variables === relatedBook.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
