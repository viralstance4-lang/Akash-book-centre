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
  CORS_ORIGIN:            z.string().optional().default("http://localhost:5173"),

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
