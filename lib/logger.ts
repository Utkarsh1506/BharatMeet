import pino from "pino";
import { isDevelopment, isProduction } from "./env";

/**
 * Structured logging with Pino
 * Replaces console.log with proper production-ready logging
 */

// Configure Pino logger
export const logger = pino({
  level: isDevelopment ? "debug" : "info",

  // Pretty print in development
  ...(isDevelopment && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  }),

  // Structured JSON in production
  ...(isProduction && {
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  }),

  // Base fields included in every log
  base: {
    env: process.env.NODE_ENV,
    revision: process.env.VERCEL_GIT_COMMIT_SHA,
  },
});

/**
 * Create a child logger with context
 * Useful for tagging logs by module/feature
 */
export function createLogger(context: string) {
  return logger.child({ context });
}

/**
 * Log API request/response
 */
export function logApiRequest(
  method: string,
  path: string,
  statusCode: number,
  duration?: number,
  userId?: string
) {
  const logData = {
    method,
    path,
    statusCode,
    ...(duration && { duration: `${duration}ms` }),
    ...(userId && { userId }),
  };

  if (statusCode >= 500) {
    logger.error(logData, "API request failed");
  } else if (statusCode >= 400) {
    logger.warn(logData, "API request error");
  } else {
    logger.info(logData, "API request");
  }
}

/**
 * Log database operations
 */
export function logDatabaseOperation(
  operation: string,
  model: string,
  duration?: number,
  error?: Error
) {
  const logData = {
    operation,
    model,
    ...(duration && { duration: `${duration}ms` }),
  };

  if (error) {
    logger.error({ ...logData, error: error.message }, "Database operation failed");
  } else {
    logger.debug(logData, "Database operation");
  }
}

/**
 * Log Socket.IO events
 */
export function logSocketEvent(
  event: string,
  socketId: string,
  userId?: string,
  error?: Error
) {
  const logData = {
    event,
    socketId,
    ...(userId && { userId }),
  };

  if (error) {
    logger.error({ ...logData, error: error.message }, "Socket event error");
  } else {
    logger.debug(logData, "Socket event");
  }
}

/**
 * Log authentication events
 */
export function logAuthEvent(
  event: "login" | "logout" | "signup" | "token_refresh" | "auth_failed",
  userId?: string,
  metadata?: Record<string, unknown>
) {
  logger.info(
    {
      event,
      ...(userId && { userId }),
      ...metadata,
    },
    `Auth: ${event}`
  );
}

/**
 * Log security events
 */
export function logSecurityEvent(
  event: string,
  severity: "low" | "medium" | "high" | "critical",
  metadata?: Record<string, unknown>
) {
  const logData = {
    event,
    severity,
    ...metadata,
  };

  if (severity === "critical" || severity === "high") {
    logger.error(logData, `Security event: ${event}`);
  } else {
    logger.warn(logData, `Security event: ${event}`);
  }
}

/**
 * Log rate limit events
 */
export function logRateLimit(
  identifier: string,
  endpoint: string,
  remainingRequests: number
) {
  if (remainingRequests === 0) {
    logger.warn(
      {
        identifier,
        endpoint,
        remainingRequests,
      },
      "Rate limit exceeded"
    );
  } else if (remainingRequests < 5) {
    logger.debug(
      {
        identifier,
        endpoint,
        remainingRequests,
      },
      "Rate limit warning"
    );
  }
}

/**
 * Module-specific loggers
 */
export const apiLogger = createLogger("api");
export const socketLogger = createLogger("socket");
export const dbLogger = createLogger("database");
export const authLogger = createLogger("auth");
export const securityLogger = createLogger("security");

// Export default logger
export default logger;
