import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Star, Trash2 } from "lucide-react";
import { getAdminReviews, approveReview, deleteReview } from "../../api/reviews.api";

export default function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-reviews"], queryFn: getAdminReviews });

  const approveMutation = useMutation({
    mutationFn: approveReview,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReview,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }),
  });

  const reviews = data?.data ?? [];
  const pending = reviews.filter((r) => !r.isApproved);
  const approved = reviews.filter((r) => r.isApproved);

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">Manage</p>
        <h2 className="font-serif text-2xl text-text-primary">Reviews</h2>
        <p className="mt-1 text-sm text-text-muted">{pending.length} pending approval · {approved.length} published</p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-widest text-amber-600">Pending Approval ({pending.length})</h3>
          {pending.map((review) => (
            <div key={review.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-text-primary">{review.user?.name}</span>
                    <span className="text-xs text-text-muted">on</span>
                    <span className="text-xs font-medium text-text-primary truncate max-w-[200px]">{review.book?.title}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    {[1,2,3,4,5].map((s) => <Star key={s} size={12} className={s <= review.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"} />)}
                    <span className="ml-1 text-xs text-text-muted">{new Date(review.createdAt).toLocaleDateString("en-IN")}</span>
                  </div>
                  {review.title && <p className="mt-1.5 text-sm font-medium text-text-primary">{review.title}</p>}
                  <p className="mt-1 text-sm text-text-muted">{review.comment}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => approveMutation.mutate(review.id)} disabled={approveMutation.isPending}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50">
                    <Check size={15} />
                  </button>
                  <button type="button" onClick={() => deleteMutation.mutate(review.id)} disabled={deleteMutation.isPending}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {approved.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-widest text-emerald-600">Published ({approved.length})</h3>
          {approved.map((review) => (
            <div key={review.id} className="rounded-2xl border border-black/8 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-text-primary">{review.user?.name}</span>
                    <span className="text-xs text-text-muted">on</span>
                    <span className="text-xs font-medium text-text-primary truncate max-w-[200px]">{review.book?.title}</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">Published</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    {[1,2,3,4,5].map((s) => <Star key={s} size={12} className={s <= review.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"} />)}
                  </div>
                  {review.title && <p className="mt-1.5 text-sm font-medium text-text-primary">{review.title}</p>}
                  <p className="mt-1 text-sm text-text-muted">{review.comment}</p>
                </div>
                <button type="button" onClick={() => deleteMutation.mutate(review.id)} disabled={deleteMutation.isPending}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviews.length === 0 && (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-12 text-center">
          <p className="font-serif text-xl text-text-primary">No reviews yet</p>
          <p className="mt-2 text-sm text-text-muted">Reviews will appear here when customers submit them.</p>
        </div>
      )}
    </div>
  );
}
