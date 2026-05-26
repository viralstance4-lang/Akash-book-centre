import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import env from "../config/env";
import logger from "../config/logger";

const isProduction = env.NODE_ENV === "production";

// ── PostgreSQL connection pool ─────────────────────────────────────────────────
// Neon's free tier has a limited max_connections.
// Keep the pool small so a cold-started Render dyno doesn't exhaust them.
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: isProduction ? 5 : 3,       // max simultaneous PG connections
  idleTimeoutMillis: 30_000,       // release idle connections after 30 s
  connectionTimeoutMillis: 10_000, // fail fast if Neon is unreachable on startup
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  logger.error({ err }, "[DB] Unexpected pool client error");
});

const adapter = new PrismaPg(pool);

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma =
  globalThis.prisma ??
  new PrismaClient({
    adapter,
    // Emit errors and warnings to stdout so Render captures them in logs.
    // In development, also emit slow queries.
    log: isProduction
      ? [
          { emit: "stdout", level: "error" },
          { emit: "stdout", level: "warn" },
        ]
      : [
          { emit: "stdout", level: "error" },
          { emit: "stdout", level: "warn" },
          { emit: "stdout", level: "info" },
        ],
  });

if (!isProduction) {
  globalThis.prisma = prisma;
}

export default prisma;
