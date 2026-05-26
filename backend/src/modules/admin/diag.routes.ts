import { Router, type RequestHandler } from "express";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import env from "../../config/env";
import logger from "../../config/logger";

const diagRouter = Router();

// GET /api/v1/diag/email?secret=YOUR_SECRET
const emailDiag: RequestHandler = async (req, res) => {
  const secret = env.DIAGNOSTIC_SECRET;
  if (!secret) { res.status(404).json({ message: "Not found" }); return; }
  if (req.query.secret !== secret) { res.status(403).json({ message: "Forbidden" }); return; }

  const useResend  = Boolean(env.RESEND_API_KEY);
  const useGmail   = Boolean(env.GMAIL_USER && env.GMAIL_PASS);
  const to         = env.ADMIN_OTP_EMAIL ?? env.ADMIN_EMAIL ?? env.GMAIL_USER ?? "";

  const config = {
    provider:        useResend ? "RESEND" : useGmail ? "GMAIL" : "NONE",
    RESEND_API_KEY:  env.RESEND_API_KEY ? `${env.RESEND_API_KEY.slice(0, 8)}****` : "NOT SET",
    RESEND_FROM:     env.RESEND_FROM    ?? "NOT SET",
    GMAIL_USER:      env.GMAIL_USER     ?? "NOT SET",
    ADMIN_OTP_EMAIL: env.ADMIN_OTP_EMAIL ?? "NOT SET",
    NODE_ENV:        env.NODE_ENV,
    sendingTo:       to,
  };

  if (!useResend && !useGmail) {
    res.status(200).json({ passed: false, message: "No email provider configured", config });
    return;
  }

  try {
    if (useResend) {
      // ── Resend ────────────────────────────────────────────────────────────────
      const resend   = new Resend(env.RESEND_API_KEY);
      const fromAddr = env.RESEND_FROM ?? "Akash Book Centre <onboarding@resend.dev>";
      const { error } = await resend.emails.send({
        from:    fromAddr,
        to:      [to],
        subject: "✅ Resend SMTP Test — Akash Book Centre",
        html:    `<p>Resend is working on Render.<br>From: ${fromAddr}<br>Sent: ${new Date().toISOString()}</p>`,
      });
      if (error) throw new Error(error.message);

      logger.info({ to }, "[DIAG] Resend test email sent");
      res.status(200).json({
        passed: true,
        message: `✅ Resend OK — email sent to ${to}. Check inbox (and spam).`,
        config,
      });

    } else {
      // ── Gmail fallback ────────────────────────────────────────────────────────
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com", port: 587, secure: false,
        auth: { user: env.GMAIL_USER, pass: env.GMAIL_PASS },
        connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
      });
      await transporter.verify();
      await transporter.sendMail({
        from: `"Akash Book Centre" <${env.GMAIL_USER}>`, to,
        subject: "✅ Gmail SMTP Test — Akash Book Centre",
        html: `<p>Gmail SMTP is working.<br>Sent: ${new Date().toISOString()}</p>`,
      });

      logger.info({ to }, "[DIAG] Gmail test email sent");
      res.status(200).json({
        passed: true,
        message: `✅ Gmail OK — email sent to ${to}. Check inbox.`,
        config,
      });
    }
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ err, to }, "[DIAG] Test email failed");
    res.status(200).json({
      passed: false,
      message: "Email send failed — see error",
      error:   msg,
      config,
    });
  }
};

diagRouter.get("/email", emailDiag);

export default diagRouter;
