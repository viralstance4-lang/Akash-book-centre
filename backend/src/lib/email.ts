import nodemailer from "nodemailer";
import env from "../config/env";
import logger from "../config/logger";

const SUPPORT_EMAIL = env.SUPPORT_EMAIL ?? "akashbookcentre5500@gmail.com";

const isGmailConfigured = Boolean(
  env.GMAIL_USER &&
    env.GMAIL_PASS &&
    !env.GMAIL_USER.toLowerCase().includes("your_gmail") &&
    !env.GMAIL_PASS.toLowerCase().includes("your_16_digit_app_password"),
);

// ── Transporter — explicit port 587 (STARTTLS) ────────────────────────────────
// Render free tier blocks outbound port 465 (Gmail SSL).
// Port 587 with STARTTLS works on all Render plans.
// Do NOT use service:"gmail" — it defaults to port 465 which times out on Render.
// IPv4 is forced via NODE_OPTIONS=--dns-result-order=ipv4first in Render env vars.
// Render free tier has no IPv6 outbound — without this Gmail's IPv6 address
// (2607:f8b0:...) is tried first and immediately fails with ENETUNREACH.
const transporter = nodemailer.createTransport({
  host:   "smtp.gmail.com",
  port:   587,
  secure: false,  // STARTTLS — port 465 (SSL) is blocked on Render free tier
  auth:   { user: env.GMAIL_USER, pass: env.GMAIL_PASS },
  connectionTimeout: 15_000,
  greetingTimeout:   15_000,
  socketTimeout:     30_000,
});

// ── Startup transporter verification ─────────────────────────────────────────
// Called by server.ts on boot so SMTP misconfiguration is caught early.
export async function verifyTransporter(): Promise<void> {
  if (!isGmailConfigured) {
    logger.warn("[EMAIL] Gmail credentials not configured — email sending is disabled");
    return;
  }
  try {
    await transporter.verify();
    logger.info("[EMAIL] SMTP transporter verified successfully");
  } catch (err) {
    logger.error({ err }, "[EMAIL] SMTP transporter verification failed");
    throw err;
  }
}

// ── Retry helper ──────────────────────────────────────────────────────────────
// Retries up to maxAttempts with exponential backoff (2 s → 4 s → 8 s).
// Email failures are non-fatal so errors are logged, never thrown.
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 2_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const sendMailSafe = async (options: nodemailer.SendMailOptions): Promise<void> => {
  if (!isGmailConfigured) {
    logger.warn(
      { GMAIL_USER: env.GMAIL_USER, GMAIL_PASS: env.GMAIL_PASS ? "SET" : "MISSING" },
      "[EMAIL] Gmail not configured — skipping send",
    );
    return;
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const info = await transporter.sendMail(options);
      logger.info(
        { to: options.to, subject: options.subject, messageId: info.messageId, attempt },
        "[EMAIL] Sent successfully",
      );
      return;
    } catch (err) {
      lastErr = err;
      logger.warn(
        { to: options.to, subject: options.subject, attempt, maxAttempts: MAX_ATTEMPTS, err },
        `[EMAIL] Send attempt ${attempt} failed`,
      );
      if (attempt < MAX_ATTEMPTS) {
        await sleep(BACKOFF_BASE_MS * attempt); // 2 s, 4 s, 8 s
      }
    }
  }

  logger.error(
    { to: options.to, subject: options.subject, err: lastErr },
    "[EMAIL] All send attempts failed — email not delivered",
  );
};

// ─── Shared Helpers ───────────────────────────────────────────────────────────

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
  deliveryCharge?: number;
  discount?: number;
  paymentMethod: string;
  shippingAddress: any;
  createdAt: string;
  customerEmail?: string;
  invoiceNumber?: string;
};

const buildOrderHtml = (orderData: OrderInvoiceData, isAdmin = false) => {
  const itemsHtml = orderData.items
    .map(
      (item) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ece4;">${item.title}${item.bindingType && item.bindingType !== "NONE" ? ` <span style="font-size:11px;color:#b45309;">(${item.bindingType === "SPIRAL" ? "Spiral" : "Staple"} Binding)</span>` : ""}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ece4;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ece4;text-align:right;">₹${item.price}${item.bindingExtra ? ` +₹${item.bindingExtra}` : ""}</td>
    </tr>
  `,
    )
    .join("");

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e8e5df;border-radius:12px;overflow:hidden;">
      <div style="background:#1d1a17;padding:24px 32px;">
        <h1 style="color:white;margin:0;font-size:22px;">${isAdmin ? "🔔 New Order Received!" : "Order Confirmed! 🎉"}</h1>
        <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;">Order #${orderData.orderId.slice(0, 8).toUpperCase()}</p>
      </div>
      <div style="padding:24px 32px;">
        ${
          isAdmin
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
        <p style="margin:0;font-size:12px;color:#9a9a9a;">Akash Book Centre · ${isAdmin ? "Manage orders in your admin panel." : "Thank you for shopping with us!"}</p>
        ${!isAdmin ? `<p style="margin:4px 0 0;font-size:11px;color:#b0b0b0;">Questions? Email us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#9a9a9a;">${SUPPORT_EMAIL}</a></p>` : ""}
      </div>
    </div>
  `;
};

export const sendOrderInvoice = async (
  to: string,
  orderData: OrderInvoiceData,
  pdfBuffer?: Buffer,
) => {
  if (!env.GMAIL_USER || !env.GMAIL_PASS) return;
  logger.info({ to, orderId: orderData.orderId }, "[EMAIL] Sending order invoice");
  const subject = orderData.invoiceNumber
    ? `Invoice ${orderData.invoiceNumber} — Order Confirmed #${orderData.orderId.slice(0, 8).toUpperCase()}`
    : `Order Confirmed - #${orderData.orderId.slice(0, 8).toUpperCase()}`;
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"Akash Book Centre" <${env.GMAIL_USER}>`,
    to,
    subject,
    html: buildOrderHtml(orderData, false),
  };
  if (pdfBuffer) {
    mailOptions.attachments = [
      {
        filename: `${orderData.invoiceNumber ?? `invoice-${orderData.orderId.slice(0, 8).toUpperCase()}`}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ];
  }
  await sendMailSafe(mailOptions);
};

export const sendAdminOrderNotification = async (orderData: OrderInvoiceData) => {
  if (!env.GMAIL_USER || !env.GMAIL_PASS) return;
  const adminEmail = env.ADMIN_EMAIL || SUPPORT_EMAIL;
  logger.info({ to: adminEmail, orderId: orderData.orderId }, "[EMAIL] Sending admin order notification");
  await sendMailSafe({
    from: `"Akash Book Centre" <${env.GMAIL_USER}>`,
    to: adminEmail,
    subject: `[NEW ORDER] #${orderData.orderId.slice(0, 8).toUpperCase()} — ${orderData.paymentMethod} — ₹${orderData.total}`,
    html: buildOrderHtml(orderData, true),
  });
};

// ─── Print Order Emails ───────────────────────────────────────────────────────

type PrintFileItem = {
  name: string;
  copies: number;
  pageCount?: number;
};

type PrintOrderEmailData = {
  orderId: string;
  colorType: string;
  printSide: string;
  orientation: string;
  bindingType: string;
  pageCount: number;
  copies: number;
  estimatedMinutes: number;
  total: number;
  paymentMethod: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  fileNames?: string[];
  fileItems?: PrintFileItem[];
  createdAt?: string;
  invoiceNumber?: string;
};

const buildPrintOrderHtml = (d: PrintOrderEmailData, isAdmin = false) => {
  const orderRef = d.orderId.slice(0, 8).toUpperCase();
  const orderDate = d.createdAt
    ? new Date(d.createdAt).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })
    : new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" });

  const fileItems: PrintFileItem[] =
    d.fileItems && d.fileItems.length > 0
      ? d.fileItems
      : (d.fileNames ?? []).map((n) => ({ name: n, copies: 1 }));

  const filesHtml =
    fileItems.length > 0
      ? `
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        <thead>
          <tr style="background:#f8f4ee;">
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:#9a9a9a;text-transform:uppercase;letter-spacing:.05em;">#</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;color:#9a9a9a;text-transform:uppercase;letter-spacing:.05em;">File Name</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:#9a9a9a;text-transform:uppercase;letter-spacing:.05em;">Pages</th>
            <th style="padding:9px 12px;text-align:center;font-size:11px;color:#9a9a9a;text-transform:uppercase;letter-spacing:.05em;">Copies</th>
          </tr>
        </thead>
        <tbody>
          ${fileItems
            .map(
              (f, i) => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #f0ece4;font-size:12px;color:#9a9a9a;">${i + 1}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f0ece4;font-size:13px;color:#1d1a17;max-width:260px;overflow:hidden;text-overflow:ellipsis;">${f.name}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f0ece4;font-size:13px;color:#5a5a5a;text-align:center;">${f.pageCount ?? "—"}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f0ece4;font-size:13px;font-weight:bold;color:#1d1a17;text-align:center;">${f.copies}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>`
      : "";

  const specRows = [
    ["Print Type", d.colorType === "color" ? "Color" : "Black &amp; White"],
    ["Print Side", d.printSide === "single" ? "Single Side" : "Both Sides"],
    ["Orientation", d.orientation.charAt(0).toUpperCase() + d.orientation.slice(1)],
    ["Binding", d.bindingType === "spiral" ? "Spiral Binding" : "Staple Binding"],
    ["Total Pages", String(d.pageCount)],
    ["Total Copies", String(d.copies)],
    ["Est. Print Time", `~${d.estimatedMinutes} min`],
  ];

  return `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e0dbd3;border-radius:16px;overflow:hidden;">
      <div style="background:#1d1a17;padding:28px 36px;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,0.5);">
          ${isAdmin ? "Admin Notification" : "Order Invoice"}
        </p>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">
          ${isAdmin ? "🖨️ New Print Order Received" : "Your Print Order is Confirmed!"}
        </h1>
        <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">
          Order #${orderRef} &nbsp;·&nbsp; ${orderDate}
        </p>
      </div>
      <div style="padding:28px 36px;">
        ${
          isAdmin
            ? `<div style="background:#fef9c3;border-left:4px solid #ca8a04;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;font-weight:bold;color:#5a5a5a;margin-bottom:8px;">Customer Details</p>
              <table style="border-collapse:collapse;width:100%;">
                <tr><td style="padding:3px 0;font-size:13px;color:#9a9a9a;width:90px;">Name</td><td style="padding:3px 0;font-size:13px;color:#1d1a17;font-weight:600;">${d.customerName ?? "—"}</td></tr>
                <tr><td style="padding:3px 0;font-size:13px;color:#9a9a9a;">Email</td><td style="padding:3px 0;font-size:13px;color:#1d1a17;">${d.customerEmail ?? "—"}</td></tr>
                <tr><td style="padding:3px 0;font-size:13px;color:#9a9a9a;">Phone</td><td style="padding:3px 0;font-size:13px;color:#1d1a17;">${d.customerPhone ?? "—"}</td></tr>
                <tr><td style="padding:3px 0;font-size:13px;color:#9a9a9a;vertical-align:top;">Address</td><td style="padding:3px 0;font-size:13px;color:#1d1a17;">${d.customerAddress ?? "—"}</td></tr>
              </table>
            </div>`
            : `<p style="margin:0 0 20px;font-size:15px;color:#5a5a5a;">
              Hi <strong>${d.customerName ?? "there"}</strong>, thank you for your print order!
              We have received your request and will process it shortly.
            </p>`
        }
        ${
          fileItems.length > 0
            ? `
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9a9a9a;">
            Uploaded Files (${fileItems.length})
          </p>
          ${filesHtml}`
            : ""
        }
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9a9a9a;">
          Print Specifications
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          ${specRows
            .map(
              ([k, v]) => `
            <tr>
              <td style="padding:7px 0;font-size:13px;color:#9a9a9a;width:45%;">${k}</td>
              <td style="padding:7px 0;font-size:13px;font-weight:600;color:#1d1a17;">${v}</td>
            </tr>
          `,
            )
            .join("")}
        </table>
        <div style="background:#f8f4ee;border-radius:12px;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <p style="margin:0;font-size:12px;color:#9a9a9a;text-transform:uppercase;letter-spacing:.06em;">Total Amount</p>
            <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#8f2d22;">₹${d.total}</p>
          </div>
          <div style="text-align:right;">
            <p style="margin:0;font-size:12px;color:#9a9a9a;">Payment Method</p>
            <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#1d1a17;">Online (Prepaid)</p>
          </div>
        </div>
        ${
          !isAdmin
            ? `
          <div style="margin-top:20px;border:1px solid #e8e5df;border-radius:10px;padding:16px 18px;">
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9a9a9a;">Your Contact Details</p>
            <table style="border-collapse:collapse;width:100%;">
              <tr><td style="padding:3px 0;font-size:13px;color:#9a9a9a;width:80px;">Phone</td><td style="padding:3px 0;font-size:13px;color:#1d1a17;">${d.customerPhone ?? "—"}</td></tr>
              <tr><td style="padding:3px 0;font-size:13px;color:#9a9a9a;vertical-align:top;">Address</td><td style="padding:3px 0;font-size:13px;color:#1d1a17;">${d.customerAddress ?? "—"}</td></tr>
            </table>
          </div>`
            : ""
        }
        <p style="margin:20px 0 0;font-size:13px;color:#9a9a9a;line-height:1.6;">
          ${
            isAdmin
              ? "Log in to your admin panel to view and manage this order."
              : "If you have any questions about your order, please contact us and quote your order number <strong>#" +
                orderRef +
                "</strong>."
          }
        </p>
      </div>
      <div style="background:#f8f4ee;padding:18px 36px;text-align:center;border-top:1px solid #e8e5df;">
        <p style="margin:0;font-size:13px;font-weight:600;color:#1d1a17;">Akash Book Centre</p>
        <p style="margin:4px 0 0;font-size:11px;color:#9a9a9a;">
          ${isAdmin ? "Admin notification — do not reply." : "Thank you for choosing us!"}
        </p>
        ${!isAdmin ? `<p style="margin:4px 0 0;font-size:11px;color:#b0b0b0;">Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:#9a9a9a;">${SUPPORT_EMAIL}</a></p>` : ""}
      </div>
    </div>
  `;
};

export const sendPrintOrderInvoice = async (
  to: string,
  d: PrintOrderEmailData,
  pdfBuffer?: Buffer,
) => {
  if (!env.GMAIL_USER || !env.GMAIL_PASS) return;
  logger.info({ to, orderId: d.orderId }, "[EMAIL] Sending print order invoice");
  const subject = d.invoiceNumber
    ? `Invoice ${d.invoiceNumber} — Print Order #${d.orderId.slice(0, 8).toUpperCase()}`
    : `Your Print Order Invoice — #${d.orderId.slice(0, 8).toUpperCase()}`;
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"Akash Book Centre" <${env.GMAIL_USER}>`,
    to,
    subject,
    html: buildPrintOrderHtml(d, false),
  };
  if (pdfBuffer) {
    mailOptions.attachments = [
      {
        filename: `${d.invoiceNumber ?? `invoice-${d.orderId.slice(0, 8).toUpperCase()}`}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ];
  }
  await sendMailSafe(mailOptions);
};

export const sendAdminPrintOrderNotification = async (d: PrintOrderEmailData) => {
  if (!env.GMAIL_USER || !env.GMAIL_PASS) return;
  const adminEmail = env.ADMIN_EMAIL || SUPPORT_EMAIL;
  logger.info({ to: adminEmail, orderId: d.orderId }, "[EMAIL] Sending admin print order notification");
  await sendMailSafe({
    from: `"Akash Book Centre" <${env.GMAIL_USER}>`,
    to: adminEmail,
    subject: `[PRINT ORDER] #${d.orderId.slice(0, 8).toUpperCase()} — ₹${d.total} — ${d.customerName ?? "Customer"}`,
    html: buildPrintOrderHtml(d, true),
  });
};

// ─── OTP Email ────────────────────────────────────────────────────────────────

export const sendVerificationEmail = async (
  to: string,
  name: string,
  code: string,
  expiryMinutes: number,
) => {
  if (!env.GMAIL_USER || !env.GMAIL_PASS) return;
  logger.info({ to }, "[EMAIL] Sending verification email");
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#fff;border:1px solid #e8e5df;border-radius:12px;overflow:hidden;">
      <div style="background:#1d1a17;padding:24px 32px;">
        <h1 style="color:white;margin:0;font-size:22px;">Verify Your Email</h1>
        <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">Akash Book Centre</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#5a5a5a;font-size:15px;margin:0 0 8px;">Hi <strong>${name}</strong>,</p>
        <p style="color:#5a5a5a;font-size:15px;margin:0 0 24px;">Enter the code below to verify your email and activate your account. It expires in <strong>${expiryMinutes} minutes</strong>.</p>
        <div style="text-align:center;background:#f8f4ee;border-radius:12px;padding:24px;">
          <p style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#1d1a17;margin:0;">${code}</p>
        </div>
        <p style="color:#9a9a9a;font-size:12px;margin:20px 0 0;">If you didn't create an account at Akash Book Centre, you can safely ignore this email.</p>
      </div>
    </div>
  `;
  await sendMailSafe({
    from: `"Akash Book Centre" <${env.GMAIL_USER}>`,
    to,
    subject: `${code} — Verify your Akash Book Centre account`,
    html,
  });
};

export const sendOtpEmail = async (to: string, code: string, expiryMinutes: number) => {
  if (!env.GMAIL_USER || !env.GMAIL_PASS) return;
  logger.info({ to }, "[EMAIL] Sending OTP email");
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#fff;border:1px solid #e8e5df;border-radius:12px;overflow:hidden;">
      <div style="background:#1d1a17;padding:24px 32px;">
        <h1 style="color:white;margin:0;font-size:22px;">Your Login OTP</h1>
        <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">Akash Book Centre</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#5a5a5a;font-size:15px;margin:0 0 24px;">Use the code below to sign in. It expires in <strong>${expiryMinutes} minutes</strong>.</p>
        <div style="text-align:center;background:#f8f4ee;border-radius:12px;padding:24px;">
          <p style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#1d1a17;margin:0;">${code}</p>
        </div>
        <p style="color:#9a9a9a;font-size:12px;margin:20px 0 0;">If you didn't request this OTP, you can safely ignore this email.</p>
      </div>
    </div>
  `;
  await sendMailSafe({
    from: `"Akash Book Centre" <${env.GMAIL_USER}>`,
    to,
    subject: `${code} is your Akash Book Centre login code`,
    html,
  });
};

// ─── Admin Login OTP ─────────────────────────────────────────────────────────

export const sendAdminLoginOtp = async (to: string, code: string, expiryMinutes: number) => {
  if (!isGmailConfigured) {
    logger.warn({ code }, "[EMAIL] Gmail not configured — admin OTP not sent");
    return;
  }
  logger.info({ to }, "[EMAIL] Sending admin login OTP");
  const html = `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e0dbd3;border-radius:16px;overflow:hidden;">
      <div style="background:#051d40;padding:28px 36px;">
        <p style="margin:0 0 8px;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,0.45);">Akash Book Centre</p>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Admin Login Verification</h1>
        <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.55);">Two-Factor Authentication Code</p>
      </div>
      <div style="padding:36px;">
        <p style="margin:0 0 6px;font-size:15px;color:#1d1a17;font-weight:600;">Your Admin Login Verification Code is:</p>
        <p style="margin:0 0 28px;font-size:13px;color:#6b7280;">Enter this code in the admin login screen to complete sign-in.</p>
        <div style="text-align:center;background:linear-gradient(135deg,#051d40 0%,#0a3570 100%);border-radius:14px;padding:34px 24px;margin-bottom:28px;">
          <p style="font-size:52px;font-weight:800;letter-spacing:18px;color:#d6b269;margin:0;font-family:monospace;">${code}</p>
          <p style="margin:14px 0 0;font-size:12px;color:rgba(255,255,255,0.55);letter-spacing:.1em;text-transform:uppercase;">Valid for ${expiryMinutes} minutes only</p>
        </div>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 18px;margin-bottom:24px;">
          <p style="margin:0 0 6px;font-size:13px;color:#b91c1c;font-weight:700;">⚠ Security Notice</p>
          <p style="margin:0;font-size:13px;color:#dc2626;line-height:1.6;">Do not share this code with anyone. This code grants admin access to the store management panel. Akash Book Centre staff will never ask you for this code.</p>
        </div>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.7;">If you did not attempt to log in to the admin panel, your account credentials may be compromised. Please change your password immediately.</p>
      </div>
      <div style="background:#f8f4ee;padding:18px 36px;text-align:center;border-top:1px solid #e8e5df;">
        <p style="margin:0;font-size:12px;font-weight:600;color:#1d1a17;">Akash Book Centre — Admin Security</p>
        <p style="margin:4px 0 0;font-size:11px;color:#9a9a9a;">Automated security notification · Do not reply to this email</p>
      </div>
    </div>
  `;
  logger.info({ to, expiryMinutes }, "[ADMIN OTP] Sending admin OTP email");
  await sendMailSafe({
    from: `"Akash Book Centre Security" <${env.GMAIL_USER}>`,
    to,
    subject: `${code} — Admin Login Verification Code (${expiryMinutes} min)`,
    html,
  });
};

// ─── SMS / WhatsApp Invoice Notification ─────────────────────────────────────

export const sendInvoiceNotification = async (payload: {
  orderId: string;
  orderType: "BOOK" | "PRINT";
  customerName: string;
  customerEmail?: string;
  total: number;
  paymentMethod: string;
}) => {
  const phones = env.INVOICE_NOTIFY_PHONES;
  if (!phones || phones.length === 0) return;

  const orderRef = payload.orderId.slice(0, 8).toUpperCase();
  const message =
    `📦 *New ${payload.orderType === "PRINT" ? "Print " : ""}Order #${orderRef}*\n` +
    `Customer: ${payload.customerName}\n` +
    `Email: ${payload.customerEmail ?? "—"}\n` +
    `Amount: ₹${payload.total}\n` +
    `Payment: ${payload.paymentMethod === "COD" ? "Cash on Delivery" : "Online (Razorpay)"}`;

  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) {
    for (const to of phones) {
      try {
        const authHeader = Buffer.from(
          `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
        ).toString("base64");
        const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
        const params = new URLSearchParams({
          Body: message,
          From: env.TWILIO_FROM,
          To: to,
        }).toString();

        const http = await import("https");
        await new Promise<void>((resolve, reject) => {
          const options = {
            method: "POST",
            headers: {
              Authorization: `Basic ${authHeader}`,
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": Buffer.byteLength(params),
            },
          };
          const req = http.request(url, options, (res) => {
            res.on("data", () => {});
            res.on("end", () => resolve());
          });
          req.on("error", reject);
          req.write(params);
          req.end();
        });
        logger.info({ to }, "[Invoice Notify] Twilio message sent");
      } catch (err) {
        logger.warn({ to, err }, "[Invoice Notify] Failed to send Twilio message");
      }
    }
  } else {
    logger.info(
      { phones, message },
      "[Invoice Notify] Twilio not configured — would have sent notification",
    );
  }
};
