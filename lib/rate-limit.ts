import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, hasRateLimiting } from "./env";

// Create a Redis client - falls back to in-memory for development
const redis = hasRateLimiting
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : undefined;

// Rate limiter for general API requests - 20 requests per 10 seconds
export const apiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "10 s"),
      analytics: true,
      prefix: "@bharatmeet/api",
    })
  : null;

// Rate limiter for message sending - 10 messages per 10 seconds
export const messageLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "10 s"),
      analytics: true,
      prefix: "@bharatmeet/message",
    })
  : null;

// Rate limiter for server creation - 3 servers per hour
export const serverCreationLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      analytics: true,
      prefix: "@bharatmeet/server",
    })
  : null;

// Rate limiter for Socket.IO events - 30 events per 10 seconds
export const socketEventLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "10 s"),
      analytics: true,
      prefix: "@bharatmeet/socket",
    })
  : null;

// Rate limiter for authentication - 5 attempts per minute
export const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      analytics: true,
      prefix: "@bharatmeet/auth",
    })
  : null;

/**
 * Helper function to apply rate limiting
 * @param limiter - The rate limiter instance to use
 * @param identifier - Unique identifier (userId, IP, etc.)
 * @returns Object with success status and remaining requests
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{
  success: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
}> {
  // If no Redis configured (development), allow all requests
  if (!limiter) {
    return { success: true };
  }

  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Get rate limit headers for API responses
 */
export function getRateLimitHeaders(result: {
  limit?: number;
  remaining?: number;
  reset?: number;
}): Record<string, string> {
  if (!result.limit) return {};

  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining?.toString() || "0",
    "X-RateLimit-Reset": result.reset?.toString() || "0",
  };
}
