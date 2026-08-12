import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Banner } from "../../api/banners.api";

type BannerSliderProps = {
  banners: Banner[];
};

/** Resolve the correct src for each viewport, falling back to the legacy imageUrl. */
const desktopSrc = (b: Banner) => b.desktopImageUrl ?? b.imageUrl;
const mobileSrc  = (b: Banner) => b.mobileImageUrl  ?? b.imageUrl;

export default function BannerSlider({ banners }: BannerSliderProps) {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  const activeBanners = banners.filter((b) => b.isActive);
  // `current` is state, so it can briefly point past the end of `activeBanners`
  // the instant a background refetch shrinks the list (e.g. an admin deactivates
  // a banner while this is on screen). Deriving a clamped index at render time
  // — rather than reading `current` directly — means the slide-out banner is
  // safely skipped on the very next render instead of `activeBanners[current]`
  // evaluating to undefined and crashing. `next`/`prev`/the timer already wrap
  // `current` via modulo against the new length, so it self-corrects shortly
  // after anyway; this just keeps the render safe and correct in the meantime.
  const safeCurrent = activeBanners.length > 0
    ? Math.min(current, activeBanners.length - 1)
    : 0;

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % activeBanners.length);
    }, 4500);
  };

  useEffect(() => {
    if (activeBanners.length > 1 && !isHovered) startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeBanners.length, isHovered]);

  if (activeBanners.length === 0) return null;

  const prev = () => { setCurrent((c) => (c - 1 + activeBanners.length) % activeBanners.length); startTimer(); };
  const next = () => { setCurrent((c) => (c + 1) % activeBanners.length); startTimer(); };

  const handleClick = (banner: Banner) => {
    if (!banner.redirectUrl) return;
    if (banner.redirectUrl.startsWith("http")) {
      window.open(banner.redirectUrl, "_blank");
    } else {
      navigate(banner.redirectUrl);
    }
  };

  const cur = activeBanners[safeCurrent];

  return (
    <div
      className="relative w-full rounded-2xl sm:rounded-3xl bg-[#f4efe7] overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/*
       * Ghost images — drive container height without occupying layout space.
       * Desktop ghost (sm+) uses the wide desktop image aspect ratio.
       * Mobile ghost (<sm) uses the taller mobile image aspect ratio.
       * Only one is visible per breakpoint via Tailwind responsive display.
       */}
      <img
        src={desktopSrc(cur)}
        alt=""
        aria-hidden="true"
        className="hidden sm:block w-full h-auto opacity-0 pointer-events-none select-none"
      />
      <img
        src={mobileSrc(cur)}
        alt=""
        aria-hidden="true"
        className="block sm:hidden w-full h-auto opacity-0 pointer-events-none select-none"
      />

      {/* Slides — absolutely fill the ghost-sized container */}
      {activeBanners.map((banner, index) => (
        <div
          key={banner.id}
          className={`absolute inset-0 transition-opacity duration-700 ${
            index === safeCurrent ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
        >
          {/* Desktop image (≥640px) */}
          <img
            src={desktopSrc(banner)}
            alt={banner.title ?? `Banner ${index + 1}`}
            className={`hidden sm:block h-full w-full object-cover object-center ${
              banner.redirectUrl ? "cursor-pointer" : ""
            }`}
            onClick={() => handleClick(banner)}
          />
          {/* Mobile image (<640px) */}
          <img
            src={mobileSrc(banner)}
            alt={banner.title ?? `Banner ${index + 1}`}
            className={`block sm:hidden h-full w-full object-cover object-center ${
              banner.redirectUrl ? "cursor-pointer" : ""
            }`}
            onClick={() => handleClick(banner)}
          />

          {/* Subtle gradient so title text stays readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />

          {banner.title && (
            <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 z-20">
              <p className="font-serif text-lg text-white drop-shadow-lg sm:text-2xl lg:text-3xl">
                {banner.title}
              </p>
            </div>
          )}
        </div>
      ))}

      {/* Prev / Next arrows */}
      {activeBanners.length > 1 && (
        <>
          <button type="button" onClick={prev}
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-text-primary shadow-md backdrop-blur-sm transition-all hover:bg-white hover:scale-105 sm:h-10 sm:w-10">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={next}
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-text-primary shadow-md backdrop-blur-sm transition-all hover:bg-white hover:scale-105 sm:h-10 sm:w-10">
            <ChevronRight size={18} />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 sm:bottom-4">
            {activeBanners.map((_, i) => (
              <button key={i} type="button"
                onClick={() => { setCurrent(i); startTimer(); }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === safeCurrent ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
