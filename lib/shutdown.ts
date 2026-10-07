/**
 * Graceful shutdown handler for Node.js process
 * Ensures proper cleanup of resources when the application is terminated
 */

import { disconnectDb } from "./db";
import { logger } from "./logger";

let isShuttingDown = false;

/**
 * Perform graceful shutdown
 */
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress");
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, "Received shutdown signal, starting graceful shutdown");

  try {
    // Give active requests time to complete
    logger.info("Waiting for active requests to complete...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Close database connections
    logger.info("Closing database connections...");
    await disconnectDb();

    logger.info("Graceful shutdown completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error({ error }, "Error during graceful shutdown");
    process.exit(1);
  }
}

/**
 * Register shutdown handlers
 * Call this once at application startup
 */
export function registerShutdownHandlers() {
  // Handle SIGTERM (Docker, Kubernetes, systemd)
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // Handle SIGINT (Ctrl+C)
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    logger.error({ error }, "Uncaught exception");
    gracefulShutdown("uncaughtException");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    logger.error({ reason, promise }, "Unhandled promise rejection");
    gracefulShutdown("unhandledRejection");
  });

  logger.info("Shutdown handlers registered");
}
