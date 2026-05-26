import http from "http";
import https from "https";
import env from "../config/env";
import logger from "../config/logger";

const PING_INTERVAL_MS = 10 * 60 * 1_000; // 10 min — Render sleeps after 15 min idle

export function startKeepAlive(): void {
  const backendUrl = env.BACKEND_URL;

  if (!backendUrl) {
    logger.warn(
      "[KEEP-ALIVE] BACKEND_URL not set — self-ping disabled. " +
        "Set BACKEND_URL=https://your-app.onrender.com in Render environment variables " +
        "to prevent cold starts. Alternatively, use UptimeRobot (free) to ping /health every 10 min.",
    );
    return;
  }

  const pingUrl = `${backendUrl.replace(/\/$/, "")}/health`;
  const mod = pingUrl.startsWith("https") ? https : http;

  const ping = () => {
    const req = mod.get(pingUrl, (res) => {
      logger.info(`[KEEP-ALIVE] Self-ping ${pingUrl} → HTTP ${res.statusCode}`);
      // Drain response body so socket is released
      res.resume();
    });

    req.setTimeout(10_000, () => {
      req.destroy();
      logger.warn("[KEEP-ALIVE] Self-ping timed out after 10s");
    });

    req.on("error", (err) => {
      logger.warn(`[KEEP-ALIVE] Self-ping failed: ${err.message}`);
    });
  };

  // Ping immediately on startup, then on interval
  ping();
  setInterval(ping, PING_INTERVAL_MS).unref();

  logger.info(
    `[KEEP-ALIVE] Self-ping active — pinging ${pingUrl} every ${PING_INTERVAL_MS / 60_000} min`,
  );
}
