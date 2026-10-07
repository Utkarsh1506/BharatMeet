import { PrismaClient } from "@prisma/client";
import { isDevelopment, isProduction } from "./env";

declare global {
  var prisma: PrismaClient | undefined;
}

/**
 * Prisma Client with optimized connection pooling
 *
 * Connection pool configuration:
 * - Production: 10 connections (adjust based on your database limits)
 * - Development: 5 connections (lower to avoid exhausting local DB)
 *
 * Connection timeout: 20 seconds
 * Pool timeout: 20 seconds
 */
export const db = globalThis.prisma || new PrismaClient({
  log: isDevelopment ? ["query", "error", "warn"] : ["error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL + (isProduction
        ? "?connection_limit=10&pool_timeout=20&connect_timeout=20"
        : "?connection_limit=5&pool_timeout=20&connect_timeout=20"
      ),
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