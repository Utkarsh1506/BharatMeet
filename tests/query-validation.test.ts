import { describe, expect, it } from "vitest";
import { validateQueryParams, messagesQuerySchema, directMessagesQuerySchema, uuidSchema } from "../lib/query-validation";

describe("Query Parameter Validation", () => {
  describe("uuidSchema", () => {
    it("should accept valid UUIDs", () => {
      const validUUID = "123e4567-e89b-12d3-a456-426614174000";
      const result = uuidSchema.safeParse(validUUID);
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUIDs", () => {
      const invalidUUID = "not-a-uuid";
      const result = uuidSchema.safeParse(invalidUUID);
      expect(result.success).toBe(false);
    });
  });

  describe("messagesQuerySchema", () => {
    it("should accept valid channelId and cursor", () => {
      const params = {
        channelId: "123e4567-e89b-12d3-a456-426614174000",
        cursor: "123e4567-e89b-12d3-a456-426614174001",
      };
      const result = messagesQuerySchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it("should accept channelId without cursor", () => {
      const params = {
        channelId: "123e4567-e89b-12d3-a456-426614174000",
      };
      const result = messagesQuerySchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it("should reject invalid channelId", () => {
      const params = {
        channelId: "invalid-id",
      };
      const result = messagesQuerySchema.safeParse(params);
      expect(result.success).toBe(false);
    });
  });

  describe("directMessagesQuerySchema", () => {
    it("should accept valid conversationId", () => {
      const params = {
        conversationId: "123e4567-e89b-12d3-a456-426614174000",
      };
      const result = directMessagesQuerySchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it("should reject invalid conversationId", () => {
      const params = {
        conversationId: "not-a-uuid",
      };
      const result = directMessagesQuerySchema.safeParse(params);
      expect(result.success).toBe(false);
    });
  });

  describe("validateQueryParams", () => {
    it("should validate URLSearchParams", () => {
      const searchParams = new URLSearchParams();
      searchParams.set("channelId", "123e4567-e89b-12d3-a456-426614174000");

      const result = validateQueryParams(messagesQuerySchema, searchParams);
      expect(result.success).toBe(true);
    });

    it("should validate plain object", () => {
      const params = {
        channelId: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = validateQueryParams(messagesQuerySchema, params);
      expect(result.success).toBe(true);
    });

    it("should return error for invalid params", () => {
      const params = {
        channelId: "invalid",
      };

      const result = validateQueryParams(messagesQuerySchema, params);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });
});
