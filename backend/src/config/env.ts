import dotenv from "dotenv";
import { z, ZodError } from "zod";

dotenv.config();

const schema = z.object({
  DATABASE_URL:           z.string().min(1),
  /**
   * Explicitly controls whether Postgres connections use SSL.
   * Set "false" for local Docker Postgres (no SSL support).
   * Leave unset in production to keep the default (SSL on) for managed DBs.
   */
  DATABASE_SSL:           z.enum(["true", "false"]).optional(),
  PORT:                   z.string().min(1).transform((v) => parseInt(v, 10)),
  NODE_ENV:               z.enum(["development", "production", "test"]),
  JWT_ACCESS_SECRET:      z.string().min(1),
  JWT_REFRESH_SECRET:     z.string().min(1),
  JWT_ACCESS_EXPIRES_IN:  z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1),
  CLOUDINARY_CLOUD_NAME:  z.string().min(1),
  CLOUDINARY_API_KEY:     z.string().min(1),
  CLOUDINARY_API_SECRET:  z.string().min(1),
  RAZORPAY_KEY_ID:             z.string().min(1),
  RAZORPAY_KEY_SECRET:         z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET:     z.string().optional(),
  ADMIN_EMAIL:            z.string().optional(),
  SUPPORT_EMAIL:          z.string().optional(),
  ADMIN_OTP_EMAIL:        z.string().optional(),
  OTP_EXPIRY_MINUTES:     z.string().optional().default("5").transform((v) => parseInt(v, 10)),
  CORS_ORIGIN:            z
    .string()
    .optional()
    .default("http://localhost:5173")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),

  // ── Store location & distance calculation ────────────────────────────────────
  /** Google Maps API key (Distance Matrix API) — optional; falls back to Haversine when unset */
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  /** Fixed store address used as the delivery-distance origin */
  STORE_ADDRESS: z
    .string()
    .optional()
    .default("3026/5A, Ranjeet Nagar, Hanuman Chowk, Near Hanuman Mandir & Shiv Chowk, South Patel Nagar, New Delhi – 110008"),
  /** Store latitude — defaults to the geocoded coordinates of STORE_ADDRESS */
  STORE_LATITUDE: z.string().optional().default("28.646457").transform((v) => parseFloat(v)),
  /** Store longitude — defaults to the geocoded coordinates of STORE_ADDRESS */
  STORE_LONGITUDE: z.string().optional().default("77.158939").transform((v) => parseFloat(v)),

  // ── Shipmozo (optional – for shipment creation and tracking) ────────────────
  /** Shipmozo API public key — from dashboard → API Documentation */
  SHIPMOZO_PUBLIC_KEY:      z.string().optional(),
  /** Shipmozo API private key — from dashboard → API Documentation */
  SHIPMOZO_PRIVATE_KEY:     z.string().optional(),
  /** Warehouse ID configured in Shipmozo (leave blank to use default) */
  SHIPMOZO_WAREHOUSE_ID:    z.string().optional().default(""),
  /** Pincode of your pickup/warehouse address (used for serviceability check) */
  SHIPMOZO_PICKUP_PINCODE:  z.string().optional().default("110008"),

  // ── Email — Resend (production / Render) ─────────────────────────────────────
  /** Resend API key — get free at resend.com (3000 emails/month) */
  RESEND_API_KEY: z.string().optional(),
  /**
   * "From" address for all outgoing emails.
   * Requires a verified domain: "Akash Book Centre <noreply@yourdomain.com>"
   */
  RESEND_FROM: z.string().optional(),

  // ── Email — Gmail SMTP (local dev fallback when Resend not configured) ────────
  /** Gmail address used as SMTP sender — e.g. sanamaryam089@gmail.com */
  GMAIL_USER: z.string().optional(),
  /**
   * Gmail App Password (16 chars, spaces optional).
   * Generate at: myaccount.google.com → Security → App Passwords
   */
  GMAIL_PASS: z.string().optional(),

  // ── Diagnostics (optional — remove after initial setup) ─────────────────────
  /** Secret key to access /api/v1/diag/email without login (remove after debugging) */
  DIAGNOSTIC_SECRET: z.string().optional(),

  // ── Render / Production ──────────────────────────────────────────────────────
  /** Full public URL of this backend, e.g. https://your-app.onrender.com */
  BACKEND_URL: z.string().optional(),
  /** Global API request timeout in ms (default: 30 000) */
  REQUEST_TIMEOUT_MS: z
    .string()
    .optional()
    .default("30000")
    .transform((v) => parseInt(v, 10)),

  // ── Twilio (optional – for SMS/WhatsApp invoice notifications) ──────────────
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN:  z.string().optional(),
  /** Twilio sender number, e.g. "whatsapp:+14155238886" or "+1234567890" */
  TWILIO_FROM:        z.string().optional(),
  /**
   * Comma-separated E.164 phone numbers that receive order invoice notifications.
   * For WhatsApp prefix each number with "whatsapp:", e.g.:
   *   INVOICE_NOTIFY_PHONES=whatsapp:+919990018434,whatsapp:+917840043285
   */
  INVOICE_NOTIFY_PHONES: z
    .string()
    .optional()
    .transform((v) =>
      v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [],
    ),
}).superRefine((data, ctx) => {
  // Without this secret, payments.controller.ts cannot verify webhook signatures,
  // so anyone could POST a fake Razorpay webhook and flip payment status.
  if (data.NODE_ENV === "production" && !data.RAZORPAY_WEBHOOK_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["RAZORPAY_WEBHOOK_SECRET"],
      message: "RAZORPAY_WEBHOOK_SECRET is required when NODE_ENV=production (Razorpay webhook signature verification would otherwise be skipped)",
    });
  }
});

let env: z.infer<typeof schema>;

try {
  env = schema.parse(process.env);
} catch (e) {
  if (e instanceof ZodError) {
    throw new Error(
      "Invalid environment variables:\n" +
        e.issues.map((err) => `${String(err.path[0])}: ${err.message}`).join("\n"),
    );
  }
  throw e;
}

export default env;
