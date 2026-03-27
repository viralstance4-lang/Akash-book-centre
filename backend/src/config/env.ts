import dotenv from "dotenv";
import { z, ZodError } from "zod";

dotenv.config();

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.string().min(1).transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(["development", "production", "test"]),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  GMAIL_USER: z.string().optional(),
  GMAIL_PASS: z.string().optional(),
  CORS_ORIGIN: z.string().optional().default("http://localhost:5173"),
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
