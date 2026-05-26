import { Router, type RequestHandler } from "express";
import { Resend } from "resend";
import env from "../../config/env";
import logger from "../../config/logger";

const diagRouter = Router();

// GET /api/v1/diag/email?secret=YOUR_SECRET
const emailDiag: RequestHandler = async (req, res) => {
  const secret = env.DIAGNOSTIC_SECRET;
  if (!secret) { res.status(404).json({ message: "Not found" }); return; }
  if (req.query.secret !== secret) { res.status(403).json({ message: "Forbidden" }); return; }

  const to = env.ADMIN_OTP_EMAIL ?? env.ADMIN_EMAIL ?? "";

  const config = {
    provider:        env.RESEND_API_KEY ? "RESEND" : "NONE",
    RESEND_API_KEY:  env.RESEND_API_KEY ? `${env.RESEND_API_KEY.slice(0, 8)}****` : "NOT SET",
    RESEND_FROM:     env.RESEND_FROM    ?? "NOT SET",
    ADMIN_OTP_EMAIL: env.ADMIN_OTP_EMAIL ?? "NOT SET",
    NODE_ENV:        env.NODE_ENV,
    sendingTo:       to,
  };

  if (!env.RESEND_API_KEY) {
    res.status(200).json({ passed: false, message: "RESEND_API_KEY not configured", config });
    return;
  }

  if (!to) {
    res.status(200).json({ passed: false, message: "No recipient — set ADMIN_OTP_EMAIL", config });
    return;
  }

  try {
    const resend   = new Resend(env.RESEND_API_KEY);
    const fromAddr = env.RESEND_FROM ?? "Akash Book Centre <onboarding@resend.dev>";
    const { error } = await resend.emails.send({
      from:    fromAddr,
      to:      [to],
      subject: "✅ Resend Test — Akash Book Centre",
      html:    `<p>Resend is working on Render.<br>From: ${fromAddr}<br>Sent: ${new Date().toISOString()}</p>`,
    });
    if (error) throw new Error(error.message);

    logger.info({ to }, "[DIAG] Resend test email sent");
    res.status(200).json({
      passed: true,
      message: `✅ Resend OK — email sent to ${to}. Check inbox (and spam).`,
      config,
    });
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
