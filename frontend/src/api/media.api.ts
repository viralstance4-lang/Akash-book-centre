import api from "./axios";
import type { ApiSuccessResponse } from "../types";

export type MediaResourceType = "image" | "video";

export type MediaItem = {
  publicId: string;
  url: string;
  resourceType: string;
  format: string;
  bytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  /** True if this file is still referenced by a book, banner, category, etc. */
  inUse: boolean;
};

export type MediaPage = {
  items: MediaItem[];
  nextCursor: string | null;
  totalCount: number | null;
};

export type MediaSort = "asc" | "desc";

export type GetMediaParams = {
  type: MediaResourceType;
  cursor?: string | null;
  /** "asc" = oldest first — the default, since finding old files to clean up is the point. */
  sort?: MediaSort;
  /** "YYYY-MM-DD" */
  dateFrom?: string;
  dateTo?: string;
};

export const getMedia = async ({ type, cursor, sort, dateFrom, dateTo }: GetMediaParams) => {
  const response = await api.get<ApiSuccessResponse<MediaPage>>("/admin/media", {
    params: { type, cursor: cursor ?? undefined, sort, from: dateFrom, to: dateTo },
  });
  return response.data;
};

export const deleteMedia = async (publicId: string, type: MediaResourceType) => {
  const response = await api.delete<ApiSuccessResponse<null>>(
    `/admin/media/${encodeURIComponent(publicId)}`,
    { params: { type } },
  );
  return response.data;
};
