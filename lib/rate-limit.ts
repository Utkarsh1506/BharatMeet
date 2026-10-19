import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, hasRateLimiting } from "./env";

export interface RateLimitResult {
  success: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
}

export interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>;
}

const memoryBuckets = new Map<string, number[]>();
const memoryBucketExpiry = new Map<string, number>();

export const createInMemoryRateLimiter = (prefix: string, maxRequests: number, windowMs: number): RateLimiter => ({
  async limit(identifier) {
    const now = Date.now();
    const key = `${prefix}:${identifier}`;
    const active = (memoryBuckets.get(key) ?? []).filter((timestamp) => timestamp > now - windowMs);
    const success = active.length < maxRequests;

    if (success) active.push(now);
    memoryBuckets.set(key, active);
    memoryBucketExpiry.set(key, active.length ? active[0] + windowMs : now + windowMs);

    if (memoryBuckets.size > 10_000) {
      memoryBucketExpiry.forEach((expiresAt, bucketKey) => {
        if (expiresAt <= now) {
          memoryBuckets.delete(bucketKey);
          memoryBucketExpiry.delete(bucketKey);
        }
      });
    }

    return {
      success,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - active.length),
      reset: active.length ? active[0] + windowMs : now + windowMs,
    };
  },
});

const createLimiter = (prefix: string, maxRequests: number, window: Duration, windowMs: number): RateLimiter => {
  if (!redis) return createInMemoryRateLimiter(prefix, maxRequests, windowMs);

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    analytics: true,
    prefix,
  });
};

// Use Redis when configured and a per-process sliding window otherwise.
const redis = hasRateLimiting
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : undefined;

// Rate limiter for general API requests - 20 requests per 10 seconds
export const apiLimiter = createLimiter("@bharatmeet/api", 20, "10 s", 10_000);

// Rate limiter for message sending - 10 messages per 10 seconds
export const messageLimiter = createLimiter("@bharatmeet/message", 10, "10 s", 10_000);

// Rate limiter for server creation - 3 servers per hour
export const serverCreationLimiter = createLimiter("@bharatmeet/server", 3, "1 h", 3_600_000);

// Rate limiter for Socket.IO events - 30 events per 10 seconds
export const socketEventLimiter = createLimiter("@bharatmeet/socket", 30, "10 s", 10_000);

// Rate limiter for authentication - 5 attempts per minute
export const authLimiter = createLimiter("@bharatmeet/auth", 5, "1 m", 60_000);

/**
 * Helper function to apply rate limiting
 * @param limiter - The rate limiter instance to use
 * @param identifier - Unique identifier (userId, IP, etc.)
 * @returns Object with success status and remaining requests
 */
export async function checkRateLimit(
  limiter: RateLimiter | null,
  identifier: string
): Promise<RateLimitResult> {
  // A null limiter is reserved for explicitly unmetered operations.
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
