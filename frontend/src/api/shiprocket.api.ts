import api from "./axios";
import type { ApiSuccessResponse, Order } from "../types";

type ShiprocketResult = ApiSuccessResponse<Order>;
type LabelResult      = ApiSuccessResponse<{ labelUrl: string; order: Order }>;
type InvoiceResult    = ApiSuccessResponse<{ invoiceUrl: string; order: Order }>;
type ManifestResult   = ApiSuccessResponse<{ manifestUrl: string; order: Order }>;
type TrackResult      = ApiSuccessResponse<Record<string, unknown>>;
type CancelResult     = ApiSuccessResponse<{ data: unknown; order: Order }>;
type SyncResult       = ApiSuccessResponse<{ srData: unknown; order: Order }>;

const base = (orderId: string) => `/admin/shiprocket/${orderId}`;

/** Step 1 – Create Shiprocket order for an existing store order */
export const createShipment = (orderId: string) =>
  api.post<ShiprocketResult>(`${base(orderId)}/create-shipment`).then((r) => r.data);

/** Step 2 – Assign AWB and courier partner */
export const generateAWB = (orderId: string) =>
  api.post<ShiprocketResult>(`${base(orderId)}/generate-awb`).then((r) => r.data);

/** Step 3 – Generate and fetch shipping label URL */
export const generateLabel = (orderId: string) =>
  api.post<LabelResult>(`${base(orderId)}/label`).then((r) => r.data);

/** Generate Shiprocket shipping invoice URL */
export const generateInvoice = (orderId: string) =>
  api.post<InvoiceResult>(`${base(orderId)}/invoice`).then((r) => r.data);

/** Generate manifest for pickup */
export const generateManifest = (orderId: string) =>
  api.post<ManifestResult>(`${base(orderId)}/manifest`).then((r) => r.data);

/** Get live tracking data from Shiprocket */
export const trackShipment = (orderId: string) =>
  api.get<TrackResult>(`${base(orderId)}/track`).then((r) => r.data);

/** Cancel a Shiprocket shipment */
export const cancelShipment = (orderId: string) =>
  api.post<CancelResult>(`${base(orderId)}/cancel`).then((r) => r.data);

/** Pull latest status from Shiprocket and sync to DB */
export const syncStatus = (orderId: string) =>
  api.post<SyncResult>(`${base(orderId)}/sync`).then((r) => r.data);
