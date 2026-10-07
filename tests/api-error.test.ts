import { describe, expect, it } from "vitest";
import {
  ApiError,
  createErrorResponse,
  handleApiError,
  ApiErrors,
  ErrorCodes
} from "../lib/api-error";
import { ZodError, z } from "zod";

describe("API Error Handling", () => {
  describe("ApiError class", () => {
    it("should create an API error with correct properties", () => {
      const error = new ApiError(
        400,
        ErrorCodes.BAD_REQUEST,
        "Invalid request",
        { field: "email" }
      );

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCodes.BAD_REQUEST);
      expect(error.message).toBe("Invalid request");
      expect(error.details).toEqual({ field: "email" });
    });
  });

  describe("createErrorResponse", () => {
    it("should create a standardized error response", () => {
      const response = createErrorResponse(
        404,
        ErrorCodes.NOT_FOUND,
        "Resource not found"
      );

      expect(response.status).toBe(404);
    });

    it("should include timestamp in error response", async () => {
      const response = createErrorResponse(
        500,
        ErrorCodes.INTERNAL_ERROR,
        "Internal error"
      );

      const body = await response.json();
      expect(body.error.timestamp).toBeDefined();
      expect(body.error.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(body.error.message).toBe("Internal error");
    });

    it("should include optional details", async () => {
      const details = { userId: "123", action: "delete" };
      const response = createErrorResponse(
        403,
        ErrorCodes.FORBIDDEN,
        "Forbidden",
        details
      );

      const body = await response.json();
      expect(body.error.details).toEqual(details);
    });
  });

  describe("handleApiError", () => {
    it("should handle ApiError instances", async () => {
      const error = new ApiError(
        401,
        ErrorCodes.UNAUTHORIZED,
        "Unauthorized access"
      );

      const response = handleApiError(error);
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error.code).toBe(ErrorCodes.UNAUTHORIZED);
    });

    it("should handle Zod validation errors", async () => {
      const schema = z.object({
        email: z.string().email(),
      });

      try {
        schema.parse({ email: "invalid-email" });
      } catch (error) {
        const response = handleApiError(error);
        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      }
    });

    it("should handle generic Error instances", async () => {
      const error = new Error("Something went wrong");
      const response = handleApiError(error);

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error.code).toBe(ErrorCodes.INTERNAL_ERROR);
    });

    it("should handle unknown error types", async () => {
      const response = handleApiError("string error");

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error.code).toBe(ErrorCodes.INTERNAL_ERROR);
    });
  });

  describe("ApiErrors factory functions", () => {
    it("should create unauthorized error", async () => {
      const response = ApiErrors.unauthorized();
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error.code).toBe(ErrorCodes.UNAUTHORIZED);
    });

    it("should create forbidden error", async () => {
      const response = ApiErrors.forbidden();
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.error.code).toBe(ErrorCodes.FORBIDDEN);
    });

    it("should create not found error", async () => {
      const response = ApiErrors.notFound();
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error.code).toBe(ErrorCodes.NOT_FOUND);
    });

    it("should create rate limit error with headers", async () => {
      const headers = {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
      };

      const response = ApiErrors.rateLimitExceeded(
        "Too many requests",
        headers
      );

      expect(response.status).toBe(429);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
    });

    it("should allow custom error messages", async () => {
      const customMessage = "Custom error message";
      const response = ApiErrors.badRequest(customMessage);

      const body = await response.json();
      expect(body.error.message).toBe(customMessage);
    });
  });
});
