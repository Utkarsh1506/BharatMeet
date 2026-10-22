import { describe, expect, it } from "vitest";
import { sanitizeHtml, sanitizePlainText, sanitizeMessage, sanitizeUrl, sanitizeFileUrl, sanitizeName, sanitizeEmoji } from "../lib/sanitize";

describe("Input Sanitization", () => {
  describe("sanitizeHtml", () => {
    it("should allow safe HTML tags", () => {
      const input = "<p>Hello <strong>world</strong></p>";
      const result = sanitizeHtml(input);
      expect(result).toContain("<p>");
      expect(result).toContain("<strong>");
    });

    it("should remove dangerous script tags", () => {
      const input = '<script>alert("xss")</script><p>Safe content</p>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain("<script>");
      expect(result).toContain("Safe content");
    });

    it("should remove dangerous event handlers", () => {
      const input = '<img src="x" onerror="alert(1)">';
      const result = sanitizeHtml(input);
      expect(result).not.toContain("onerror");
    });

    it("should handle empty or invalid input", () => {
      expect(sanitizeHtml("")).toBe("");
      expect(sanitizeHtml(null as any)).toBe("");
    });
  });

  describe("sanitizePlainText", () => {
    it("should escape HTML entities", () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizePlainText(input);
      expect(result).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;");
    });

    it("should escape all dangerous characters", () => {
      const input = '& < > " \' /';
      const result = sanitizePlainText(input);
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
      expect(result).not.toContain('"');
    });
  });

  describe("sanitizeMessage", () => {
    it("should preserve @mentions while sanitizing", () => {
      const input = "@username <script>alert(1)</script>";
      const result = sanitizeMessage(input);
      expect(result).toContain("@username");
      expect(result).not.toContain("<script>");
    });

    it("should sanitize HTML in message content", () => {
      const input = 'Hello <img src=x onerror="alert(1)"> @user';
      const result = sanitizeMessage(input);
      expect(result).not.toContain("onerror");
    });
  });

  describe("sanitizeUrl", () => {
    it("should allow https URLs", () => {
      const input = "https://example.com/image.png";
      const result = sanitizeUrl(input);
      expect(result).toBe(input);
    });

    it("should block javascript: protocol", () => {
      const input = "javascript:alert(1)";
      const result = sanitizeUrl(input);
      expect(result).toBe("");
    });

    it("should block data: protocol", () => {
      const input = "data:text/html,<script>alert(1)</script>";
      const result = sanitizeUrl(input);
      expect(result).toBe("");
    });
  });

  describe("sanitizeFileUrl", () => {
    it("should allow UploadThing URLs", () => {
      const input = "https://uploadthing.com/f/abc123.png";
      const result = sanitizeFileUrl(input);
      expect(result).toBe(input);
    });

    it("should allow utfs.io URLs", () => {
      const input = "https://utfs.io/f/abc123.png";
      const result = sanitizeFileUrl(input);
      expect(result).toBe(input);
    });

    it("should allow current UploadThing tenant CDN URLs", () => {
      const input = "https://a1b2c3d4e5.ufs.sh/f/abc123.png";
      expect(sanitizeFileUrl(input)).toBe(input);
    });

    it("should reject non-HTTPS URLs", () => {
      const input = "http://uploadthing.com/f/abc123.png";
      const result = sanitizeFileUrl(input);
      expect(result).toBeNull();
    });

    it("should reject URLs from unknown domains", () => {
      const input = "https://evil.com/malware.exe";
      const result = sanitizeFileUrl(input);
      expect(result).toBeNull();
    });

    it("should reject lookalike domains that contain a trusted hostname", () => {
      expect(sanitizeFileUrl("https://uploadthing.com.attacker.example/file.png")).toBeNull();
      expect(sanitizeFileUrl("https://notutfs.io/file.png")).toBeNull();
      expect(sanitizeFileUrl("https://ufs.sh/f/abc123.png")).toBeNull();
      expect(sanitizeFileUrl("https://a1b2c3d4e5.ufs.sh.attacker.example/f/abc123.png")).toBeNull();
      expect(sanitizeFileUrl("https://a1b2c3d4e5.ufs.sh/a/abc123.png")).toBeNull();
    });

    it("should handle null input", () => {
      expect(sanitizeFileUrl(null)).toBeNull();
      expect(sanitizeFileUrl(undefined)).toBeNull();
    });
  });

  describe("sanitizeName", () => {
    it("should allow alphanumeric and basic punctuation", () => {
      const input = "My Server_Name-123!";
      const result = sanitizeName(input);
      expect(result).toBe("My Server_Name-123!");
    });

    it("should remove dangerous characters", () => {
      const input = "Server<script>alert(1)</script>";
      const result = sanitizeName(input);
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
    });

    it("should limit length to 100 characters", () => {
      const input = "a".repeat(150);
      const result = sanitizeName(input);
      expect(result.length).toBe(100);
    });

    it("should trim whitespace", () => {
      const input = "  Server Name  ";
      const result = sanitizeName(input);
      expect(result).toBe("Server Name");
    });
  });

  describe("sanitizeEmoji", () => {
    it("should allow valid emoji", () => {
      const input = "👍";
      const result = sanitizeEmoji(input);
      expect(result).toBe("👍");
    });

    it("should limit emoji length", () => {
      const input = "👍".repeat(10);
      const result = sanitizeEmoji(input);
      expect(result.length).toBeLessThanOrEqual(8);
    });

    it("should remove angle brackets", () => {
      const input = "👍<script>";
      const result = sanitizeEmoji(input);
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
    });
  });
});
