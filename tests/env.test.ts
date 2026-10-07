import { describe, expect, it, beforeEach } from "vitest";
import { env, isProduction, isDevelopment } from "../lib/env";

describe("Environment Validation", () => {
  describe("env object", () => {
    it("should have required database URL", () => {
      expect(env.DATABASE_URL).toBeDefined();
      expect(typeof env.DATABASE_URL).toBe("string");
    });

    it("should have required Clerk configuration", () => {
      expect(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBeDefined();
      expect(env.CLERK_SECRET_KEY).toBeDefined();
    });

    it("should have required UploadThing configuration", () => {
      expect(env.UPLOADTHING_SECRET).toBeDefined();
      expect(env.UPLOADTHING_APP_ID).toBeDefined();
    });

    it("should have required LiveKit configuration", () => {
      expect(env.LIVEKIT_API_KEY).toBeDefined();
      expect(env.LIVEKIT_API_SECRET).toBeDefined();
      expect(env.NEXT_PUBLIC_LIVEKIT_URL).toBeDefined();
    });

    it("should have NODE_ENV set", () => {
      expect(env.NODE_ENV).toBeDefined();
      expect(["development", "production", "test"]).toContain(env.NODE_ENV);
    });
  });

  describe("environment helpers", () => {
    it("should correctly identify production environment", () => {
      if (env.NODE_ENV === "production") {
        expect(isProduction).toBe(true);
        expect(isDevelopment).toBe(false);
      }
    });

    it("should correctly identify development environment", () => {
      if (env.NODE_ENV === "development") {
        expect(isDevelopment).toBe(true);
        expect(isProduction).toBe(false);
      }
    });
  });

  describe("optional configuration", () => {
    it("should handle optional UPSTASH_REDIS_REST_URL", () => {
      // Should not throw if undefined
      expect(() => env.UPSTASH_REDIS_REST_URL).not.toThrow();
    });

    it("should handle optional NEXT_PUBLIC_SITE_URL", () => {
      // Should not throw if undefined
      expect(() => env.NEXT_PUBLIC_SITE_URL).not.toThrow();
    });
  });
});
