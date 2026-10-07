import { z } from "zod";

/**
 * Query parameter validation schemas
 */

// UUID validation
export const uuidSchema = z.string().uuid("Invalid ID format");

// Cursor-based pagination
export const cursorSchema = z.string().uuid("Invalid cursor format").optional();

// Limit validation
export const limitSchema = z
  .string()
  .transform((val) => parseInt(val, 10))
  .pipe(z.number().int().min(1).max(100))
  .optional()
  .default("10");

// Messages query parameters
export const messagesQuerySchema = z.object({
  channelId: uuidSchema,
  cursor: cursorSchema,
});

// Direct messages query parameters
export const directMessagesQuerySchema = z.object({
  conversationId: uuidSchema,
  cursor: cursorSchema,
});

// Server ID query parameter
export const serverIdQuerySchema = z.object({
  serverId: uuidSchema,
});

// Channel ID query parameter
export const channelIdQuerySchema = z.object({
  channelId: uuidSchema,
});

// Member ID query parameter
export const memberIdQuerySchema = z.object({
  memberId: uuidSchema,
});

// Search query parameters
export const searchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required").max(100),
  serverId: uuidSchema.optional(),
  channelId: uuidSchema.optional(),
  limit: limitSchema,
});

/**
 * Helper to validate query parameters from URL
 */
export function validateQueryParams<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): { success: true; data: T } | { success: false; error: z.ZodError } {
  // Convert URLSearchParams to plain object
  const params: Record<string, string> = {};

  if (searchParams instanceof URLSearchParams) {
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  } else {
    // Handle Record type (NextJS params)
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined) {
        params[key] = Array.isArray(value) ? value[0] : value;
      }
    });
  }

  const result = schema.safeParse(params);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, error: result.error };
}
