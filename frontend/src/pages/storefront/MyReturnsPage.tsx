import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getUserReturns } from "../../api/returns.api";

const RETURN_STATUS_STYLES = {
  VERIFYING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  COMPLETED: "bg-blue-100 text-blue-800",
};

const STATUS_MESSAGES = {
  VERIFYING: "Order Verifying",
  APPROVED: "Return Approved",
  REJECTED: "Return Rejected",
  COMPLETED: "Return Completed",
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

export default function MyReturnsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1");
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["returns", page, limit],
    queryFn: () => getUserReturns(page, limit),
  });

  const returns = data?.data.returns ?? [];
  const totalPages = data?.data.totalPages ?? 1;

  const setPage = (nextPage: number) => {
    setSearchParams({ page: String(nextPage) });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-3xl bg-white"
          />
        ))}
      </div>
    );
  }

  if (returns.length === 0) {
    return (
      <div className="rounded-4xl border border-dashed border-black/10 bg-[#fbf8f2] px-8 py-16 text-center">
        <h1 className="font-serif text-4xl text-text-primary">No returns yet</h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          When you request a return, it will appear here with status updates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-sans text-[0.72rem] uppercase tracking-[0.32em] text-text-muted">
          Returns Management
        </p>
        <h1 className="mt-2 font-serif text-4xl text-text-primary">My Returns</h1>
        <p className="mt-3 text-sm text-text-muted">
          Track the status of your return requests
        </p>
      </div>

      <div className="space-y-4">
        {returns.map((returnRequest) => (
          <article
            key={returnRequest.id}
            className="grid gap-4 rounded-3xl border border-black/8 bg-[#fbf8f2] p-5 md:grid-cols-[minmax(0,1.1fr)_0.9fr_0.8fr_auto]"
          >
            <div className="min-w-0">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">
                Order / Return ID
              </p>
              <p className="mt-2 truncate font-serif text-2xl text-text-primary">
                #{returnRequest.id.slice(0, 8)}
              </p>
              <p className="mt-2 text-sm text-text-muted">
                {formatDate(returnRequest.createdAt)}
              </p>
            </div>

            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">
                Order Total
              </p>
              <p className="mt-2 font-serif text-2xl text-[#8f2d22]">
                {formatPrice(Number(returnRequest.order?.totalAmount ?? 0))}
              </p>
              {returnRequest.reason && (
                <p className="mt-2 truncate text-xs text-text-muted" title={returnRequest.reason}>
                  Reason: {returnRequest.reason}
                </p>
              )}
            </div>

            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-muted">
                Status
              </p>
              <div className="mt-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${
                    RETURN_STATUS_STYLES[returnRequest.status]
                  }`}
                >
                  {STATUS_MESSAGES[returnRequest.status]}
                </span>
              </div>
              {returnRequest.status === "VERIFYING" && (
                <p className="mt-2 text-xs text-amber-600">We're checking your order</p>
              )}
              {returnRequest.status === "APPROVED" && (
                <p className="mt-2 text-xs text-emerald-600">Check your email for instructions</p>
              )}
              {returnRequest.status === "REJECTED" && (
                <p className="mt-2 text-xs text-rose-600">We couldn't process this return</p>
              )}
              {returnRequest.status === "COMPLETED" && (
                <p className="mt-2 text-xs text-blue-600">Return has been completed</p>
              )}
            </div>

            <div className="flex flex-col items-start justify-between md:items-end">
              <div className="text-right text-xs text-text-muted">
                {returnRequest.order?.items?.length ?? 0} item(s)
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-black/8 pt-5">
        <p className="text-sm text-text-muted">
          Page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-text-primary transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-45"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-text-primary transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-45"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
