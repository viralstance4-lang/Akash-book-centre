import dotenv from "dotenv";
import { z, ZodError } from "zod";

dotenv.config();

const schema = z.object({
  DATABASE_URL:           z.string().min(1),
  PORT:                   z.string().min(1).transform((v) => parseInt(v, 10)),
  NODE_ENV:               z.enum(["development", "production", "test"]),
  JWT_ACCESS_SECRET:      z.string().min(1),
  JWT_REFRESH_SECRET:     z.string().min(1),
  JWT_ACCESS_EXPIRES_IN:  z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1),
  CLOUDINARY_CLOUD_NAME:  z.string().min(1),
  CLOUDINARY_API_KEY:     z.string().min(1),
  CLOUDINARY_API_SECRET:  z.string().min(1),
  RAZORPAY_KEY_ID:        z.string().min(1),
  RAZORPAY_KEY_SECRET:    z.string().min(1),
  GMAIL_USER:             z.string().optional(),
  GMAIL_PASS:             z.string().optional(),
  ADMIN_EMAIL:            z.string().optional(),
  SUPPORT_EMAIL:          z.string().optional(),
  ADMIN_OTP_EMAIL:        z.string().optional(),
  OTP_EXPIRY_MINUTES:     z.string().optional().default("5").transform((v) => parseInt(v, 10)),
  CORS_ORIGIN:            z
    .string()
    .optional()
    .default("http://localhost:5173")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),

  // ── Shiprocket (optional – for shipment creation and tracking) ──────────────
  /** Email used to login to Shiprocket dashboard */
  SHIPROCKET_EMAIL:           z.string().optional(),
  /** Password for Shiprocket account */
  SHIPROCKET_PASSWORD:        z.string().optional(),
  /** Name of the pickup location as configured in Shiprocket dashboard (default: Primary) */
  SHIPROCKET_PICKUP_LOCATION: z.string().optional().default("Primary"),
  /** Pincode of your pickup/warehouse address (used for courier serviceability check) */
  SHIPROCKET_PICKUP_PINCODE:  z.string().optional().default("110001"),
  /** Optional secret token appended to webhook URL for basic security */
  SHIPROCKET_WEBHOOK_TOKEN:   z.string().optional(),

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
