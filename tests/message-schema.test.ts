import { describe, expect, it } from "vitest";

import { createMessageSchema, updateMessageSchema } from "../lib/message-schema";

describe("message schemas", () => {
  it("accepts a normal message with an optional attachment", () => {
    expect(
      createMessageSchema.safeParse({
        content: "  Ship the release notes  ",
        fileUrl: null,
      }).success,
    ).toBe(true);
  });

  it("rejects empty or oversized message content", () => {
    expect(createMessageSchema.safeParse({ content: "   " }).success).toBe(false);
    expect(updateMessageSchema.safeParse({ content: "x".repeat(4001) }).success).toBe(false);
  });

  it("rejects invalid attachment URLs", () => {
    expect(
      createMessageSchema.safeParse({
        content: "Attachment",
        fileUrl: "not-a-url",
      }).success,
    ).toBe(false);
  });

  it("rejects trusted-host lookalikes as attachments", () => {
    expect(
      createMessageSchema.safeParse({
        content: "Attachment",
        fileUrl: "https://utfs.io.attacker.example/file.pdf",
      }).success,
    ).toBe(false);
  });
});
