import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Banner } from "../../api/banners.api";

type BannerSliderProps = {
  banners: Banner[];
};

export default function BannerSlider({ banners }: BannerSliderProps) {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  const activeBanners = banners.filter((b) => b.isActive);

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

  const prev = () => {
    setCurrent((c) => (c - 1 + activeBanners.length) % activeBanners.length);
    startTimer();
  };

  const next = () => {
    setCurrent((c) => (c + 1) % activeBanners.length);
    startTimer();
  };

  const handleClick = (banner: Banner) => {
    if (!banner.redirectUrl) return;
    if (banner.redirectUrl.startsWith("http")) {
      window.open(banner.redirectUrl, "_blank");
    } else {
      navigate(banner.redirectUrl);
    }
  };

  return (
    <div
      className="relative w-full rounded-2xl sm:rounded-3xl bg-[#f4efe7]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/*
       * Ghost image — invisible, w-full h-auto.
       * Its natural dimensions drive the container height so no aspect-ratio
       * hack is needed. Slides sit absolutely on top of it.
       * Switches to the current banner so the container always matches the
       * displayed image's intrinsic ratio (important when banners differ).
       */}
      <img
        src={activeBanners[current].imageUrl}
        alt=""
        aria-hidden="true"
        className="block w-full h-auto opacity-0 pointer-events-none select-none rounded-2xl sm:rounded-3xl"
      />

      {/* Slides — absolutely fill the ghost-sized container */}
      {activeBanners.map((banner, index) => (
        <div
          key={banner.id}
          className={`absolute inset-0 transition-opacity duration-700 rounded-2xl sm:rounded-3xl overflow-hidden ${
            index === current ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
        >
          {/*
           * object-contain → full image always visible, no crop, no zoom.
           * object-center  → centred horizontally and vertically.
           * bg-[#f4efe7]   → warm theme fill for any letterbox space.
           */}
          <img
            src={banner.imageUrl}
            alt={banner.title ?? `Banner ${index + 1}`}
            className={`h-full w-full object-contain object-center bg-[#f4efe7] ${
              banner.redirectUrl ? "cursor-pointer" : ""
            }`}
            onClick={() => handleClick(banner)}
          />

          {/* Subtle bottom gradient so title text stays readable */}
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

      {/* Prev / Next arrows — only when multiple banners */}
      {activeBanners.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-text-primary shadow-md backdrop-blur-sm transition-all hover:bg-white hover:scale-105 sm:h-10 sm:w-10"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-text-primary shadow-md backdrop-blur-sm transition-all hover:bg-white hover:scale-105 sm:h-10 sm:w-10"
          >
            <ChevronRight size={18} />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 sm:bottom-4">
            {activeBanners.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setCurrent(i);
                  startTimer();
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-6 bg-white"
                    : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
