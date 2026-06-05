import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import env from "../config/env";
import logger from "../config/logger";

const isProduction = env.NODE_ENV === "production";
const isLocalDb =
  env.DATABASE_URL.includes("localhost") ||
  env.DATABASE_URL.includes("127.0.0.1");

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: isProduction ? 5 : 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 60_000,
  ssl: isProduction && !isLocalDb ? { rejectUnauthorized: false } : undefined,
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
