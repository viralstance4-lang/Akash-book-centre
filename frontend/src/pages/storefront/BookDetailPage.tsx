import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Package, RefreshCw, Shield, ShoppingBag, Star, Truck, Zap } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getBook, getBooks } from "../../api/books.api";
import { addToCart, getCart } from "../../api/cart.api";
import { createReview, getBookReviews } from "../../api/reviews.api";
import { getSettings } from "../../api/settings.api";
import { useAuthStore } from "../../store/auth.store";
import BookCard from "../../components/ui/BookCard";
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
  const [activeTab, setActiveTab] = useState<"details" | "reviews">("details");
  const [qty, setQty] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bindingType, setBindingType] = useState<"NONE" | "SPIRAL" | "STAPLE">("NONE");
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", comment: "" });
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [cartError, setCartError] = useState("");

  const { data: cartData } = useQuery({ queryKey: ["cart"], queryFn: getCart, enabled: isAuthenticated });
  const { data, error, isLoading, isError } = useQuery({ queryKey: ["book", id], queryFn: () => getBook(id!), enabled: Boolean(id) });
  const { data: settingsData } = useQuery({ queryKey: ["site-settings"], queryFn: getSettings });
  const spiralBindingPrice = Number(settingsData?.data?.spiralBindingPrice ?? 30);

  const { data: reviewsData, refetch: refetchReviews } = useQuery({
    queryKey: ["book-reviews", id],
    queryFn: () => getBookReviews(id!),
    enabled: Boolean(id),
  });

  const addToCartMutation = useMutation({
    mutationFn: (bookId: string) => addToCart(bookId, qty, bindingType),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["cart"] }); setCartError(""); },
    onError: (error: any) => setCartError(error?.response?.data?.message ?? "Failed to add to cart. Please try again."),
  });

  const submitReviewMutation = useMutation({
    mutationFn: () => createReview(id!, reviewForm),
    onSuccess: () => {
      setReviewSuccess(true);
      setReviewForm({ rating: 5, title: "", comment: "" });
      void refetchReviews();
    },
  });

  const { data: relatedBooksData } = useQuery({
    queryKey: ["related-books", data?.data?.category?.slug, id],
    queryFn: () => getBooks({ category: data?.data?.category?.slug, limit: 6 }),
    enabled: Boolean(data?.data?.category?.slug),
  });

  const book = data?.data;
  const isOutOfStock = (book?.stock ?? 0) < 1;
  const isInCart = cartData?.data?.items.some((item) => item.bookId === book?.id) ?? false;
  const cartBookIds = new Set(cartData?.data?.items.map((item) => item.bookId) ?? []);
  const apiError = error as AxiosError<ApiErrorResponse> | null;
  const errorStatus = apiError?.response?.status;
  const relatedBooks = relatedBooksData?.data?.books?.filter((b) => b.id !== book?.id) ?? [];
  const bookReviews = reviewsData?.data?.reviews ?? [];
  const bookRating = reviewsData?.data?.rating ?? { average: 0, count: 0 };

  const comparePrice = (book as any)?.comparePrice ? Number((book as any).comparePrice) : Math.round(Number(book?.price ?? 0) * 1.2);
  const originalPrice = comparePrice;
  const discount = book && comparePrice > Number(book.price) ? Math.round(((comparePrice - Number(book.price)) / comparePrice) * 100) : 0;
  const bindingExtra = bindingType === "SPIRAL" ? spiralBindingPrice : 0;
  const effectivePrice = Number(book?.price ?? 0) + bindingExtra;

  const handleAddToCart = () => {
    if (!book) return;
    if (!isAuthenticated) { navigate("/login"); return; }
    addToCartMutation.mutate(book.id);
  };

  const handleBuyNow = async () => {
    if (!book) return;
    if (!isAuthenticated) { navigate("/login"); return; }
    try {
      await addToCartMutation.mutateAsync(book.id);
      navigate("/checkout");
    } catch { /* error shown via addToCartMutation.error */ }
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
        {book.category?.name && (
          <>
            <Link to={`/category/${book.category.slug}`} className="hover:text-text-primary transition-colors">{book.category.name}</Link>
            <ChevronRight size={12} />
          </>
        )}
        <span className="truncate text-text-primary max-w-[200px]">{book.title}</span>
      </nav>

      {/* Main Product Layout */}
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* Left — Image Gallery */}
        <div className="flex flex-col gap-3">
          {(() => {
            // Build full image list: cover first (if not already in BookImage records), then rest sorted by order
            const bookImages: { id: string; imageUrl: string; order: number }[] = (book as any).images ?? [];
            const sorted = [...bookImages].sort((a, b) => a.order - b.order);
            const coverAlreadyIncluded = sorted.some((img) => img.imageUrl === book.coverImageUrl);
            const allImages = coverAlreadyIncluded
              ? sorted
              : [{ id: "cover", imageUrl: book.coverImageUrl, order: -1 }, ...sorted];

            const safeIndex = Math.min(currentIndex, allImages.length - 1);
            const activeUrl = allImages[safeIndex]?.imageUrl ?? book.coverImageUrl;

            const prev = () => setCurrentIndex((i) => (i === 0 ? allImages.length - 1 : i - 1));
            const next = () => setCurrentIndex((i) => (i === allImages.length - 1 ? 0 : i + 1));

            return (
              <>
                {/* Main image */}
                <div className="group relative overflow-hidden rounded-2xl border border-black/8 bg-[#f8f4ee]">
                  <img
                    key={activeUrl}
                    src={activeUrl}
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
                  {/* Prev / Next arrows — only when multiple images */}
                  {allImages.length > 1 && (
                    <>
                      <button
                        type="button" onClick={prev}
                        className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-md backdrop-blur-sm transition hover:bg-white hover:scale-110"
                        aria-label="Previous image"
                      >
                        <ChevronLeft size={16} className="text-[#1d1a17]" />
                      </button>
                      <button
                        type="button" onClick={next}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-md backdrop-blur-sm transition hover:bg-white hover:scale-110"
                        aria-label="Next image"
                      >
                        <ChevronRight size={16} className="text-[#1d1a17]" />
                      </button>
                      {/* Dot indicators */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {allImages.map((_, i) => (
                          <button
                            key={i} type="button"
                            onClick={() => setCurrentIndex(i)}
                            className={`h-1.5 rounded-full transition-all ${i === safeIndex ? "w-4 bg-[#1d1a17]" : "w-1.5 bg-[#1d1a17]/30 hover:bg-[#1d1a17]/60"}`}
                            aria-label={`Go to image ${i + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Thumbnail Strip — all images, no limit */}
                {allImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {allImages.map((img, idx) => (
                      <button
                        key={img.id} type="button"
                        onClick={() => setCurrentIndex(idx)}
                        className={`shrink-0 h-16 w-12 overflow-hidden rounded-lg border-2 transition-all duration-200 ${idx === safeIndex ? "border-[#1d1a17] opacity-100 scale-105" : "border-transparent opacity-55 hover:opacity-90 hover:scale-105"}`}
                      >
                        <img src={img.imageUrl} alt={`View ${idx + 1}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </>
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
          {/* Category tag */}
          {book.category?.name && (
            <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {book.category.name}
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

          {/* Rating Row */}
          {bookRating.count > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                <span className="text-sm font-bold text-amber-700">{bookRating.average}</span>
              </div>
              <span className="text-sm text-text-muted">{bookRating.count} ratings & reviews</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-3xl font-bold text-text-primary">{formatPrice(effectivePrice)}</span>
            <span className="text-base text-text-muted line-through">{formatPrice(originalPrice)}</span>
            <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">{discount}% off</span>
          </div>
          <p className="text-xs text-emerald-600 font-medium">✓ Inclusive of all taxes</p>

          {/* Binding Type Selector */}
          <div className="rounded-2xl border border-black/8 bg-[#f8f4ee] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Binding Type</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: "STAPLE" as const, label: "Staple Binding", sub: "Standard · No extra charge" },
                { value: "SPIRAL" as const, label: "Spiral Binding", sub: `Premium · +${formatPrice(spiralBindingPrice)}` },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBindingType(opt.value)}
                  className={`flex flex-col gap-0.5 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    bindingType === opt.value
                      ? "border-[#1d1a17] bg-white shadow-sm"
                      : "border-black/10 hover:border-black/25"
                  }`}
                >
                  <span className="text-sm font-semibold text-text-primary">{opt.label}</span>
                  <span className={`text-xs ${opt.value === "SPIRAL" ? "text-amber-600 font-medium" : "text-text-muted"}`}>
                    {opt.sub}
                  </span>
                </button>
              ))}
            </div>
            {bindingType === "SPIRAL" && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                ₹{spiralBindingPrice} spiral binding charge will be added to your order.
              </p>
            )}
          </div>

          {/* Quantity + Add to Cart */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center rounded-xl border border-black/10 bg-white">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-l-xl text-text-primary hover:bg-[#f4efe7] transition-colors text-lg font-bold">−</button>
              <span className="flex h-11 w-10 items-center justify-center text-sm font-medium text-text-primary">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(book.stock, q + 1))} disabled={isOutOfStock}
                className="flex h-11 w-11 items-center justify-center rounded-r-xl text-text-primary hover:bg-[#f4efe7] transition-colors text-lg font-bold disabled:opacity-40">+</button>
            </div>

            <button type="button" onClick={handleAddToCart} disabled={addToCartMutation.isPending || isOutOfStock}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-55 sm:flex-none sm:px-6 ${
                isInCart ? "border border-emerald-500 bg-emerald-50 text-emerald-700" : "border border-[#1d1a17] bg-white text-[#1d1a17] hover:bg-[#f4efe7]"
              }`}>
              <ShoppingBag size={16} />
              {isInCart ? "Added to Bag" : addToCartMutation.isPending ? "Adding..." : "Add to Bag"}
            </button>

            <button type="button" onClick={handleBuyNow} disabled={isOutOfStock}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d1a17] py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-black disabled:opacity-55 sm:flex-none sm:px-6">
              <Zap size={16} /> Buy Now
            </button>
          </div>

          {cartError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{cartError}</p>
          )}

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
          {(["details", "reviews"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize transition-all ${activeTab === tab ? "border-b-2 border-[#1d1a17] text-text-primary" : "text-text-muted hover:text-text-primary"}`}>
              {tab === "details" ? "Product Details" : `Reviews (${bookRating.count})`}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "details" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Product Info Table */}
          <div className="rounded-2xl border border-black/8 bg-white overflow-hidden">
            <div className="border-b border-black/8 px-5 py-4">
              <h3 className="font-serif text-lg text-text-primary">Product Details</h3>
            </div>
            <div className="divide-y divide-black/5">
              {[
                { label: "Publication", value: (book as any).publication ?? "Akash Book Centre" },
                { label: "Publication Year", value: new Date(book.createdAt).getFullYear() },
                { label: "Author", value: book.author },
                { label: "Language", value: (book as any).language ?? "English" },
                { label: "ISBN", value: book.isbn },
                { label: "Category", value: book.category?.name ?? "General" },
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
            {book.description && book.description.trim().startsWith("<") ? (
              <div
                className="prose prose-sm max-w-none text-text-muted leading-7"
                dangerouslySetInnerHTML={{ __html: book.description }}
              />
            ) : (
              <p className="text-sm leading-7 text-text-muted">
                {book.description || "A thoughtfully curated title from our collection. This book offers valuable insights and engaging content for readers of all levels."}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Rating Summary */}
          {bookRating.count > 0 && (
            <div className="rounded-2xl border border-black/8 bg-white p-5">
              <div className="flex items-center gap-5">
                <div className="flex flex-col items-center gap-2 border-r border-black/8 pr-6">
                  <span className="font-serif text-5xl font-bold text-text-primary">{bookRating.average}</span>
                  <StarRating rating={Math.round(bookRating.average)} size={18} />
                  <span className="text-sm text-text-muted">{bookRating.count} reviews</span>
                </div>
              </div>
            </div>
          )}

          {/* Reviews List */}
          {bookReviews.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-10 text-center text-sm text-text-muted">
              No approved reviews yet. Be the first to review this book!
            </p>
          ) : (
            <div className="space-y-3">
              {bookReviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-black/8 bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <StarRating rating={review.rating} size={13} />
                    <span className="text-xs text-text-muted">{new Date(review.createdAt).toLocaleDateString("en-IN")}</span>
                  </div>
                  {review.title && <p className="text-sm font-semibold text-text-primary mb-1">{review.title}</p>}
                  <p className="text-sm text-text-muted leading-6">{review.comment}</p>
                  <p className="mt-2 text-xs font-medium text-text-primary">{review.user?.name ?? "Anonymous"}</p>
                </div>
              ))}
            </div>
          )}

          {/* Submit Review */}
          {isAuthenticated ? (
            <div className="rounded-2xl border border-black/8 bg-white p-5 space-y-4">
              <h3 className="font-serif text-lg text-text-primary">Write a Review</h3>
              {reviewSuccess ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  ✅ Review submitted! It will appear after admin approval.
                </div>
              ) : (
                <>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-widest text-text-muted">Your Rating</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} type="button" onClick={() => setReviewForm((f) => ({ ...f, rating: star }))}>
                          <Star size={22} className={star <= reviewForm.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Review title (optional)"
                    value={reviewForm.title}
                    onChange={(e) => setReviewForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:bg-white"
                  />
                  <textarea
                    placeholder="Share your thoughts about this book..."
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                    rows={4}
                    className="w-full rounded-xl border border-black/10 bg-[#f8f4ee] px-4 py-2.5 text-sm outline-none focus:bg-white resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => submitReviewMutation.mutate()}
                    disabled={submitReviewMutation.isPending || !reviewForm.comment.trim()}
                    className="inline-flex items-center justify-center rounded-full bg-[#1d1a17] px-6 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50 transition-all"
                  >
                    {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
                  </button>
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              <button type="button" onClick={() => navigate("/login")} className="font-medium text-accent hover:underline">
                Login
              </button>{" "}
              to write a review.
            </p>
          )}
        </div>
      )}

      {/* Related Books */}
      {relatedBooks.length > 0 && (
        <section className="space-y-5 border-t border-black/8 pt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl text-text-primary sm:text-2xl">
              More in {book.category?.name ?? "this category"}
            </h2>
            <Link to={book.category ? `/category/${book.category.slug}` : "/"} className="text-sm text-accent hover:underline transition-colors">
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
