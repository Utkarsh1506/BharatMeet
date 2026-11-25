import { PrismaClient } from "@prisma/client";
import { isDevelopment, isProduction } from "./env";

const getDatabaseUrl = () => {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return "";

  try {
    const url = new URL(connectionString);
    const serverless = process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
    url.searchParams.set("connection_limit", serverless ? "1" : isProduction ? "10" : "5");
    url.searchParams.set("pool_timeout", "10");
    url.searchParams.set("connect_timeout", "10");
    return url.toString();
  } catch {
    // Leave malformed connection strings intact so Prisma reports the original
    // configuration error instead of obscuring it during module initialization.
    return connectionString;
  }
};

declare global {
  var prisma: PrismaClient | undefined;
}

/**
 * Prisma Client with optimized connection pooling
 *
 * Connection pool configuration:
 * - Vercel/serverless: one connection per function instance
 * - Long-running production server: 10 connections
 * - Development: 5 connections (lower to avoid exhausting local DB)
 *
 * Connection and pool timeouts: 10 seconds
 */
export const db = globalThis.prisma || new PrismaClient({
  log: isDevelopment ? ["query", "error", "warn"] : ["error"],
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

if (isDevelopment) {
  globalThis.prisma = db;
}

/**
 * Graceful shutdown handler for Prisma
 * Call this when the application is shutting down
 */
export async function disconnectDb() {
  await db.$disconnect();
}
