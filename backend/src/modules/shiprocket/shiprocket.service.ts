import AppError from "../../lib/AppError";
import logger from "../../config/logger";
import prisma from "../../lib/prisma";
import env from "../../config/env";

const BASE = "https://apiv2.shiprocket.in/v1/external";
const TIMEOUT_MS = 20_000;

// ── Guards ────────────────────────────────────────────────────────────────────

export function isShiprocketConfigured(): boolean {
  return Boolean(env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD);
}

function assertConfigured(): void {
  if (!isShiprocketConfigured()) {
    throw new AppError(
      "Shiprocket is not configured. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD to your environment.",
      503,
      "SHIPROCKET_NOT_CONFIGURED",
    );
  }
}

// ── Token management ──────────────────────────────────────────────────────────

async function refreshToken(): Promise<string> {
  assertConfigured();
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error({ status: res.status, body: text }, "Shiprocket auth failed");
    let srMsg = "";
    try { srMsg = (JSON.parse(text) as { message?: string }).message ?? ""; } catch { /**/ }
    const hint =
      res.status === 403
        ? "HTTP 403: API access is not enabled on your Shiprocket account. Log in to app.shiprocket.in → Settings → API and enable API access (requires Lite plan or higher)."
        : res.status === 401
        ? "HTTP 401: Invalid email or password. Check SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in .env."
        : `HTTP ${res.status}${srMsg ? ": " + srMsg : ". Verify credentials in .env."}`;
    throw new AppError(hint, 502, "SHIPROCKET_AUTH_FAILED");
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new AppError("Shiprocket returned no auth token", 502, "SHIPROCKET_AUTH_FAILED");
  }

  // Tokens are valid 10 days; we cache for 9 to renew one day early
  const expiresAt = new Date(Date.now() + 9 * 24 * 60 * 60 * 1_000);
  await prisma.shiprocketToken.deleteMany();
  await prisma.shiprocketToken.create({ data: { token: data.token, expiresAt } });

  logger.info("Shiprocket token refreshed");
  return data.token;
}

export async function getToken(): Promise<string> {
  const row = await prisma.shiprocketToken.findFirst({ orderBy: { createdAt: "desc" } });
  if (row && row.expiresAt > new Date()) return row.token;
  return refreshToken();
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function srGet<T>(path: string, retried = false): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (res.status === 401 && !retried) {
    await prisma.shiprocketToken.deleteMany();
    return srGet<T>(path, true);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error({ path, status: res.status, body: text }, "Shiprocket GET error");
    throw new AppError(`Shiprocket API error (${res.status})`, 502, "SHIPROCKET_API_ERROR");
  }
  return res.json() as Promise<T>;
}

async function srPost<T>(path: string, body: unknown, retried = false): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (res.status === 401 && !retried) {
    await prisma.shiprocketToken.deleteMany();
    return srPost<T>(path, body, true);
  }
  // Shiprocket often returns HTTP 200 even for application-level errors
  return res.json() as Promise<T>;
}

// ── Fetch Pickup Locations ────────────────────────────────────────────────────

export async function getPickupLocations(): Promise<Array<{ id: number; name: string; city: string; state: string; pincode: string }>> {
  assertConfigured();
  const data = await srGet<Record<string, unknown>>("/settings/company/pickup");
  const list = (data as any)?.data?.shipping_address as unknown[] | undefined;
  if (!Array.isArray(list)) return [];
  return list.map((loc: any) => ({
    id:      loc.id as number,
    name:    (loc.pickup_location as string) ?? "",
    city:    (loc.city as string) ?? "",
    state:   (loc.state as string) ?? "",
    pincode: String(loc.pin_code ?? ""),
  }));
}

// ── Test Auth (diagnostic only) ───────────────────────────────────────────────

export async function testAuth(): Promise<{ ok: boolean; message: string }> {
  if (!isShiprocketConfigured()) {
    return { ok: false, message: "SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD missing in .env" };
  }
  try {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text().catch(() => "");
    if (res.ok) {
      await prisma.shiprocketToken.deleteMany();
      const token = (JSON.parse(text) as { token?: string }).token ?? "";
      const expiresAt = new Date(Date.now() + 9 * 24 * 60 * 60 * 1_000);
      await prisma.shiprocketToken.create({ data: { token, expiresAt } });
      return { ok: true, message: "Authentication successful — token refreshed." };
    }
    let srMsg = "";
    try { srMsg = (JSON.parse(text) as { message?: string }).message ?? text; } catch { srMsg = text; }
    const hint =
      res.status === 403
        ? "HTTP 403 — API access not enabled. Go to app.shiprocket.in → Settings → API and enable API access. This requires a paid plan (Lite or higher)."
        : `HTTP ${res.status}: ${srMsg}`;
    return { ok: false, message: hint };
  } catch (err: unknown) {
    return { ok: false, message: String(err instanceof Error ? err.message : err) };
  }
}

// ── Create Shipment ───────────────────────────────────────────────────────────

export async function createShipment(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { book: true } } },
  });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (order.shiprocketOrderId) {
    throw new AppError("Shipment already exists for this order", 409, "SHIPMENT_EXISTS");
  }

  const addr = order.shippingAddress as {
    name: string; phone: string; line1: string; line2?: string;
    city: string; state: string; pincode: string;
  };

  const totalQty  = order.items.reduce((s, i) => s + i.quantity, 0);
  const weightKg  = Math.max(
    0.1,
    order.items.reduce((s, i) => {
      const w = i.book.weight ? Number(i.book.weight) : 0.3;
      return s + w * i.quantity;
    }, 0),
  );

  const payload = {
    order_id:              `SR-${order.id.slice(0, 8).toUpperCase()}`,
    order_date:            order.createdAt.toISOString().split("T")[0],
    pickup_location:       env.SHIPROCKET_PICKUP_LOCATION ?? "Primary",
    billing_customer_name: addr.name,
    billing_last_name:     "",
    billing_address:       addr.line1,
    billing_address_2:     addr.line2 ?? "",
    billing_city:          addr.city,
    billing_pincode:       addr.pincode,
    billing_state:         addr.state,
    billing_country:       "India",
    billing_email:         order.customerEmail ?? "",
    billing_phone:         addr.phone,
    shipping_is_billing:   true,
    order_items: order.items.map((item) => ({
      name:          item.book.title.slice(0, 100),
      sku:           item.book.isbn ?? item.bookId.slice(0, 20),
      units:         item.quantity,
      selling_price: Number(item.priceAtPurchase),
      discount:      0,
      tax:           0,
      hsn:           49019900, // Books HSN code
    })),
    payment_method:       order.paymentMethod === "COD" ? "COD" : "Prepaid",
    shipping_charges:     Number(order.deliveryCharge ?? 0),
    giftwrap_charges:     0,
    transaction_charges:  0,
    total_discount:       Number(order.discountAmount ?? 0),
    sub_total:            Number(order.finalAmount ?? order.totalAmount),
    length: 25,
    breadth: 20,
    height: Math.max(2, totalQty * 3),
    weight: weightKg,
  };

  const data = await srPost<Record<string, unknown>>("/orders/create/adhoc", payload);

  if (!data.order_id) {
    logger.error({ data, orderId }, "Shiprocket order creation returned no order_id");
    throw new AppError(
      (data.message as string | undefined) ?? "Failed to create Shiprocket order",
      502,
      "SHIPROCKET_CREATE_FAILED",
    );
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      shiprocketOrderId:    String(data.order_id),
      shiprocketShipmentId: data.shipment_id ? String(data.shipment_id) : null,
      shiprocketStatus:     "CREATED",
      // Some accounts auto-assign AWB on order creation
      awbCode:     (data.awb_code as string | undefined) || null,
      courierName: (data.courier_name as string | undefined) || null,
      trackingUrl: data.awb_code
        ? `https://shiprocket.co/tracking/${data.awb_code}`
        : null,
    },
  });

  logger.info({ orderId, shiprocketOrderId: data.order_id }, "Shiprocket shipment created");
  return updated;
}

// ── Generate AWB ──────────────────────────────────────────────────────────────

export async function generateAWB(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (!order.shiprocketShipmentId) {
    throw new AppError("Create shipment first before generating AWB", 400, "NO_SHIPMENT");
  }
  if (order.awbCode) {
    throw new AppError("AWB already generated for this order", 409, "AWB_EXISTS");
  }

  const addr  = order.shippingAddress as { pincode: string };
  const isCOD = order.paymentMethod === "COD";

  // Check available couriers — fall back gracefully if this fails
  let courierId: number | undefined;
  try {
    const pickupPin = env.SHIPROCKET_PICKUP_PINCODE ?? "110001";
    const svc = await srGet<Record<string, unknown>>(
      `/courier/serviceability/?pickup_postcode=${pickupPin}&delivery_postcode=${addr.pincode}&weight=0.5&cod=${isCOD ? 1 : 0}`,
    );
    const available = (svc as any)?.data?.available_courier_companies as unknown[];
    if (Array.isArray(available) && available.length > 0) {
      const recommended =
        (available.find((c: any) => c.is_recommended) as any) ?? (available[0] as any);
      courierId = recommended.courier_company_id as number;
    }
  } catch (err) {
    logger.warn({ orderId, err }, "Courier serviceability check failed – proceeding without courier_id");
  }

  const payload: Record<string, unknown> = {
    shipment_id: [Number(order.shiprocketShipmentId)],
  };
  if (courierId) payload.courier_id = courierId;

  const data = await srPost<Record<string, unknown>>("/courier/assign/awb", payload);

  const awb =
    (data as any)?.response?.data?.awb_code ?? (data as any)?.awb_code as string | undefined;
  const courierName =
    (data as any)?.response?.data?.courier_name ?? (data as any)?.courier_name as string | undefined;
  const labelUrl =
    (data as any)?.response?.data?.label_url as string | undefined;

  if (!awb) {
    logger.error({ data, orderId }, "AWB generation failed");
    throw new AppError(
      (data as any)?.message ??
        (data as any)?.response?.data?.awb_assign_status_message ??
        "AWB generation failed. Check Shiprocket dashboard.",
      502,
      "AWB_FAILED",
    );
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      awbCode:          awb,
      courierName:      courierName ?? null,
      trackingUrl:      `https://shiprocket.co/tracking/${awb}`,
      labelUrl:         labelUrl ?? null,
      shiprocketStatus: "AWB_ASSIGNED",
    },
  });

  logger.info({ orderId, awb, courierName }, "AWB generated");
  return updated;
}

// ── Generate Shipping Label ───────────────────────────────────────────────────

export async function generateLabel(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (!order.shiprocketShipmentId) {
    throw new AppError("No shipment found. Generate AWB first.", 400, "NO_SHIPMENT");
  }

  const data = await srPost<Record<string, unknown>>("/courier/generate/label", {
    shipment_id: [Number(order.shiprocketShipmentId)],
  });

  const labelUrl =
    (data as any)?.label_url ?? (data as any)?.response?.label_url as string | undefined;
  if (!labelUrl) {
    throw new AppError(
      (data as any)?.message ?? "Label generation failed",
      502,
      "LABEL_FAILED",
    );
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { labelUrl, shiprocketStatus: "LABEL_GENERATED" },
  });

  return { labelUrl, order: updated };
}

// ── Generate Shipping Invoice (Shiprocket's, distinct from our email invoice) ─

export async function generateShippingInvoice(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (!order.shiprocketOrderId) {
    throw new AppError("No Shiprocket order found. Create shipment first.", 400, "NO_SHIPMENT");
  }

  const data = await srGet<Record<string, unknown>>(
    `/orders/print/invoice?ids=${order.shiprocketOrderId}`,
  );

  const invoiceUrl = (data as any)?.invoice_url as string | undefined;
  if (!invoiceUrl) {
    throw new AppError(
      (data as any)?.message ?? "Invoice generation failed",
      502,
      "INVOICE_FAILED",
    );
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { invoiceUrl },
  });

  return { invoiceUrl, order: updated };
}

// ── Generate Manifest ─────────────────────────────────────────────────────────

export async function generateManifest(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (!order.shiprocketShipmentId) {
    throw new AppError("No shipment found. Generate AWB first.", 400, "NO_SHIPMENT");
  }

  const data = await srPost<Record<string, unknown>>("/manifests/generate", {
    shipment_id: [Number(order.shiprocketShipmentId)],
  });

  const manifestUrl = (data as any)?.manifest_url as string | undefined;
  if (!manifestUrl) {
    throw new AppError(
      (data as any)?.message ?? "Manifest generation failed",
      502,
      "MANIFEST_FAILED",
    );
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { manifestUrl },
  });

  return { manifestUrl, order: updated };
}

// ── Track Shipment ────────────────────────────────────────────────────────────

export async function trackShipment(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");

  if (order.awbCode) {
    return srGet<Record<string, unknown>>(`/courier/track/awb/${order.awbCode}`);
  }
  if (order.shiprocketShipmentId) {
    return srGet<Record<string, unknown>>(
      `/courier/track/shipment/${order.shiprocketShipmentId}`,
    );
  }

  throw new AppError(
    "No AWB or shipment ID available. Generate AWB first.",
    400,
    "NO_TRACKING_INFO",
  );
}

// ── Cancel Shipment ───────────────────────────────────────────────────────────

export async function cancelShipment(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (!order.shiprocketOrderId) {
    throw new AppError("No Shiprocket order to cancel", 400, "NO_SHIPMENT");
  }

  const data = await srPost<Record<string, unknown>>("/orders/cancel", {
    ids: [Number(order.shiprocketOrderId)],
  });

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { shiprocketStatus: "CANCELLED" },
  });

  logger.info({ orderId }, "Shiprocket shipment cancelled");
  return { data, order: updated };
}

// ── Sync Order Status from Shiprocket ─────────────────────────────────────────

export async function syncStatus(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (!order.shiprocketOrderId) {
    throw new AppError("No Shiprocket order to sync", 400, "NO_SHIPMENT");
  }

  const data = await srGet<Record<string, unknown>>(
    `/orders/show/${order.shiprocketOrderId}`,
  );

  const srStatus  = (data as any)?.data?.status as string | undefined;
  const freshAwb  = (data as any)?.data?.awb_code as string | undefined;
  const awbCode   = freshAwb || order.awbCode;

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      shiprocketStatus: srStatus ?? order.shiprocketStatus ?? "UNKNOWN",
      awbCode:     awbCode ?? null,
      trackingUrl: awbCode ? `https://shiprocket.co/tracking/${awbCode}` : order.trackingUrl,
    },
  });

  return { srData: data, order: updated };
}

// ── Webhook Processor ─────────────────────────────────────────────────────────

// Mapping Shiprocket status strings → our OrderStatus enum values
const SR_STATUS_MAP: Record<string, string> = {
  "Delivered":          "DELIVERED",
  "RTO Delivered":      "RETURNED",
  "Cancelled":          "CANCELLED",
  "Shipment Created":   "CONFIRMED",
  "Pickup Scheduled":   "CONFIRMED",
  "Pickup Pending":     "CONFIRMED",
  "Pickup Generated":   "CONFIRMED",
  "In Transit":         "SHIPPED",
  "Reached at Hub":     "SHIPPED",
  "Out For Delivery":   "SHIPPED",
  "Shipped":            "SHIPPED",
};

export async function processWebhook(payload: Record<string, unknown>) {
  const awb = payload.awb as string | undefined;
  if (!awb) {
    logger.warn({ payload }, "Shiprocket webhook received without AWB – ignored");
    return;
  }

  const order = await prisma.order.findFirst({ where: { awbCode: awb } });
  if (!order) {
    logger.warn({ awb }, "Shiprocket webhook: no order matched for this AWB");
    return;
  }

  const currentStatus = payload.current_status as string | undefined;
  const updateData: Record<string, unknown> = {};

  if (currentStatus) {
    updateData.shiprocketStatus = currentStatus;
    const mapped = SR_STATUS_MAP[currentStatus];
    if (mapped) updateData.status = mapped;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.order.update({ where: { id: order.id }, data: updateData as any });
    logger.info(
      { orderId: order.id, awb, currentStatus, mapped: updateData.status },
      "Shiprocket webhook: order status updated",
    );
  }
}
