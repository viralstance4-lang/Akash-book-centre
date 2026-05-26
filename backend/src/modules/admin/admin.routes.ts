import { Router, type RequestHandler } from "express";
import authMiddleware, { requireAdmin } from "../../middleware/auth.middleware";
import { verifyTransporter } from "../../lib/email";
import nodemailer from "nodemailer";
import env from "../../config/env";
import logger from "../../config/logger";

const adminRouter = Router();
adminRouter.use(authMiddleware, requireAdmin);

// POST /api/v1/admin/test-email
// Sends a test email to ADMIN_OTP_EMAIL so you can confirm SMTP is working on Render.
const testEmail: RequestHandler = async (_req, res) => {
  const result: Record<string, unknown> = {
    GMAIL_USER:      env.GMAIL_USER     ? `${env.GMAIL_USER.slice(0, 4)}***` : "NOT SET",
    GMAIL_PASS:      env.GMAIL_PASS     ? "SET (hidden)"                      : "NOT SET",
    ADMIN_OTP_EMAIL: env.ADMIN_OTP_EMAIL ?? "NOT SET",
    NODE_ENV:        env.NODE_ENV,
  };

  if (!env.GMAIL_USER || !env.GMAIL_PASS) {
    res.status(400).json({
      success: false,
      message: "GMAIL_USER or GMAIL_PASS not set in Render environment variables",
      config: result,
    });
    return;
  }

  // Step 1 — verify transporter can connect to Gmail
  try {
    await verifyTransporter();
    result.smtpVerify = "PASSED";
  } catch (err) {
    result.smtpVerify = "FAILED";
    result.smtpError  = (err as Error).message;
    logger.error({ err }, "[SMTP TEST] Transporter verify failed");
    res.status(502).json({
      success: false,
      message: "SMTP connection failed — check GMAIL credentials in Render environment",
      config: result,
    });
    return;
  }

  // Step 2 — send actual test email to ADMIN_OTP_EMAIL
  const to = env.ADMIN_OTP_EMAIL ?? env.ADMIN_EMAIL ?? env.GMAIL_USER;
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_PASS },
      connectionTimeout: 10_000,
      greetingTimeout:   10_000,
      socketTimeout:     30_000,
    });
    await transporter.sendMail({
      from:    `"Akash Book Centre" <${env.GMAIL_USER}>`,
      to,
      subject: "✅ SMTP Test — Akash Book Centre Backend",
      html:    `<p>SMTP is working correctly on Render (${env.NODE_ENV}).<br/>Sent at: ${new Date().toISOString()}</p>`,
    });
    result.emailSent = true;
    result.emailTo   = to;
    logger.info({ to }, "[SMTP TEST] Test email sent successfully");
    res.status(200).json({
      success: true,
      message: `Test email sent to ${to} — check inbox (and spam folder)`,
      config: result,
    });
  } catch (err) {
    result.emailSent  = false;
    result.emailError = (err as Error).message;
    logger.error({ err, to }, "[SMTP TEST] Test email send failed");
    res.status(502).json({
      success: false,
      message: "SMTP connected but email send failed",
      config: result,
    });
  }
};

adminRouter.post("/test-email", testEmail);

export default adminRouter;
