import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  error: {
    message: string;
    code: string;
    details?: unknown;
    timestamp: string;
  };
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server Errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",

  // Request Errors
  BAD_REQUEST: "BAD_REQUEST",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
  headers?: Record<string, string>
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    error: {
      message,
      code,
      timestamp: new Date().toISOString(),
    },
  };
  
  if (details !== undefined) {
    response.error.details = details;
  }

  return NextResponse.json(response, { status: statusCode, headers });
}

/**
 * Handle Zod validation errors
 */
export function handleZodError(error: ZodError): NextResponse<ApiErrorResponse> {
  const firstError = error.errors[0];
  const message = firstError?.message || "Validation failed";

  return createErrorResponse(
    400,
    ErrorCodes.VALIDATION_ERROR,
    message,
    {
      fields: error.errors.map((err) => ({
        path: err.path.join("."),
        message: err.message,
      })),
    }
  );
}

/**
 * Handle Prisma errors
 */
export function handlePrismaError(error: any): NextResponse<ApiErrorResponse> {
  // Prisma unique constraint violation
  if (error.code === "P2002") {
    return createErrorResponse(
      409,
      ErrorCodes.ALREADY_EXISTS,
      "A record with this value already exists",
      { fields: error.meta?.target }
    );
  }

  // Prisma record not found
  if (error.code === "P2025") {
    return createErrorResponse(
      404,
      ErrorCodes.NOT_FOUND,
      "Record not found"
    );
  }

  // Foreign key constraint violation
  if (error.code === "P2003") {
    return createErrorResponse(
      400,
      ErrorCodes.BAD_REQUEST,
      "Invalid reference to related record"
    );
  }

  // Generic database error
  return createErrorResponse(
    500,
    ErrorCodes.DATABASE_ERROR,
    "Database operation failed"
  );
}

/**
 * Central error handler for API routes
 * Use this in try-catch blocks for consistent error handling
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  // Handle ApiError
  if (error instanceof ApiError) {
    return createErrorResponse(
      error.statusCode,
      error.code,
      error.message,
      error.details
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return handleZodError(error);
  }

  // Handle Prisma errors
  if (error && typeof error === "object" && "code" in error) {
    return handlePrismaError(error);
  }

  // Handle generic errors
  if (error instanceof Error) {
    // Don't expose internal error messages in production
    const message = process.env.NODE_ENV === "production"
      ? "An internal error occurred"
      : error.message;

    return createErrorResponse(
      500,
      ErrorCodes.INTERNAL_ERROR,
      message
    );
  }

  // Unknown error type
  return createErrorResponse(
    500,
    ErrorCodes.INTERNAL_ERROR,
    "An unexpected error occurred"
  );
}

/**
 * Common error response factories
 */
export const ApiErrors = {
  unauthorized: (message = "Authentication required") =>
    createErrorResponse(401, ErrorCodes.UNAUTHORIZED, message),

  forbidden: (message = "You don't have permission to access this resource") =>
    createErrorResponse(403, ErrorCodes.FORBIDDEN, message),

  notFound: (message = "Resource not found") =>
    createErrorResponse(404, ErrorCodes.NOT_FOUND, message),

  badRequest: (message = "Invalid request") =>
    createErrorResponse(400, ErrorCodes.BAD_REQUEST, message),

  methodNotAllowed: (message = "Method not allowed") =>
    createErrorResponse(405, ErrorCodes.METHOD_NOT_ALLOWED, message),

  rateLimitExceeded: (message = "Too many requests. Please try again later.", headers?: Record<string, string>) =>
    createErrorResponse(429, ErrorCodes.RATE_LIMIT_EXCEEDED, message, undefined, headers),

  internalError: (message = "Internal server error") =>
    createErrorResponse(500, ErrorCodes.INTERNAL_ERROR, message),
};
