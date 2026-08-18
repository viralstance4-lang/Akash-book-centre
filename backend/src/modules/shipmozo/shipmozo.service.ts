import AppError from "../../lib/AppError";
import logger from "../../config/logger";
import prisma from "../../lib/prisma";
import env from "../../config/env";
import { PACKAGING_WEIGHT_KG } from "../shipping/shipping.service";

const BASE    = "https://shipping-api.com/app/api/v1";
const TIMEOUT = 20_000;

// ── Guards ────────────────────────────────────────────────────────────────────

export function isShipmozoConfigured(): boolean {
  return Boolean(env.SHIPMOZO_PUBLIC_KEY && env.SHIPMOZO_PRIVATE_KEY);
}

function assertConfigured(): void {
  if (!isShipmozoConfigured()) {
    throw new AppError(
      "Shipmozo is not configured. Add SHIPMOZO_PUBLIC_KEY and SHIPMOZO_PRIVATE_KEY to your environment.",
      503,
      "SHIPMOZO_NOT_CONFIGURED",
    );
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function smHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "public-key":   env.SHIPMOZO_PUBLIC_KEY!,
    "private-key":  env.SHIPMOZO_PRIVATE_KEY!,
  };
}

async function smPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  "POST",
    headers: smHeaders(),
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(TIMEOUT),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok || String(data.result) !== "1") {
    const msg = (data.message as string | undefined) ?? `Shipmozo API error (${res.status})`;
    logger.error({ path, status: res.status, data }, "Shipmozo POST error");
    throw new AppError(msg, 502, "SHIPMOZO_API_ERROR");
  }
  return data as T;
}

async function smGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: smHeaders(),
    signal:  AbortSignal.timeout(TIMEOUT),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok || String(data.result) !== "1") {
    const msg = (data.message as string | undefined) ?? `Shipmozo API error (${res.status})`;
    logger.error({ path, status: res.status, data }, "Shipmozo GET error");
    throw new AppError(msg, 502, "SHIPMOZO_API_ERROR");
  }
  return data as T;
}

// ── Create Shipment ───────────────────────────────────────────────────────────

export async function createShipment(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({
    where:   { id: orderId },
    include: { items: { include: { book: true } } },
  });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (order.shipmozoOrderId) {
    throw new AppError("Shipment already exists for this order", 409, "SHIPMENT_EXISTS");
  }

  const addr = order.shippingAddress as {
    name: string; phone: string; line1: string; line2?: string;
    city: string; state: string; pincode: string;
  };

  // Weight in grams (Shipmozo uses grams); our system stores kg
  const productWeightKg = order.items.reduce((s, i) => {
    const w = i.book.weight ? Number(i.book.weight) : 0.3;
    return s + w * i.quantity;
  }, 0);
  const totalWeightGrams = Math.max(100, Math.round((productWeightKg + PACKAGING_WEIGHT_KG) * 1000));

  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

  const payload = {
    order_id:                  order.id.slice(0, 20).toUpperCase(),
    order_date:                order.createdAt.toISOString().split("T")[0],
    consignee_name:            addr.name,
    consignee_phone:           Number(addr.phone.replace(/\D/g, "").slice(-10)),
    consignee_email:           order.customerEmail ?? "",
    consignee_address_line_one: addr.line1,
    consignee_address_line_two: addr.line2 ?? "",
    consignee_pin_code:        Number(addr.pincode),
    consignee_city:            addr.city,
    consignee_state:           addr.state,
    product_detail: order.items.map((item) => ({
      name:             item.book.title.slice(0, 100),
      sku_number:       item.book.isbn ?? item.bookId.slice(0, 20),
      quantity:         item.quantity,
      discount:         "",
      hsn:              "4901",  // Books HSN code
      unit_price:       Number(item.priceAtPurchase),
      product_category: "Books",
    })),
    payment_type:    order.paymentMethod === "COD" ? "COD" : "PREPAID",
    cod_amount:      order.paymentMethod === "COD" ? Number(order.finalAmount ?? order.totalAmount) : "",
    shipping_charges: Number(order.deliveryCharge ?? 0),
    weight:          totalWeightGrams,
    length:          25,
    width:           20,
    height:          Math.max(2, totalQty * 3),
    warehouse_id:    env.SHIPMOZO_WAREHOUSE_ID ?? "",
    gst_ewaybill_number: "",
    gstin_number:    "",
  };

  const data = await smPost<{ result: string; message: string; data: { order_id: string; refrence_id: string } }>(
    "/push-order",
    payload,
  );

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      shipmozoOrderId:     data.data.order_id,
      shipmozoReferenceId: data.data.refrence_id,
      shipmozoStatus:      "CREATED",
    },
  });

  logger.info({ orderId, shipmozoOrderId: data.data.order_id }, "Shipmozo shipment created");
  return updated;
}

// ── Auto-Assign Courier & get AWB ─────────────────────────────────────────────

export async function assignCourier(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (!order.shipmozoOrderId) {
    throw new AppError("Create shipment first before assigning courier", 400, "NO_SHIPMENT");
  }
  if (order.awbCode) {
    throw new AppError("AWB already generated for this order", 409, "AWB_EXISTS");
  }

  const data = await smPost<{ result: string; message: string; data: { awb_number?: string; courier_name?: string; tracking_url?: string } }>(
    "/auto-assign-order",
    { order_id: order.shipmozoOrderId },
  );

  const awb         = (data.data?.awb_number  as string | undefined) ?? null;
  const courierName = (data.data?.courier_name as string | undefined) ?? null;
  const trackingUrl = awb ? `https://shipmozo.in/tracking/${awb}` : null;

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      awbCode:        awb,
      courierName:    courierName,
      trackingUrl:    trackingUrl,
      shipmozoStatus: "AWB_ASSIGNED",
    },
  });

  logger.info({ orderId, awb }, "Shipmozo AWB assigned");
  return updated;
}

// ── Track Shipment ────────────────────────────────────────────────────────────

export async function trackShipment(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (!order.awbCode) {
    throw new AppError("AWB not generated yet. Assign courier first.", 400, "NO_AWB");
  }

  const data = await smGet<Record<string, unknown>>(`/track-order?awb_number=${order.awbCode}`);
  return data;
}

// ── Get Shipping Label ────────────────────────────────────────────────────────

export async function getLabel(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (!order.awbCode) {
    throw new AppError("AWB not generated yet. Assign courier first.", 400, "NO_AWB");
  }

  const data = await smGet<{ result: string; data?: { label_url?: string } }>(
    `/get-order-label/${order.awbCode}`,
  );

  const labelUrl = (data.data?.label_url as string | undefined) ?? null;
  if (labelUrl) {
    await prisma.order.update({ where: { id: orderId }, data: { labelUrl } });
  }

  return { labelUrl, order: await prisma.order.findUnique({ where: { id: orderId } }) };
}

// ── Generate Manifest ─────────────────────────────────────────────────────────

export async function generateManifest(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (!order.awbCode) {
    throw new AppError("AWB not generated yet. Assign courier first.", 400, "NO_AWB");
  }

  const data = await smGet<{ result: string; data?: { manifest_url?: string } }>(
    `/generate-manifest?awb_number=${order.awbCode}`,
  );

  const manifestUrl = (data.data?.manifest_url as string | undefined) ?? null;
  if (manifestUrl) {
    await prisma.order.update({ where: { id: orderId }, data: { manifestUrl } });
  }

  return { manifestUrl, order: await prisma.order.findUnique({ where: { id: orderId } }) };
}

// ── Cancel Shipment ───────────────────────────────────────────────────────────

export async function cancelShipment(orderId: string) {
  assertConfigured();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (!order.shipmozoOrderId) {
    throw new AppError("No shipment found for this order", 400, "NO_SHIPMENT");
  }

  const data = await smPost<{ result: string; message: string }>(
    "/cancel-order",
    { order_id: order.shipmozoOrderId },
  );

  const updated = await prisma.order.update({
    where: { id: orderId },
    data:  { shipmozoStatus: "CANCELLED" },
  });

  logger.info({ orderId }, "Shipmozo shipment cancelled");
  return { data, order: updated };
}

// ── Check Pincode Serviceability ──────────────────────────────────────────────

export async function checkServiceability(deliveryPincode: string) {
  assertConfigured();

  const pickupPincode = env.SHIPMOZO_PICKUP_PINCODE ?? "110008";
  const data = await smPost<{ result: string; data: { serviceable: boolean } }>(
    "/pincode-serviceability",
    {
      pickup_pincode:   Number(pickupPincode),
      delivery_pincode: Number(deliveryPincode),
    },
  );

  return { serviceable: data.data?.serviceable ?? false };
}

// ── Test Connection ───────────────────────────────────────────────────────────

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  if (!isShipmozoConfigured()) {
    return { ok: false, message: "SHIPMOZO_PUBLIC_KEY or SHIPMOZO_PRIVATE_KEY missing in .env" };
  }
  try {
    const res = await fetch(`${BASE}/pincode-serviceability`, {
      method:  "POST",
      headers: smHeaders(),
      body:    JSON.stringify({ pickup_pincode: 110008, delivery_pincode: 110008 }),
      signal:  AbortSignal.timeout(TIMEOUT),
    });
    const data = await res.json() as Record<string, unknown>;
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "Invalid API keys — check SHIPMOZO_PUBLIC_KEY and SHIPMOZO_PRIVATE_KEY." };
    }
    if (res.ok) return { ok: true, message: "Shipmozo connected successfully! Keys are valid." };
    return { ok: false, message: (data.message as string | undefined) ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: String(err instanceof Error ? err.message : err) };
  }
}
