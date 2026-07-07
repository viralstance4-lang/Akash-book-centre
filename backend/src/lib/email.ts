import nodemailer from "nodemailer";
import { Resend } from "resend";
import env from "../config/env";
import logger from "../config/logger";

const SUPPORT_EMAIL = env.SUPPORT_EMAIL ?? "akashbookcentre5500@gmail.com";
const FROM_ADDRESS  = env.RESEND_FROM ?? "Akash Book Centre <onboarding@resend.dev>";

// ── Resend client (primary) ───────────────────────────────────────────────────
// Without a verified custom domain / RESEND_FROM, onboarding@resend.dev only
// delivers to the Resend account owner. Customer emails will fail until the
// user verifies a domain at resend.com/domains and sets RESEND_FROM in .env.
// We still keep Resend enabled so admin OTP (sent to the account-owner email)
// continues to work.
const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// ── Gmail SMTP transporter (primary when RESEND_FROM not set, fallback otherwise) ──
// Gmail App Passwords are 16 chars; Google displays them with spaces for readability.
const gmailPass = env.GMAIL_PASS?.replace(/\s/g, "");
const gmailTransport =
  env.GMAIL_USER && gmailPass
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: env.GMAIL_USER, pass: gmailPass },
      })
    : null;

export const isEmailConfigured = Boolean(resendClient) || Boolean(gmailTransport);
export const isGmailConfigured = Boolean(gmailTransport);

// ── Startup verification ──────────────────────────────────────────────────────
export async function verifyTransporter(): Promise<void> {
  // Warn if RESEND_FROM is not set — customer emails will fail (domain not verified)
  if (env.RESEND_API_KEY && !env.RESEND_FROM) {
    logger.warn(
      "[EMAIL] RESEND_FROM not set — Resend will send from onboarding@resend.dev. " +
      "This ONLY delivers to the Resend account owner email. " +
      "Customer invoice emails will FAIL until you: " +
      "1) verify a domain at resend.com/domains, " +
      "2) add RESEND_FROM=<noreply@yourdomain.com> to .env, " +
      "3) restart the server.",
    );
  }

  if (resendClient && gmailTransport) {
    logger.info({ primary: FROM_ADDRESS, fallback: env.GMAIL_USER }, "[EMAIL] Resend (primary) + Gmail SMTP (fallback) both ready");
    return;
  }
  if (resendClient) {
    logger.info({ from: FROM_ADDRESS }, "[EMAIL] Resend API configured — ready (no Gmail fallback)");
    return;
  }
  if (gmailTransport && env.GMAIL_USER) {
    logger.info({ from: env.GMAIL_USER }, "[EMAIL] Gmail SMTP configured — ready");
    return;
  }
  logger.warn("[EMAIL] No email provider configured — RESEND_API_KEY and GMAIL_USER both missing");
}

// ── Retry helper ──────────────────────────────────────────────────────────────
const MAX_ATTEMPTS    = 1;   // Resend domain errors are deterministic — no point retrying
const BACKOFF_BASE_MS = 2_000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type MailPayload = {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
};

const sendMailSafe = async (options: MailPayload): Promise<void> => {
  // ── Primary: Resend ───────────────────────────────────────────────────────
  if (resendClient) {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const payload: Parameters<typeof resendClient.emails.send>[0] = {
          from:    FROM_ADDRESS,
          to:      [options.to],
          subject: options.subject,
          html:    options.html,
        };
        if (options.attachments?.length) {
          payload.attachments = options.attachments.map((a) => ({
            filename: a.filename,
            content:  a.content,
          }));
        }
        const { error } = await resendClient.emails.send(payload);
        if (error) throw new Error(error.message);

        logger.info(
          { to: options.to, subject: options.subject, attempt },
          "[EMAIL] Sent via Resend",
        );
        return;

      } catch (err) {
        lastErr = err;
        logger.warn(
          { to: options.to, attempt, maxAttempts: MAX_ATTEMPTS, err },
          `[EMAIL] Resend attempt ${attempt} failed`,
        );
        if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_BASE_MS * attempt);
      }
    }

    logger.warn(
      { to: options.to, err: lastErr },
      "[EMAIL] Resend failed after all attempts — trying Gmail fallback",
    );
  }

  // ── Fallback: Gmail SMTP ─────────────────────────────────────────────────
  if (gmailTransport && env.GMAIL_USER) {
    try {
      await gmailTransport.sendMail({
        from:    `"Akash Book Centre" <${env.GMAIL_USER}>`,
        to:      options.to,
        subject: options.subject,
        html:    options.html,
        ...(options.attachments?.length
          ? {
              attachments: options.attachments.map((a) => ({
                filename:    a.filename,
                content:     a.content,
                contentType: a.contentType,
              })),
            }
          : {}),
      });
      logger.info(
        { to: options.to, subject: options.subject },
        "[EMAIL] Sent via Gmail SMTP fallback",
      );
      return;
    } catch (err) {
      logger.error({ to: options.to, err }, "[EMAIL] Gmail SMTP fallback also failed");
    }
  }

  if (!resendClient && !gmailTransport) {
    logger.warn("[EMAIL] No email provider configured — skipping send");
  } else {
    logger.error({ to: options.to, subject: options.subject }, "[EMAIL] All email providers failed");
  }
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
  if (!isEmailConfigured) return;
  logger.info({ to, orderId: orderData.orderId }, "[EMAIL] Sending order invoice");
  const subject = orderData.invoiceNumber
    ? `Invoice ${orderData.invoiceNumber} — Order Confirmed #${orderData.orderId.slice(0, 8).toUpperCase()}`
    : `Order Confirmed - #${orderData.orderId.slice(0, 8).toUpperCase()}`;
  const mailOptions: MailPayload = {
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
  if (!isEmailConfigured) return;
  const adminEmail = env.ADMIN_EMAIL || SUPPORT_EMAIL;
  logger.info({ to: adminEmail, orderId: orderData.orderId }, "[EMAIL] Sending admin order notification");
  await sendMailSafe({
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
  if (!isEmailConfigured) return;
  logger.info({ to, orderId: d.orderId }, "[EMAIL] Sending print order invoice");
  const subject = d.invoiceNumber
    ? `Invoice ${d.invoiceNumber} — Print Order #${d.orderId.slice(0, 8).toUpperCase()}`
    : `Your Print Order Invoice — #${d.orderId.slice(0, 8).toUpperCase()}`;
  const mailOptions: MailPayload = {
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
  if (!isEmailConfigured) return;
  const adminEmail = env.ADMIN_EMAIL || SUPPORT_EMAIL;
  logger.info({ to: adminEmail, orderId: d.orderId }, "[EMAIL] Sending admin print order notification");
  await sendMailSafe({
    to: adminEmail,
    subject: `[PRINT ORDER] #${d.orderId.slice(0, 8).toUpperCase()} — ₹${d.total} — ${d.customerName ?? "Customer"}`,
    html: buildPrintOrderHtml(d, true),
  });
};

// ─── OTP / Verification Emails ────────────────────────────────────────────────

export const sendVerificationEmail = async (
  to: string,
  name: string,
  code: string,
  expiryMinutes: number,
) => {
  if (!isEmailConfigured) return;
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
    to,
    subject: `${code} — Verify your Akash Book Centre account`,
    html,
  });
};

export const sendOtpEmail = async (to: string, code: string, expiryMinutes: number) => {
  if (!isEmailConfigured) return;
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
    to,
    subject: `${code} is your Akash Book Centre login code`,
    html,
  });
};

// ─── Admin Login OTP ─────────────────────────────────────────────────────────

export const sendAdminLoginOtp = async (to: string, code: string, expiryMinutes: number) => {
  const subject = `${code} — Admin Login Verification Code (${expiryMinutes} min)`;
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
  // ── Provider cascade: Resend → Gmail SMTP → console log ─────────────────
  if (isEmailConfigured) {
    // Primary: Resend (production / Render)
    logger.info({ to }, "[EMAIL] Sending admin login OTP via Resend");
    await sendMailSafe({ to, subject, html });
    return;
  }

  if (gmailTransport && env.GMAIL_USER) {
    // Fallback: Gmail SMTP (local dev — Gmail is blocked on Render)
    logger.info({ to }, "[EMAIL] Sending admin login OTP via Gmail SMTP (dev fallback)");
    try {
      await gmailTransport.sendMail({
        from:    `"Akash Book Centre Admin" <${env.GMAIL_USER}>`,
        to,
        subject,
        html,
      });
      logger.info({ to }, "[EMAIL] Admin OTP sent via Gmail SMTP");
    } catch (err) {
      logger.error(
        { err: (err as Error).message, to },
        "[EMAIL] Gmail SMTP failed — check GMAIL_USER / GMAIL_PASS in .env",
      );
    }
    return;
  }

  // Last resort: no email provider at all — log OTP so dev can still log in
  logger.warn(
    { adminOtpCode: code, to, expiryMinutes },
    "[EMAIL] No email provider configured. " +
    "DEV: copy 'adminOtpCode' from this log into the 2FA screen to log in. " +
    "Add RESEND_API_KEY (or GMAIL_USER + GMAIL_PASS) to .env to enable email.",
  );
};

// ─── Return / Refund Emails ───────────────────────────────────────────────────

type ReturnEmailData = {
  orderId: string;
  returnId: string;
  customerName: string;
  customerEmail?: string;
  reason: string;
  items: Array<{ title: string; quantity: number }>;
  refundAmount?: number;
  status: string;
};

export const sendReturnRequestEmail = async (to: string, d: ReturnEmailData) => {
  if (!isEmailConfigured) return;
  logger.info({ to, returnId: d.returnId }, "[EMAIL] Sending return request confirmation");
  const itemsHtml = d.items
    .map((i) => `<li style="padding:4px 0;font-size:13px;color:#5a5a5a;">${i.title} × ${i.quantity}</li>`)
    .join("");
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e5df;border-radius:12px;overflow:hidden;">
      <div style="background:#1d1a17;padding:24px 32px;">
        <h1 style="color:white;margin:0;font-size:22px;">Return Request Received</h1>
        <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">Order #${d.orderId.slice(0, 8).toUpperCase()}</p>
      </div>
      <div style="padding:28px 32px;">
        <p style="color:#5a5a5a;font-size:15px;margin:0 0 16px;">Hi <strong>${d.customerName}</strong>, we have received your return request.</p>
        <div style="background:#f8f4ee;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;color:#9a9a9a;letter-spacing:.06em;">Return Reference</p>
          <p style="margin:0;font-size:18px;font-weight:bold;color:#1d1a17;">#${d.returnId.slice(0, 8).toUpperCase()}</p>
        </div>
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#1d1a17;">Items Requested for Return:</p>
        <ul style="margin:0 0 16px;padding-left:20px;">${itemsHtml}</ul>
        <p style="font-size:13px;color:#5a5a5a;margin:0 0 8px;"><strong>Reason:</strong> ${d.reason}</p>
        ${d.refundAmount ? `<p style="font-size:13px;color:#5a5a5a;margin:0 0 8px;"><strong>Refund Amount:</strong> ₹${d.refundAmount}</p>` : ""}
        <p style="font-size:13px;color:#5a5a5a;margin:0 0 20px;"><strong>Status:</strong> ${d.status}</p>
        <p style="font-size:13px;color:#9a9a9a;line-height:1.6;">Our team will review your request and get back to you within 2–3 business days. For queries, contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#1d1a17;">${SUPPORT_EMAIL}</a>.</p>
      </div>
      <div style="background:#f8f4ee;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9a9a9a;">Akash Book Centre · Thank you for your patience.</p>
      </div>
    </div>
  `;
  await sendMailSafe({ to, subject: `Return Request Received — #${d.returnId.slice(0, 8).toUpperCase()}`, html });
};

export const sendAdminReturnNotification = async (d: ReturnEmailData) => {
  if (!isEmailConfigured) return;
  const adminEmail = env.ADMIN_EMAIL || SUPPORT_EMAIL;
  logger.info({ to: adminEmail, returnId: d.returnId }, "[EMAIL] Sending admin return notification");
  const itemsHtml = d.items
    .map((i) => `<li style="padding:4px 0;font-size:13px;color:#5a5a5a;">${i.title} × ${i.quantity}</li>`)
    .join("");
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e5df;border-radius:12px;overflow:hidden;">
      <div style="background:#8f2d22;padding:24px 32px;">
        <h1 style="color:white;margin:0;font-size:22px;">🔄 New Return Request</h1>
        <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;">Order #${d.orderId.slice(0, 8).toUpperCase()}</p>
      </div>
      <div style="padding:28px 32px;">
        <div style="background:#fef9c3;border-left:4px solid #ca8a04;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
          <p style="margin:0;font-size:13px;color:#5a5a5a;">
            <strong>Customer:</strong> ${d.customerName} &nbsp;|&nbsp;
            <strong>Email:</strong> ${d.customerEmail ?? "—"} &nbsp;|&nbsp;
            <strong>Return #:</strong> ${d.returnId.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#1d1a17;">Items:</p>
        <ul style="margin:0 0 16px;padding-left:20px;">${itemsHtml}</ul>
        <p style="font-size:13px;color:#5a5a5a;margin:0 0 8px;"><strong>Reason:</strong> ${d.reason}</p>
        ${d.refundAmount ? `<p style="font-size:13px;color:#5a5a5a;margin:0;"><strong>Refund Amount:</strong> ₹${d.refundAmount}</p>` : ""}
      </div>
      <div style="background:#f8f4ee;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9a9a9a;">Review and process this return in your admin panel.</p>
      </div>
    </div>
  `;
  await sendMailSafe({
    to: adminEmail,
    subject: `[RETURN REQUEST] #${d.returnId.slice(0, 8).toUpperCase()} — Order #${d.orderId.slice(0, 8).toUpperCase()}`,
    html,
  });
};

// ─── Shipment Tracking Email ──────────────────────────────────────────────────

type ShipmentUpdateData = {
  orderId: string;
  customerName: string;
  trackingId?: string;
  courierName?: string;
  trackingUrl?: string;
  status: string;
  estimatedDelivery?: string;
};

export const sendShipmentUpdateEmail = async (to: string, d: ShipmentUpdateData) => {
  if (!isEmailConfigured) return;
  logger.info({ to, orderId: d.orderId }, "[EMAIL] Sending shipment update");
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e5df;border-radius:12px;overflow:hidden;">
      <div style="background:#1d1a17;padding:24px 32px;">
        <h1 style="color:white;margin:0;font-size:22px;">📦 Shipment Update</h1>
        <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">Order #${d.orderId.slice(0, 8).toUpperCase()}</p>
      </div>
      <div style="padding:28px 32px;">
        <p style="color:#5a5a5a;font-size:15px;margin:0 0 20px;">Hi <strong>${d.customerName}</strong>, here is an update on your shipment.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px 20px;margin-bottom:20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;color:#16a34a;letter-spacing:.06em;">Current Status</p>
          <p style="margin:0;font-size:18px;font-weight:bold;color:#15803d;">${d.status}</p>
        </div>
        ${d.trackingId ? `
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          ${d.courierName ? `<tr><td style="padding:7px 0;font-size:13px;color:#9a9a9a;width:45%;">Courier</td><td style="padding:7px 0;font-size:13px;font-weight:600;color:#1d1a17;">${d.courierName}</td></tr>` : ""}
          <tr><td style="padding:7px 0;font-size:13px;color:#9a9a9a;">Tracking ID</td><td style="padding:7px 0;font-size:13px;font-weight:600;color:#1d1a17;">${d.trackingId}</td></tr>
          ${d.estimatedDelivery ? `<tr><td style="padding:7px 0;font-size:13px;color:#9a9a9a;">Est. Delivery</td><td style="padding:7px 0;font-size:13px;font-weight:600;color:#1d1a17;">${d.estimatedDelivery}</td></tr>` : ""}
        </table>` : ""}
        ${d.trackingUrl ? `<a href="${d.trackingUrl}" style="display:inline-block;background:#1d1a17;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;margin-bottom:20px;">Track Your Order</a>` : ""}
        <p style="font-size:13px;color:#9a9a9a;line-height:1.6;margin:0;">Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#1d1a17;">${SUPPORT_EMAIL}</a></p>
      </div>
      <div style="background:#f8f4ee;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9a9a9a;">Akash Book Centre · Thank you for your order.</p>
      </div>
    </div>
  `;
  await sendMailSafe({
    to,
    subject: `Your Order #${d.orderId.slice(0, 8).toUpperCase()} has been shipped — ${d.status}`,
    html,
  });
};

// ─── Contact Form / Support Email ─────────────────────────────────────────────

type ContactFormData = {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
};

export const sendContactFormEmail = async (d: ContactFormData) => {
  if (!isEmailConfigured) return;
  const adminEmail = env.ADMIN_EMAIL || SUPPORT_EMAIL;
  logger.info({ from: d.email, subject: d.subject }, "[EMAIL] Sending contact form submission");
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e5df;border-radius:12px;overflow:hidden;">
      <div style="background:#1d1a17;padding:24px 32px;">
        <h1 style="color:white;margin:0;font-size:22px;">📬 New Contact Form Submission</h1>
        <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:14px;">Akash Book Centre Website</p>
      </div>
      <div style="padding:28px 32px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:7px 0;font-size:13px;color:#9a9a9a;width:80px;">Name</td><td style="padding:7px 0;font-size:13px;font-weight:600;color:#1d1a17;">${d.name}</td></tr>
          <tr><td style="padding:7px 0;font-size:13px;color:#9a9a9a;">Email</td><td style="padding:7px 0;font-size:13px;color:#1d1a17;"><a href="mailto:${d.email}" style="color:#1d1a17;">${d.email}</a></td></tr>
          ${d.phone ? `<tr><td style="padding:7px 0;font-size:13px;color:#9a9a9a;">Phone</td><td style="padding:7px 0;font-size:13px;color:#1d1a17;">${d.phone}</td></tr>` : ""}
          <tr><td style="padding:7px 0;font-size:13px;color:#9a9a9a;vertical-align:top;">Subject</td><td style="padding:7px 0;font-size:13px;font-weight:600;color:#1d1a17;">${d.subject}</td></tr>
        </table>
        <div style="background:#f8f4ee;border-radius:8px;padding:16px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;color:#9a9a9a;letter-spacing:.06em;">Message</p>
          <p style="margin:0;font-size:14px;color:#5a5a5a;line-height:1.7;white-space:pre-wrap;">${d.message}</p>
        </div>
      </div>
      <div style="background:#f8f4ee;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9a9a9a;">Reply directly to ${d.email} to respond to this customer.</p>
      </div>
    </div>
  `;
  await sendMailSafe({ to: adminEmail, subject: `[CONTACT] ${d.subject} — ${d.name}`, html });
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
