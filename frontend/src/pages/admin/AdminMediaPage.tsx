import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { AlertTriangle, Film, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteMedia, getMedia, type MediaItem, type MediaResourceType } from "../../api/media.api";
import type { ApiErrorResponse } from "../../types";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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

export default function AdminMediaPage() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<MediaResourceType>("image");
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const cursor = cursors[pageIndex] ?? null;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-media", type, cursor],
    queryFn: () => getMedia(type, cursor),
  });

  const items = data?.data.items ?? [];
  const nextCursor = data?.data.nextCursor ?? null;

  const switchType = (next: MediaResourceType) => {
    setType(next);
    setCursors([null]);
    setPageIndex(0);
  };

  const goNext = () => {
    if (!nextCursor) return;
    setCursors((prev) => {
      const copy = [...prev];
      copy[pageIndex + 1] = nextCursor;
      return copy;
    });
    setPageIndex((p) => p + 1);
  };

  const goPrev = () => setPageIndex((p) => Math.max(0, p - 1));

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

  return (
    <>
      {deleteTarget && (
        <DeleteModal
          item={deleteTarget}
          isPending={deleteMut.isPending}
          error={deleteError}
          onConfirm={() => deleteMut.mutate({ publicId: deleteTarget.publicId, resourceType: type })}
          onCancel={() => { setDeleteTarget(null); setDeleteError(""); }}
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

        <div className="flex gap-2">
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
        </div>

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
              <div key={item.publicId} className="group relative overflow-hidden rounded-2xl border border-black/8 bg-white">
                <div className="relative aspect-square overflow-hidden bg-[#f8f4ee]">
                  {type === "image" ? (
                    <img src={item.url} alt={item.publicId} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <video src={item.url} className="h-full w-full object-cover" muted preload="metadata" />
                  )}
                  {item.inUse && (
                    <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-primary shadow">
                      In use
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-600 opacity-0 shadow transition-opacity group-hover:opacity-100"
                    aria-label="Delete file"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="px-2.5 py-2 text-[11px] text-text-muted">
                  <p className="truncate" title={item.publicId}>{item.publicId.split("/").pop()}</p>
                  <p>{formatBytes(item.bytes)}{item.width ? ` · ${item.width}×${item.height}` : ""}</p>
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
