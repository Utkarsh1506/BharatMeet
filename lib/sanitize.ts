import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes dangerous tags and attributes while preserving safe formatting
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty || typeof dirty !== "string") {
    return "";
  }

  // Configure DOMPurify to allow basic formatting but remove scripts
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li", "code", "pre"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });

  return clean;
}

/**
 * Sanitize plain text content - escapes all HTML entities
 * Use this for user names, server names, channel names where no HTML should be allowed
 */
export function sanitizePlainText(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Sanitize message content - allows limited formatting and mentions
 * Preserves @mentions while sanitizing the rest
 */
export function sanitizeMessage(content: string): string {
  if (!content || typeof content !== "string") {
    return "";
  }

  // First, protect @mentions by temporarily replacing them
  const mentions: string[] = [];
  const mentionRegex = /@(\w+)/g;

  let withPlaceholders = content.replace(mentionRegex, (match) => {
    mentions.push(match);
    return `__MENTION_${mentions.length - 1}__`;
  });

  // Sanitize the content
  withPlaceholders = sanitizeHtml(withPlaceholders);

  // Restore mentions
  mentions.forEach((mention, index) => {
    withPlaceholders = withPlaceholders.replace(
      `__MENTION_${index}__`,
      sanitizePlainText(mention)
    );
  });

  return withPlaceholders;
}

/**
 * Sanitize URL to prevent javascript: and data: protocols
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") {
    return "";
  }

  const trimmed = url.trim().toLowerCase();

  // Block dangerous protocols
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("file:")
  ) {
    return "";
  }

  return url;
}

/**
 * Validate and sanitize file URLs from UploadThing
 */
export function sanitizeFileUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    // Only allow HTTPS URLs from trusted domains
    if (parsed.protocol !== "https:") {
      return null;
    }

    // Match trusted hostnames exactly. Substring checks also trust domains
    // such as uploadthing.com.attacker.example.
    const hostname = parsed.hostname.toLowerCase();
    const isUploadThingHost =
      hostname === "uploadthing.com" ||
      hostname === "utfs.io" ||
      /^[a-z0-9-]+\.ufs\.sh$/.test(hostname);
    if (isUploadThingHost && /^\/f\/[^/]+$/.test(parsed.pathname)) {
      return url;
    }

    // Block everything else
    return null;
  } catch {
    // Invalid URL
    return null;
  }
}

/**
 * Sanitize server/channel names - alphanumeric and basic punctuation only
 */
export function sanitizeName(name: string): string {
  if (!name || typeof name !== "string") {
    return "";
  }

  // Allow alphanumeric, spaces, hyphens, underscores, and basic punctuation
  return name
    .replace(/[^\w\s\-_.,'!?()]/g, "")
    .trim()
    .slice(0, 100); // Limit length
}

/**
 * Sanitize emoji input - basic validation
 */
export function sanitizeEmoji(emoji: string): string {
  if (!emoji || typeof emoji !== "string") {
    return "";
  }

  // Limit length and remove potential exploits
  return emoji
    .trim()
    .slice(0, 8) // Most emojis are 1-4 chars, but some complex ones can be longer
    .replace(/[<>]/g, ""); // Remove angle brackets just in case
}
