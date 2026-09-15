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
};

export const getMedia = async (type: MediaResourceType, cursor?: string | null) => {
  const response = await api.get<ApiSuccessResponse<MediaPage>>("/admin/media", {
    params: { type, cursor: cursor ?? undefined },
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
