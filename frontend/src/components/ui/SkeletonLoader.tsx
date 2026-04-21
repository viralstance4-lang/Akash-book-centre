import type { HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

function SkeletonBlock({ className = "", ...props }: SkeletonProps) {
  return <div className={`skeleton ${className}`} {...props} />;
}

export function SkeletonHeader() {
  return (
    <div className="space-y-5 rounded-[2rem] border border-black/10 bg-white/95 p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <SkeletonBlock className="h-12 w-12 rounded-[1.5rem]" />
        <div className="hidden flex-1 items-center gap-2 md:flex">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-10 min-w-[8rem] rounded-full" />
          ))}
        </div>
        <SkeletonBlock className="h-11 flex-1 min-w-[14rem] rounded-full md:max-w-md" />
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-10 w-10 rounded-full" />
          <SkeletonBlock className="h-10 w-10 rounded-full" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-24 rounded-[1.75rem]" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonCategory() {
  return <SkeletonBlock className="h-28 rounded-3xl" />;
}

export function SkeletonProductCard() {
  return (
    <div className="space-y-4 rounded-[2rem] border border-black/10 bg-white p-4 shadow-sm">
      <SkeletonBlock className="aspect-[3/4] rounded-[1.75rem]" />
      <div className="space-y-3">
        <SkeletonBlock className="h-4 w-3/4 rounded-full" />
        <SkeletonBlock className="h-4 w-1/2 rounded-full" />
        <div className="flex items-center justify-between gap-3">
          <SkeletonBlock className="h-9 w-24 rounded-full" />
          <SkeletonBlock className="h-9 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonProductCard key={index} />
      ))}
    </div>
  );
}

export function SessionRestoreSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f1ea] px-4 py-10">
      <div className="w-full max-w-screen-2xl space-y-8">
        <SkeletonHeader />
        <div className="space-y-6 rounded-[2rem] border border-black/10 bg-white/95 p-5 shadow-sm md:p-6">
          <SkeletonBlock className="h-6 w-48 rounded-full" />
          <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCategory key={index} />
            ))}
          </div>
        </div>
        <div className="space-y-5 rounded-[2rem] border border-black/10 bg-white/95 p-5 shadow-sm md:p-6">
          <SkeletonBlock className="h-6 w-56 rounded-full" />
          <SkeletonGrid count={10} />
        </div>
      </div>
    </div>
  );
}
