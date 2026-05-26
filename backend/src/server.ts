import app from "./app";
import env from "./config/env";
import logger from "./config/logger";
import { startKeepAlive } from "./lib/keepAlive";
import { verifyTransporter } from "./lib/email";

const port = env.PORT;
const isProduction = env.NODE_ENV === "production";

// ── Global process error handlers ─────────────────────────────────────────────
// These catch anything that escapes route/middleware error handling.
// On Render, an unhandled rejection without this causes a silent zombie process.
process.on("uncaughtException", (err: Error) => {
  logger.error({ err, stack: err.stack }, "[FATAL] Uncaught exception — process will exit");
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  logger.error({ reason }, "[FATAL] Unhandled promise rejection — process will exit");
  process.exit(1);
});

// ── Start server ───────────────────────────────────────────────────────────────
const server = app.listen(port, () => {
  logger.info(
    `[SERVER] Listening on port ${port} | env: ${env.NODE_ENV} | pid: ${process.pid}`,
  );

  if (isProduction) {
    // Verify SMTP connection so email failures are caught at startup not silently later
    verifyTransporter().catch(() => {
      logger.warn("[SERVER] SMTP verification failed — emails may not send in production");
    });
    // Self-ping to prevent Render free-tier cold starts (sleep after 15 min idle)
    startKeepAlive();
  }
});

// ── Server-level timeouts (critical for Render / proxied deployments) ──────────
// Render's load balancer closes idle connections after ~60 s.
// keepAliveTimeout must exceed the proxy timeout so Render can reuse connections.
server.keepAliveTimeout = 65_000;  // 65 s > Render's 60 s proxy idle timeout
server.headersTimeout = 70_000;    // must be > keepAliveTimeout

// ── Graceful shutdown ──────────────────────────────────────────────────────────
const shutdown = (signal: string) => {
  logger.info(`[SERVER] ${signal} received — shutting down gracefully`);

  server.close(() => {
    logger.info("[SERVER] All connections closed — exiting cleanly");
    process.exit(0);
  });

  // Force exit if in-flight requests don't finish within 10 s
  setTimeout(() => {
    logger.warn("[SERVER] Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM")); // Render sends this to stop the instance
process.on("SIGINT",  () => shutdown("SIGINT"));  // Ctrl-C in local dev
