import api from "./axios";
import type { ApiSuccessResponse, Order } from "../types";

type SmResult      = ApiSuccessResponse<Order>;
type LabelResult   = ApiSuccessResponse<{ labelUrl: string | null; order: Order }>;
type ManifestResult = ApiSuccessResponse<{ manifestUrl: string | null; order: Order }>;
type TrackResult   = ApiSuccessResponse<Record<string, unknown>>;
type CancelResult  = ApiSuccessResponse<{ data: unknown; order: Order }>;
type SvcResult     = ApiSuccessResponse<{ serviceable: boolean }>;

const base = (orderId: string) => `/admin/shipmozo/${orderId}`;

/** Step 1 – Push order to Shipmozo */
export const createShipment = (orderId: string) =>
  api.post<SmResult>(`${base(orderId)}/create-shipment`).then((r) => r.data);

/** Step 2 – Auto-assign courier & generate AWB */
export const assignCourier = (orderId: string) =>
  api.post<SmResult>(`${base(orderId)}/assign-courier`).then((r) => r.data);

/** Fetch shipping label PDF URL */
export const getLabel = (orderId: string) =>
  api.post<LabelResult>(`${base(orderId)}/label`).then((r) => r.data);

/** Generate manifest */
export const generateManifest = (orderId: string) =>
  api.post<ManifestResult>(`${base(orderId)}/manifest`).then((r) => r.data);

/** Live tracking by AWB */
export const trackShipment = (orderId: string) =>
  api.get<TrackResult>(`${base(orderId)}/track`).then((r) => r.data);

/** Cancel a Shipmozo shipment */
export const cancelShipment = (orderId: string) =>
  api.post<CancelResult>(`${base(orderId)}/cancel`).then((r) => r.data);

/** Check if a delivery pincode is serviceable */
export const checkServiceability = (pincode: string) =>
  api.get<SvcResult>(`/admin/shipmozo/serviceability?pincode=${pincode}`).then((r) => r.data);
