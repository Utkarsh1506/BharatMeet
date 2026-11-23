/**
 * Dependency-free sanitizers for API validation. Keep these separate from
 * DOMPurify so routes validating names and uploaded URLs do not load jsdom.
 */
export function sanitizeFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;

    const hostname = parsed.hostname.toLowerCase();
    const isUploadThingHost = hostname === "uploadthing.com"
      || hostname === "utfs.io"
      || /^[a-z0-9-]+\.ufs\.sh$/.test(hostname);

    return isUploadThingHost && /^\/f\/[^/]+$/.test(parsed.pathname) ? url : null;
  } catch {
    return null;
  }
}

/** Sanitize workspace and channel names without pulling in browser DOM code. */
export function sanitizeName(name: string): string {
  if (!name || typeof name !== "string") return "";

  return name
    .replace(/[^\w\s\-_.,'!?()]/g, "")
    .trim()
    .slice(0, 100);
}
