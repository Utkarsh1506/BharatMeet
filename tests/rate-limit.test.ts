import { describe, expect, it } from "vitest";
import { checkRateLimit, createInMemoryRateLimiter } from "../lib/rate-limit";

describe("Rate Limiting", () => {
  describe("checkRateLimit", () => {
    it("allows requests when no limiter is explicitly provided", async () => {
      const result = await checkRateLimit(null, "test-user-id");

      expect(result.success).toBe(true);
    });

    it("should return correct structure", async () => {
      const result = await checkRateLimit(null, "test-user-id");

      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
    });

    it("should handle different identifiers", async () => {
      const result1 = await checkRateLimit(null, "user-123");
      const result2 = await checkRateLimit(null, "192.168.1.1");
      const result3 = await checkRateLimit(null, "session-abc");

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
    });
  });

  describe("in-memory fallback", () => {
    it("enforces the configured request limit per identifier", async () => {
      const limiter = createInMemoryRateLimiter(`test-${Date.now()}`, 2, 60_000);

      expect((await limiter.limit("user-a")).success).toBe(true);
      expect((await limiter.limit("user-a")).success).toBe(true);
      expect((await limiter.limit("user-a")).success).toBe(false);
      expect((await limiter.limit("user-b")).success).toBe(true);
    });
  });

  describe("Rate limit response structure", () => {
    it("should include limit information when available", async () => {
      const result = await checkRateLimit(null, "test-user");

      // Explicitly unmetered calls do not include rate limit metadata.
      if (result.limit) {
        expect(typeof result.limit).toBe("number");
      }

      if (result.remaining !== undefined) {
        expect(typeof result.remaining).toBe("number");
      }

      if (result.reset !== undefined) {
        expect(typeof result.reset).toBe("number");
      }
    });
  });
});
