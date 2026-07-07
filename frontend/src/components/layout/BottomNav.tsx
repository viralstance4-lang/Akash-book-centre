import { Grid2x2, Home, Printer, Receipt, ShoppingCart } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { icon: Home,         label: "Home",       path: "/" },
  { icon: Receipt,      label: "Orders",     path: "/orders" },
  { icon: Printer,      label: "Print",      path: "/print-book" },
  { icon: Grid2x2,      label: "Categories", path: "/categories" },
  { icon: ShoppingCart, label: "Cart",       path: "/cart" },
];

export default function BottomNav({ cartCount = 0 }: { cartCount?: number }) {
  const { pathname } = useLocation();

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-[0_-2px_16px_rgba(0,0,0,0.07)] md:hidden">
      <div className="flex items-center justify-around h-[62px] px-1">
        {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
          const active = isActive(path);
          const isCart = path === "/cart";
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center justify-center gap-[3px] flex-1 h-full"
            >
              <div className="relative">
                <Icon
                  size={21}
                  strokeWidth={active ? 2.5 : 1.8}
                  className={active ? "text-red-500" : "text-gray-400"}
                />
                {isCart && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white leading-none">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium leading-none ${
                  active ? "text-red-500" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
