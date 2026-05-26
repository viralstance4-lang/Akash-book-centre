import { Router, type RequestHandler } from "express";
import { Resend } from "resend";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import { verifyTransporter } from "../../lib/email";
import env from "../../config/env";
import logger from "../../config/logger";

const adminRouter = Router();
adminRouter.use(authMiddleware, requireAdmin);

// POST /api/v1/admin/test-email
// Sends a test email via Resend to ADMIN_OTP_EMAIL to confirm delivery on Render.
const testEmail: RequestHandler = async (_req, res) => {
  const result: Record<string, unknown> = {
    RESEND_API_KEY:  env.RESEND_API_KEY  ? `${env.RESEND_API_KEY.slice(0, 8)}****` : "NOT SET",
    RESEND_FROM:     env.RESEND_FROM     ?? "NOT SET",
    ADMIN_OTP_EMAIL: env.ADMIN_OTP_EMAIL ?? "NOT SET",
    NODE_ENV:        env.NODE_ENV,
  };

  if (!env.RESEND_API_KEY) {
    res.status(400).json({
      success: false,
      message: "RESEND_API_KEY not set in environment variables",
      config: result,
    });
    return;
  }

  await verifyTransporter();
  result.providerCheck = "PASSED";

  const to = env.ADMIN_OTP_EMAIL ?? env.ADMIN_EMAIL ?? "";
  if (!to) {
    res.status(400).json({
      success: false,
      message: "ADMIN_OTP_EMAIL not set — no recipient for test email",
      config: result,
    });
    return;
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const from   = env.RESEND_FROM ?? "Akash Book Centre <onboarding@resend.dev>";
    const { error } = await resend.emails.send({
      from,
      to:      [to],
      subject: "✅ Resend Test — Akash Book Centre Backend",
      html:    `<p>Resend is working correctly on Render (${env.NODE_ENV}).<br/>From: ${from}<br/>Sent: ${new Date().toISOString()}</p>`,
    });
    if (error) throw new Error(error.message);

    result.emailSent = true;
    result.emailTo   = to;
    logger.info({ to }, "[EMAIL TEST] Test email sent via Resend");
    res.status(200).json({
      success: true,
      message: `✅ Test email sent to ${to} — check inbox (and spam folder)`,
      config: result,
    });
  } catch (err) {
    result.emailSent  = false;
    result.emailError = (err as Error).message;
    logger.error({ err, to }, "[EMAIL TEST] Resend test email failed");
    res.status(502).json({
      success: false,
      message: "Resend email send failed — check RESEND_API_KEY",
      config: result,
    });
  }
};

adminRouter.post("/test-email", testEmail);

export default adminRouter;
