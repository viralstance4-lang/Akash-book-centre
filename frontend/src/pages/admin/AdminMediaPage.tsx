import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { AlertTriangle, CalendarArrowDown, CalendarArrowUp, Copy, Film, HardDrive, ImageIcon, Loader2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { bulkDeleteMedia, deleteMedia, getMedia, getMediaUsage, type MediaItem, type MediaResourceType, type MediaSort } from "../../api/media.api";
import { useToast, ToastViewport } from "../../components/ui/Toast";
import type { ApiErrorResponse } from "../../types";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function DeleteModal({
  item,
  isPending,
  error,
  onConfirm,
  onCancel,
}: {
  item: MediaItem;
  isPending: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-3xl border border-black/10 bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-xl text-text-primary">Delete this file?</h3>
        <p className="mt-2 text-sm text-text-muted break-all">{item.publicId}</p>

        {item.inUse ? (
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              This file is <strong>currently used</strong> somewhere on your site (a book cover, banner,
              category image, etc). Deleting it will leave a broken image there.
            </span>
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-muted">
            Not referenced by anything on the site right now — safe to remove.
          </p>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel}
            className="rounded-full border border-black/10 px-4 py-2 text-sm text-text-muted hover:text-text-primary">
            Cancel
          </button>
          <button type="button" disabled={isPending} onClick={onConfirm}
            className="rounded-full bg-red-600 px-5 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60">
            {isPending ? "Deleting…" : item.inUse ? "Delete anyway" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkDeleteModal({
  count,
  inUseCount,
  isPending,
  error,
  onConfirm,
  onCancel,
}: {
  count: number;
  inUseCount: number;
  isPending: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-3xl border border-black/10 bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-xl text-text-primary">Delete {count} file{count === 1 ? "" : "s"}?</h3>

        {inUseCount > 0 ? (
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>{inUseCount}</strong> of these {inUseCount === 1 ? "is" : "are"} currently used somewhere on
              your site. Deleting them will leave broken images there.
            </span>
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-muted">
            None of these are referenced by anything on the site right now — safe to remove.
          </p>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel}
            className="rounded-full border border-black/10 px-4 py-2 text-sm text-text-muted hover:text-text-primary">
            Cancel
          </button>
          <button type="button" disabled={isPending} onClick={onConfirm}
            className="rounded-full bg-red-600 px-5 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60">
            {isPending ? "Deleting…" : inUseCount > 0 ? "Delete anyway" : `Delete ${count}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({
  item,
  onClose,
  onCopy,
  onDelete,
}: {
  item: MediaItem;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center bg-[#f8f4ee] p-4">
          <button
            type="button" onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-text-primary shadow"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          {item.resourceType === "video" ? (
            <video src={item.url} controls className="max-h-[60vh] max-w-full rounded-xl" />
          ) : (
            <img src={item.url} alt={item.publicId} className="max-h-[60vh] max-w-full rounded-xl object-contain" />
          )}
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          <p className="break-all font-mono text-xs text-text-muted">{item.publicId}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            {item.inUse && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                In use
              </span>
            )}
            <span>{formatBytes(item.bytes)}</span>
            {item.width && <span>· {item.width}×{item.height}</span>}
            <span>· {formatDate(item.createdAt)}</span>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" onClick={onCopy}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-text-primary hover:border-black/20">
              <Copy size={14} /> Copy URL
            </button>
            <button type="button" onClick={onDelete}
              className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 hover:bg-red-100">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminMediaPage() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<MediaResourceType>("image");
  const [sort, setSort] = useState<MediaSort>("asc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [previewTarget, setPreviewTarget] = useState<MediaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState("");
  const { toast, showToast } = useToast();

  const cursor = cursors[pageIndex] ?? null;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-media", type, sort, dateFrom, dateTo, cursor],
    queryFn: () => getMedia({ type, sort, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, cursor }),
  });

  const { data: usageData } = useQuery({
    queryKey: ["admin-media-usage"],
    queryFn: getMediaUsage,
    staleTime: 5 * 60 * 1000,
  });
  const usage = usageData?.data;

  const items = data?.data.items ?? [];
  const nextCursor = data?.data.nextCursor ?? null;
  const totalCount = data?.data.totalCount ?? null;

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast(true, "Image URL copied");
    } catch {
      showToast(false, "Couldn't copy — your browser blocked clipboard access");
    }
  };

  const resetPaging = () => {
    setCursors([null]);
    setPageIndex(0);
    setSelectedIds(new Set());
  };

  const toggleSelected = (publicId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(publicId)) next.delete(publicId); else next.add(publicId);
      return next;
    });
  };

  const selectAllOnPage = () => setSelectedIds(new Set(items.map((i) => i.publicId)));
  const clearSelection  = () => setSelectedIds(new Set());
  const selectedInUseCount = items.filter((i) => selectedIds.has(i.publicId) && i.inUse).length;

  const switchType = (next: MediaResourceType) => {
    setType(next);
    resetPaging();
  };

  const toggleSort = () => {
    setSort((s) => (s === "asc" ? "desc" : "asc"));
    resetPaging();
  };

  const applyDateFrom = (v: string) => { setDateFrom(v); resetPaging(); };
  const applyDateTo   = (v: string) => { setDateTo(v);   resetPaging(); };
  const clearDates    = () => { setDateFrom(""); setDateTo(""); resetPaging(); };

  const goNext = () => {
    if (!nextCursor) return;
    setCursors((prev) => {
      const copy = [...prev];
      copy[pageIndex + 1] = nextCursor;
      return copy;
    });
    setPageIndex((p) => p + 1);
    setSelectedIds(new Set());
  };

  const goPrev = () => {
    setPageIndex((p) => Math.max(0, p - 1));
    setSelectedIds(new Set());
  };

  const deleteMut = useMutation({
    mutationFn: ({ publicId, resourceType }: { publicId: string; resourceType: MediaResourceType }) =>
      deleteMedia(publicId, resourceType),
    onSuccess: () => {
      setDeleteError("");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-media"] });
    },
    onError: (mutationError) => {
      const apiError = mutationError as AxiosError<ApiErrorResponse>;
      setDeleteError(apiError.response?.data?.message ?? "Failed to delete this file.");
    },
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (publicIds: string[]) => bulkDeleteMedia(publicIds, type),
    onSuccess: (res) => {
      setBulkDeleteError("");
      setShowBulkDelete(false);
      setSelectedIds(new Set());
      void queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      const { deleted, notFound } = res.data;
      showToast(true, notFound.length > 0
        ? `${deleted.length} deleted, ${notFound.length} were already gone`
        : `${deleted.length} file${deleted.length === 1 ? "" : "s"} deleted`);
    },
    onError: (mutationError) => {
      const apiError = mutationError as AxiosError<ApiErrorResponse>;
      setBulkDeleteError(apiError.response?.data?.message ?? "Failed to delete selected files.");
    },
  });

  return (
    <>
      <ToastViewport toast={toast} />

      {previewTarget && (
        <PreviewModal
          item={previewTarget}
          onClose={() => setPreviewTarget(null)}
          onCopy={() => copyUrl(previewTarget.url)}
          onDelete={() => { setDeleteTarget(previewTarget); setPreviewTarget(null); }}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          item={deleteTarget}
          isPending={deleteMut.isPending}
          error={deleteError}
          onConfirm={() => deleteMut.mutate({ publicId: deleteTarget.publicId, resourceType: type })}
          onCancel={() => { setDeleteTarget(null); setDeleteError(""); }}
        />
      )}

      {showBulkDelete && (
        <BulkDeleteModal
          count={selectedIds.size}
          inUseCount={selectedInUseCount}
          isPending={bulkDeleteMut.isPending}
          error={bulkDeleteError}
          onConfirm={() => bulkDeleteMut.mutate(Array.from(selectedIds))}
          onCancel={() => { setShowBulkDelete(false); setBulkDeleteError(""); }}
        />
      )}

      <div className="space-y-5">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.28em] text-text-muted">Manage</p>
          <h2 className="font-serif text-2xl text-text-primary">Media Library</h2>
          <p className="mt-1 text-sm text-text-muted">
            Everything actually stored on Cloudinary — delete unused files here to free up storage.
          </p>
        </div>

        {usage && (
          <div className="rounded-2xl border border-black/8 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <HardDrive size={15} className="text-text-muted" />
              <span className="font-medium text-text-primary">{formatBytes(usage.storageBytes)}</span>
              <span className="text-text-muted">storage used · {usage.resourceCount} files · {usage.plan} plan</span>
              {usage.creditsUsedPercent !== undefined && (
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  usage.creditsUsedPercent >= 100
                    ? "bg-red-100 text-red-700"
                    : usage.creditsUsedPercent >= 80
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-700"
                }`}>
                  {usage.creditsUsedPercent}% of monthly credits used
                </span>
              )}
            </div>
            {usage.creditsUsedPercent !== undefined && usage.creditsUsedPercent >= 100 && (
              <p className="mt-2 text-xs text-red-700">
                This Cloudinary account is over its {usage.plan} plan's monthly credit allowance
                (storage + bandwidth + transformations combined) — deleting unused files here helps,
                but heavy traffic/bandwidth is usually the bigger driver.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => switchType("image")}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
              type === "image" ? "border-black/20 bg-[#1d1a17] text-white" : "border-black/10 bg-white text-text-primary hover:border-black/20"
            }`}>
            <ImageIcon size={14} /> Images
          </button>
          <button type="button" onClick={() => switchType("video")}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
              type === "video" ? "border-black/20 bg-[#1d1a17] text-white" : "border-black/10 bg-white text-text-primary hover:border-black/20"
            }`}>
            <Film size={14} /> Videos
          </button>

          <div className="mx-1 h-6 w-px bg-black/10" />

          <button type="button" onClick={toggleSort}
            title={sort === "asc" ? "Showing oldest first" : "Showing newest first"}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-text-primary hover:border-black/20">
            {sort === "asc" ? <CalendarArrowUp size={14} /> : <CalendarArrowDown size={14} />}
            {sort === "asc" ? "Oldest first" : "Newest first"}
          </button>

          <label className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-text-muted">
            From
            <input type="date" value={dateFrom} onChange={(e) => applyDateFrom(e.target.value)}
              className="bg-transparent text-sm text-text-primary outline-none" />
          </label>
          <label className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-text-muted">
            To
            <input type="date" value={dateTo} onChange={(e) => applyDateTo(e.target.value)}
              className="bg-transparent text-sm text-text-primary outline-none" />
          </label>
          {(dateFrom || dateTo) && (
            <button type="button" onClick={clearDates} className="text-xs text-text-muted underline hover:text-text-primary">
              Clear dates
            </button>
          )}

          {totalCount !== null && (
            <span className="ml-auto text-xs text-text-muted">{totalCount} {type}{totalCount === 1 ? "" : "s"} total</span>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/8 bg-white px-4 py-2.5 text-sm">
            {selectedIds.size > 0 ? (
              <>
                <span className="font-medium text-text-primary">{selectedIds.size} selected</span>
                <button type="button" onClick={clearSelection} className="text-xs text-text-muted underline hover:text-text-primary">
                  Clear
                </button>
                <button type="button" onClick={() => setShowBulkDelete(true)}
                  className="ml-auto inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700">
                  <Trash2 size={13} /> Delete selected
                </button>
              </>
            ) : (
              <button type="button" onClick={selectAllOnPage} className="text-xs text-text-muted underline hover:text-text-primary">
                Select all on this page
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-12 text-center">
            <p className="font-serif text-xl text-text-primary">No {type}s found</p>
            <p className="mt-2 text-sm text-text-muted">Nothing in Cloudinary storage for this type yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((item) => (
              <div key={item.publicId} className={`group relative overflow-hidden rounded-2xl border bg-white ${
                selectedIds.has(item.publicId) ? "border-[#1d1a17] ring-2 ring-[#1d1a17]/20" : "border-black/8"
              }`}>
                <button
                  type="button"
                  onClick={() => setPreviewTarget(item)}
                  className="relative block aspect-square w-full overflow-hidden bg-[#f8f4ee]"
                  aria-label="Preview file"
                >
                  {type === "image" ? (
                    <img src={item.url} alt={item.publicId} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <video src={item.url} className="h-full w-full object-cover" muted preload="metadata" />
                  )}
                  {item.inUse && (
                    <span className="absolute left-8 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-primary shadow">
                      In use
                    </span>
                  )}
                </button>
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.publicId)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelected(item.publicId)}
                  className="absolute left-2 top-2 h-5 w-5 cursor-pointer accent-[#1d1a17]"
                  aria-label="Select file"
                />
                <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => copyUrl(item.url)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-text-primary shadow"
                    aria-label="Copy URL"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-600 shadow"
                    aria-label="Delete file"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="px-2.5 py-2 text-[11px] text-text-muted">
                  <p className="truncate" title={item.publicId}>{item.publicId.split("/").pop()}</p>
                  <p>{formatBytes(item.bytes)}{item.width ? ` · ${item.width}×${item.height}` : ""}</p>
                  <p className="mt-0.5 text-text-primary/70">{formatDate(item.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-black/8 pt-5">
          <p className="text-sm text-text-muted">
            {isFetching ? <span className="inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Loading…</span> : `Page ${pageIndex + 1}`}
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={goPrev} disabled={pageIndex === 0}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm disabled:opacity-45">Previous</button>
            <button type="button" onClick={goNext} disabled={!nextCursor}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm disabled:opacity-45">Next</button>
          </div>
        </div>
      </div>
    </>
  );
}
