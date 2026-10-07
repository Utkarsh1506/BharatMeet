import { z } from "zod";

/**
 * Environment variable validation schema
 * Ensures all required configuration is present at startup
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Clerk Authentication
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
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
});

/**
 * Validated and typed environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup
 * Throws an error if validation fails with detailed messages
 */
function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => {
        return `  ❌ ${err.path.join(".")}: ${err.message}`;
      });

      console.error("\n🚨 Environment validation failed!\n");
      console.error("Missing or invalid environment variables:\n");
      console.error(missingVars.join("\n"));
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      console.error("See .env.example for reference.\n");

      process.exit(1);
    }

    throw error;
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
  console.log(`🔒 Rate Limiting: ${hasRateLimiting ? "Enabled (Redis)" : "Disabled (in-memory fallback)"}`);
}
