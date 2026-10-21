import { z } from "zod";

const parseUrl = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

/**
 * Environment variable validation schema
 * Ensures all required configuration is present at startup
 */
export const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Clerk Authentication
  // Dashboard copy/paste can include surrounding whitespace; normalize before
  // validating the live-key prefix and before passing the value to Clerk.
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().trim().min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  CLERK_SECRET_KEY: z.string().trim().min(1, "CLERK_SECRET_KEY is required"),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-up"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default("/"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default("/"),

  // UploadThing
  UPLOADTHING_SECRET: z.string().min(1, "UPLOADTHING_SECRET is required"),
  UPLOADTHING_APP_ID: z.string().min(1, "UPLOADTHING_APP_ID is required"),

  // LiveKit
  LIVEKIT_API_KEY: z.string().min(1, "LIVEKIT_API_KEY is required"),
  LIVEKIT_API_SECRET: z.string().min(1, "LIVEKIT_API_SECRET is required"),
  NEXT_PUBLIC_LIVEKIT_URL: z.string().url("NEXT_PUBLIC_LIVEKIT_URL must be a valid URL"),

  // Optional: Site URL for Socket.IO
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  // Optional: Rate Limiting with Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Node Environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
}).superRefine((values, context) => {
  if (Boolean(values.UPSTASH_REDIS_REST_URL) !== Boolean(values.UPSTASH_REDIS_REST_TOKEN)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [values.UPSTASH_REDIS_REST_URL ? "UPSTASH_REDIS_REST_TOKEN" : "UPSTASH_REDIS_REST_URL"],
      message: "Configure both Upstash Redis credentials or neither",
    });
  }

  if (values.NODE_ENV === "production") {
    if (!values.NEXT_PUBLIC_SITE_URL) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["NEXT_PUBLIC_SITE_URL"], message: "Required in production" });
    } else {
      const siteUrl = parseUrl(values.NEXT_PUBLIC_SITE_URL);
      if (siteUrl && (siteUrl.protocol !== "https:" || siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["NEXT_PUBLIC_SITE_URL"], message: "Use the canonical HTTPS site origin without a path or query" });
      }
    }
    if (!values.UPSTASH_REDIS_REST_URL || !values.UPSTASH_REDIS_REST_TOKEN) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["UPSTASH_REDIS_REST_URL"], message: "Distributed rate limiting is required in production" });
    } else if (parseUrl(values.UPSTASH_REDIS_REST_URL)?.protocol !== "https:") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["UPSTASH_REDIS_REST_URL"], message: "Production Redis connections must use HTTPS" });
    }
    if (parseUrl(values.NEXT_PUBLIC_LIVEKIT_URL)?.protocol !== "wss:") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["NEXT_PUBLIC_LIVEKIT_URL"], message: "Production LiveKit connections must use WSS" });
    }
    if (!values.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith("pk_live_")) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"], message: "Use a Clerk production publishable key" });
    }
    if (!values.CLERK_SECRET_KEY.startsWith("sk_live_")) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["CLERK_SECRET_KEY"], message: "Use a Clerk production secret key" });
    }
  }
});

/**
 * Validated and typed environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup
 * Development can boot with warnings so the setup screen remains available.
 * Production fails closed: unsafe or incomplete configuration must not start.
 */
function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);
    console.log("✅ Environment validation passed");
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => {
        return `  ❌ ${err.path.join(".")}: ${err.message}`;
      });

      console.error(`\n⚠️  Environment validation failed${process.env.NODE_ENV === "production" ? " (production startup blocked)" : " (development fallback enabled)"}:`);
      console.error("Missing or invalid environment variables:");
      console.error(missingVars.join("\n"));
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      console.error("See .env.example for reference.\n");
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid production environment configuration. Fix the fields listed above before starting the app.");
    }

    // Return safe defaults instead of crashing
    const defaults: Env = {
      DATABASE_URL: process.env.DATABASE_URL || "",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "",
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
      NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: "/",
      NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: "/",
      UPLOADTHING_SECRET: process.env.UPLOADTHING_SECRET || "",
      UPLOADTHING_APP_ID: process.env.UPLOADTHING_APP_ID || "",
      LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || "",
      LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || "",
      NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL || "",
      NEXT_PUBLIC_SITE_URL: undefined,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
      NODE_ENV: process.env.NODE_ENV || "development",
    };

    console.warn("⚠️  Using environment fallback defaults — some features may not work correctly");
    return defaults;
  }
}

/**
 * Validated environment variables
 * Import this instead of process.env for type safety
 */
export const env = validateEnv();

/**
 * Check if running in production
 */
export const isProduction = env.NODE_ENV === "production";

/**
 * Check if running in development
 */
export const isDevelopment = env.NODE_ENV === "development";

/**
 * Check if rate limiting is configured
 */
export const hasRateLimiting = !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

// Log environment status on startup (only in development)
if (isDevelopment) {
  console.log("✅ Environment validation passed");
  console.log(`📊 Node Environment: ${env.NODE_ENV}`);
  console.log(`🔒 Rate Limiting: ${hasRateLimiting ? "Enabled (Redis)" : "Enabled (in-memory fallback)"}`);
}
