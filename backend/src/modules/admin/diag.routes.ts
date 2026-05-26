import { Router, type RequestHandler } from "express";
import nodemailer from "nodemailer";
import env from "../../config/env";
import logger from "../../config/logger";

const diagRouter = Router();

// GET /api/v1/diag/email?secret=YOUR_SECRET
// Public endpoint — protected only by DIAGNOSTIC_SECRET query param.
// Use this when you cannot log in yet (SMTP chicken-and-egg problem).
// Remove DIAGNOSTIC_SECRET from Render env vars after setup is confirmed.
const emailDiag: RequestHandler = async (req, res) => {
  // Guard: secret must be set in env AND must match query param
  const secret = env.DIAGNOSTIC_SECRET;
  if (!secret) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  if (req.query.secret !== secret) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const config = {
    GMAIL_USER:      env.GMAIL_USER      ? env.GMAIL_USER      : "NOT SET",
    GMAIL_PASS:      env.GMAIL_PASS      ? `${env.GMAIL_PASS.slice(0, 4)}****` : "NOT SET",
    ADMIN_OTP_EMAIL: env.ADMIN_OTP_EMAIL ?? "NOT SET",
    ADMIN_EMAIL:     env.ADMIN_EMAIL     ?? "NOT SET",
    NODE_ENV:        env.NODE_ENV,
  };

  if (!env.GMAIL_USER || !env.GMAIL_PASS) {
    res.status(200).json({
      step: "CONFIG_CHECK",
      passed: false,
      message: "GMAIL_USER or GMAIL_PASS missing in Render environment",
      config,
    });
    return;
  }

  // Step 1 — verify SMTP connection
  const transporter = nodemailer.createTransport({
    host:   "smtp.gmail.com",
    port:   587,
    secure: false,
    auth:   { user: env.GMAIL_USER, pass: env.GMAIL_PASS },
    connectionTimeout: 15_000,
    greetingTimeout:   15_000,
    socketTimeout:     30_000,
  });

  try {
    await transporter.verify();
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ err }, "[DIAG] SMTP verify failed");
    res.status(200).json({
      step: "SMTP_VERIFY",
      passed: false,
      message: "SMTP connection failed — see error below",
      error: msg,
      fix: msg.includes("Invalid login") || msg.includes("Username and Password")
        ? "App Password is wrong or GMAIL_USER does not match the account that generated it."
        : msg.includes("535")
        ? "Gmail rejected the credentials. Regenerate the App Password for sanamaryam089@gmail.com."
        : "Check GMAIL_USER and GMAIL_PASS in Render environment variables.",
      config,
    });
    return;
  }

  // Step 2 — send test email
  const to = env.ADMIN_OTP_EMAIL ?? env.ADMIN_EMAIL ?? env.GMAIL_USER;
  try {
    await transporter.sendMail({
      from:    `"Akash Book Centre DIAG" <${env.GMAIL_USER}>`,
      to,
      subject: "✅ SMTP Working — Akash Book Centre",
      html:    `<p>SMTP is working on Render.<br>GMAIL_USER: ${env.GMAIL_USER}<br>Sent: ${new Date().toISOString()}</p>`,
    });
    logger.info({ to }, "[DIAG] Test email sent successfully");
    res.status(200).json({
      step: "EMAIL_SENT",
      passed: true,
      message: `SMTP OK — test email sent to ${to}. Check inbox (and spam).`,
      config,
    });
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ err, to }, "[DIAG] Test email send failed");
    res.status(200).json({
      step: "EMAIL_SEND",
      passed: false,
      message: "SMTP connected but email send failed",
      error: msg,
      config,
    });
  }
};

diagRouter.get("/email", emailDiag);

export default diagRouter;
