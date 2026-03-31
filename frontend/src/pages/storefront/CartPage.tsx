import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { getCart, removeCartItem, updateCartItem } from "../../api/cart.api";
import { getSettings } from "../../api/settings.api";

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export default function CartPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({ queryKey: ["cart"], queryFn: getCart });
  const { data: settingsData } = useQuery({ queryKey: ["site-settings"], queryFn: getSettings });
  const spiralPrice = Number(settingsData?.data?.spiralBindingPrice ?? 30);

  const updateQuantityMutation = useMutation({
    mutationFn: ({ bookId, quantity }: { bookId: string; quantity: number }) => updateCartItem(bookId, quantity),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const removeItemMutation = useMutation({
    mutationFn: (bookId: string) => removeCartItem(bookId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const cart = data?.data;
  const items = cart?.items ?? [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.book.price) * item.quantity, 0);
  const bindingTotal = items.reduce((sum, item) => sum + (item.bindingType === "SPIRAL" ? spiralPrice : 0), 0);
  const total = subtotal + bindingTotal;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,0.9fr)] lg:gap-6">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white sm:h-36" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-[1.75rem] bg-white" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-[#fbf8f2] px-6 py-14 text-center sm:rounded-4xl sm:py-16">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
          <ShoppingBag className="h-6 w-6 text-text-muted" />
        </div>
        <h1 className="mt-6 font-serif text-3xl text-text-primary sm:text-4xl">Your cart is empty</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Start with a few titles from the storefront and they'll appear here.
        </p>
        <Link to="/" className="mt-6 inline-flex items-center rounded-full bg-[#1d1a17] px-5 py-3 text-sm text-white transition-all hover:-translate-y-0.5 hover:bg-black">
          Browse books
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <p className="font-sans text-[0.72rem] uppercase tracking-[0.32em] text-text-muted">Your basket</p>
        <h1 className="mt-1.5 font-serif text-3xl text-text-primary sm:text-4xl">Cart</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,0.9fr)] lg:gap-6">
        <section className="space-y-3">
          {items.map((item) => {
            const isUpdating = updateQuantityMutation.isPending && updateQuantityMutation.variables?.bookId === item.bookId;
            const isRemoving = removeItemMutation.isPending && removeItemMutation.variables === item.bookId;

            return (
              <article key={item.id} className="flex gap-3 rounded-2xl border border-black/8 bg-[#fbf8f2] p-3 sm:gap-4 sm:rounded-3xl sm:p-4">
                <Link to={`/books/${item.book.id}`} className="shrink-0">
                  <img src={item.book.coverImageUrl} alt={item.book.title}
                    className="h-20 w-16 rounded-xl object-cover bg-[#efe6d8] transition-transform duration-200 hover:scale-[1.02] sm:h-24 sm:w-20 sm:rounded-2xl" />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                  <div>
                    <Link to={`/books/${item.book.id}`}
                      className="font-serif text-base leading-tight text-text-primary transition-colors hover:text-black sm:text-xl">
                      {item.book.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-text-muted sm:text-sm">{item.book.author}</p>
                    {item.bindingType !== "NONE" && (
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        item.bindingType === "SPIRAL"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {item.bindingType === "SPIRAL" ? `Spiral Binding (+${formatPrice(spiralPrice)})` : "Staple Binding"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="font-serif text-base text-[#8f2d22] sm:text-xl">
                      {formatPrice(Number(item.book.price) + (item.bindingType === "SPIRAL" ? spiralPrice : 0))}
                    </p>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2 py-1.5 sm:gap-2 sm:px-3">
                        <button type="button"
                          onClick={() => updateQuantityMutation.mutate({ bookId: item.bookId, quantity: Math.max(1, item.quantity - 1) })}
                          disabled={isUpdating || item.quantity <= 1}
                          className="rounded-full p-0.5 text-text-primary transition-colors hover:bg-[#f4efe7] disabled:opacity-40">
                          <Minus size={13} />
                        </button>
                        <span className="min-w-5 text-center text-sm text-text-primary">{item.quantity}</span>
                        <button type="button"
                          onClick={() => updateQuantityMutation.mutate({ bookId: item.bookId, quantity: item.quantity + 1 })}
                          disabled={isUpdating || item.quantity >= item.book.stock}
                          className="rounded-full p-0.5 text-text-primary transition-colors hover:bg-[#f4efe7] disabled:opacity-40">
                          <Plus size={13} />
                        </button>
                      </div>

                      <button type="button" onClick={() => removeItemMutation.mutate(item.bookId)} disabled={isRemoving}
                        className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 sm:p-2">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="h-fit rounded-2xl border border-black/8 bg-[#fbf8f2] p-4 sm:rounded-[1.75rem] sm:p-6">
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">Order summary</p>
          <h2 className="mt-2 font-serif text-2xl text-text-primary sm:text-3xl">Ready to checkout</h2>

          <div className="mt-6 space-y-3 border-y border-black/8 py-4">
            <div className="flex items-center justify-between text-sm text-text-muted">
              <span>Items</span><span>{itemCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-text-muted">
              <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
            </div>
            {bindingTotal > 0 && (
              <div className="flex items-center justify-between text-sm text-amber-600">
                <span>Binding Charges</span><span>+{formatPrice(bindingTotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm text-text-muted">
              <span>Shipping</span><span className="text-emerald-600">Free</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="font-serif text-xl text-text-primary">Total</span>
            <span className="font-serif text-2xl text-[#8f2d22]">{formatPrice(total)}</span>
          </div>

          <button type="button" onClick={() => navigate("/checkout")}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[#1d1a17] px-5 py-3 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-black">
            Proceed to Checkout
          </button>
          <Link to="/" className="mt-3 inline-flex w-full items-center justify-center text-sm text-text-muted transition-colors hover:text-text-primary">
            Continue Shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
