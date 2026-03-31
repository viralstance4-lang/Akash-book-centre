import nodemailer from "nodemailer";
import env from "../config/env";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.GMAIL_USER,
    pass: env.GMAIL_PASS,
  },
});

type OrderItem = {
  title: string;
  quantity: number;
  price: number;
  bindingType?: string;
  bindingExtra?: number;
};

type OrderInvoiceData = {
  orderId: string;
  items: OrderItem[];
  total: number;
  discount?: number;
  paymentMethod: string;
  shippingAddress: any;
  createdAt: string;
  customerEmail?: string;
};

const buildOrderHtml = (orderData: OrderInvoiceData, isAdmin = false) => {
  const itemsHtml = orderData.items.map((item) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ece4;">${item.title}${item.bindingType && item.bindingType !== "NONE" ? ` <span style="font-size:11px;color:#b45309;">(${item.bindingType === "SPIRAL" ? "Spiral" : "Staple"} Binding)</span>` : ""}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ece4;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ece4;text-align:right;">₹${item.price}${item.bindingExtra ? ` +₹${item.bindingExtra}` : ""}</td>
    </tr>
  `).join("");

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e8e5df;border-radius:12px;overflow:hidden;">
      <div style="background:#1d1a17;padding:24px 32px;">
        <h1 style="color:white;margin:0;font-size:22px;">${isAdmin ? "🔔 New Order Received!" : "Order Confirmed! 🎉"}</h1>
        <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;">Order #${orderData.orderId.slice(0, 8).toUpperCase()}</p>
      </div>
      <div style="padding:24px 32px;">
        ${isAdmin
          ? `<p style="color:#5a5a5a;background:#fef9c3;padding:12px;border-radius:8px;border-left:4px solid #ca8a04;">
              <strong>Customer:</strong> ${orderData.shippingAddress?.name ?? "—"} &nbsp;|&nbsp;
              <strong>Phone:</strong> ${orderData.shippingAddress?.phone ?? "—"} &nbsp;|&nbsp;
              <strong>Email:</strong> ${orderData.customerEmail ?? "—"}
            </p>`
          : `<p style="color:#5a5a5a;">Thank you for your order. Here is your invoice:</p>`
        }
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <thead>
            <tr style="background:#f8f4ee;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#9a9a9a;text-transform:uppercase;">Item</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;color:#9a9a9a;text-transform:uppercase;">Qty</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:#9a9a9a;text-transform:uppercase;">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        ${orderData.discount ? `<p style="text-align:right;color:green;margin:0;">Discount: -₹${orderData.discount}</p>` : ""}
        <p style="text-align:right;font-size:18px;font-weight:bold;color:#1d1a17;margin:8px 0;">Total: ₹${orderData.total}</p>
        <p style="color:#5a5a5a;font-size:14px;">Payment: <strong>${orderData.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment (Razorpay)"}</strong></p>
        <div style="background:#f8f4ee;border-radius:8px;padding:16px;margin-top:16px;">
          <p style="margin:0;font-size:13px;color:#5a5a5a;font-weight:bold;">Shipping Address:</p>
          <p style="margin:8px 0 0;font-size:13px;color:#5a5a5a;">
            ${orderData.shippingAddress?.name ?? ""}<br/>
            ${orderData.shippingAddress?.line1 ?? ""}${orderData.shippingAddress?.line2 ? ", " + orderData.shippingAddress.line2 : ""}<br/>
            ${orderData.shippingAddress?.city ?? ""}, ${orderData.shippingAddress?.state ?? ""} - ${orderData.shippingAddress?.pincode ?? ""}<br/>
            Phone: ${orderData.shippingAddress?.phone ?? ""}
          </p>
        </div>
      </div>
      <div style="background:#f8f4ee;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9a9a9a;">BucketList Books · ${isAdmin ? "Manage orders in your admin panel." : "Thank you for shopping with us!"}</p>
      </div>
    </div>
  `;
};

export const sendOrderInvoice = async (
  to: string,
  orderData: OrderInvoiceData,
) => {
  if (!env.GMAIL_USER || !env.GMAIL_PASS) return;

  const html = buildOrderHtml(orderData, false);

  await transporter.sendMail({
    from: `"BucketList Books" <${env.GMAIL_USER}>`,
    to,
    subject: `Order Confirmed - #${orderData.orderId.slice(0, 8).toUpperCase()}`,
    html,
  });
};

export const sendAdminOrderNotification = async (
  orderData: OrderInvoiceData,
) => {
  if (!env.GMAIL_USER || !env.GMAIL_PASS) return;

  const html = buildOrderHtml(orderData, true);
  const adminEmail = env.ADMIN_EMAIL || env.GMAIL_USER;

  await transporter.sendMail({
    from: `"BucketList Books" <${env.GMAIL_USER}>`,
    to: adminEmail,
    subject: `[NEW ORDER] #${orderData.orderId.slice(0, 8).toUpperCase()} — ${orderData.paymentMethod} — ₹${orderData.total}`,
    html,
  });
};

type PrintOrderEmailData = {
  orderId: string;
  colorType: string;
  printSide: string;
  orientation: string;
  bindingType: string;
  pageCount: number;
  total: number;
  paymentMethod: string;
  customerEmail?: string;
  userName?: string;
};

const buildPrintOrderHtml = (orderData: PrintOrderEmailData, isAdmin = false) => `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e8e5df;border-radius:12px;overflow:hidden;">
    <div style="background:#1d1a17;padding:24px 32px;">
      <h1 style="color:white;margin:0;font-size:22px;">${isAdmin ? "🖨️ New Print Order!" : "Print Order Confirmed! 📚"}</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;">Order #${orderData.orderId.slice(0, 8).toUpperCase()}</p>
    </div>
    <div style="padding:24px 32px;">
      ${isAdmin ? `<p style="color:#5a5a5a;background:#fef9c3;padding:12px;border-radius:8px;border-left:4px solid #ca8a04;">
        <strong>Customer:</strong> ${orderData.userName ?? "—"} &nbsp;|&nbsp;
        <strong>Email:</strong> ${orderData.customerEmail ?? "—"} &nbsp;|&nbsp;
        <strong>Payment:</strong> ${orderData.paymentMethod === "COD" ? "Cash on Delivery" : "Online"}
      </p>` : ""}
      <table style="width:100%;border-collapse:collapse;">
        ${[
          ["Print Type", orderData.colorType === "color" ? "Color" : "Black & White"],
          ["Print Side", orderData.printSide === "single" ? "Single Side" : "Both Sides"],
          ["Orientation", orderData.orientation],
          ["Binding", orderData.bindingType === "spiral" ? "Spiral" : "Stapler"],
          ["Pages", String(orderData.pageCount)],
          ["Payment", orderData.paymentMethod === "COD" ? "Cash on Delivery" : "Online"],
          ["Total", `₹${orderData.total}`],
        ].map(([k, v]) => `<tr><td style="padding:8px;color:#9a9a9a;font-size:13px;">${k}</td><td style="padding:8px;font-weight:bold;color:#1d1a17;font-size:13px;">${v}</td></tr>`).join("")}
      </table>
    </div>
    <div style="background:#f8f4ee;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9a9a9a;">BucketList Books · ${isAdmin ? "Manage in your admin panel." : "We'll process your print order shortly!"}</p>
    </div>
  </div>
`;

export const sendPrintOrderInvoice = async (
  to: string,
  orderData: PrintOrderEmailData,
) => {
  if (!env.GMAIL_USER || !env.GMAIL_PASS) return;

  const html = buildPrintOrderHtml(orderData, false);

  await transporter.sendMail({
    from: `"BucketList Books" <${env.GMAIL_USER}>`,
    to,
    subject: `Print Order Confirmed - #${orderData.orderId.slice(0, 8).toUpperCase()}`,
    html,
  });
};

export const sendAdminPrintOrderNotification = async (
  orderData: PrintOrderEmailData,
) => {
  if (!env.GMAIL_USER || !env.GMAIL_PASS) return;

  const html = buildPrintOrderHtml(orderData, true);
  const adminEmail = env.ADMIN_EMAIL || env.GMAIL_USER;

  await transporter.sendMail({
    from: `"BucketList Books" <${env.GMAIL_USER}>`,
    to: adminEmail,
    subject: `[PRINT ORDER] #${orderData.orderId.slice(0, 8).toUpperCase()} — ${orderData.paymentMethod} — ₹${orderData.total}`,
    html,
  });
};
