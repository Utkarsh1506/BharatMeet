import { describe, expect, it, beforeEach } from "vitest";
import { env, envSchema, isProduction, isDevelopment } from "../lib/env";

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

  it("requires production Clerk, realtime, and distributed rate-limit configuration", () => {
    const result = envSchema.safeParse({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://db.example/app",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_example",
      CLERK_SECRET_KEY: "sk_live_example",
      UPLOADTHING_SECRET: "upload_secret",
      UPLOADTHING_APP_ID: "upload_app",
      LIVEKIT_API_KEY: "livekit_key",
      LIVEKIT_API_SECRET: "livekit_secret",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://meet.example",
      NEXT_PUBLIC_SITE_URL: "https://meet.example",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "UPSTASH_REDIS_REST_URL")).toBe(true);
    }
  });

  it("trims surrounding whitespace from production Clerk keys", () => {
    const result = envSchema.safeParse({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://db.example/app",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "  pk_live_example  \n",
      CLERK_SECRET_KEY: "\tsk_live_example  ",
      UPLOADTHING_SECRET: "upload_secret",
      UPLOADTHING_APP_ID: "upload_app",
      LIVEKIT_API_KEY: "livekit_key",
      LIVEKIT_API_SECRET: "livekit_secret",
      NEXT_PUBLIC_LIVEKIT_URL: "wss://meet.example",
      NEXT_PUBLIC_SITE_URL: "https://meet.example",
      UPSTASH_REDIS_REST_URL: "https://redis.example",
      UPSTASH_REDIS_REST_TOKEN: "redis_token",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBe("pk_live_example");
      expect(result.data.CLERK_SECRET_KEY).toBe("sk_live_example");
    }
  });
});
