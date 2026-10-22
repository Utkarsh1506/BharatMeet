import { authMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const clerkProxyPath = "/__clerk";

const getClerkFrontendApiOrigin = () => {
  const configuredFrontendApi = process.env.CLERK_FAPI || process.env.NEXT_PUBLIC_CLERK_FAPI;
  if (configuredFrontendApi) {
    const url = new URL(configuredFrontendApi);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("CLERK_FAPI must be an HTTPS origin.");
    }
    return url.origin;
  }

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const match = publishableKey?.match(/^pk_(?:test|live)_([A-Za-z0-9+/_=-]+)$/);
  if (!match) throw new Error("A valid Clerk publishable key is required for the Clerk proxy.");

  const encodedHost = match[1].replace(/-/g, "+").replace(/_/g, "/");
  const frontendApiHost = atob(encodedHost).split("$")[0];
  const url = new URL(`https://${frontendApiHost}`);
  if (url.protocol !== "https:" || url.hostname !== frontendApiHost || url.username || url.password) {
    throw new Error("The Clerk publishable key does not contain a valid Frontend API host.");
  }

  return url.origin;
};

const buildClerkProxyResponse = (request: NextRequest) => {
  if (!request.nextUrl.pathname.startsWith(`${clerkProxyPath}/`) && request.nextUrl.pathname !== clerkProxyPath) {
    return undefined;
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Clerk proxy is not configured." }, { status: 503 });
  }

  try {
    const targetUrl = new URL(getClerkFrontendApiOrigin());
    targetUrl.pathname = request.nextUrl.pathname.slice(clerkProxyPath.length) || "/";
    targetUrl.search = request.nextUrl.search;

    const headers = new Headers(request.headers);
    const connectionHeaders = headers.get("connection");
    connectionHeaders?.split(",").forEach((name) => headers.delete(name.trim()));
    ["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade", "host"].forEach((name) => headers.delete(name));

    const proxyUrl = new URL(clerkProxyPath, request.nextUrl.origin).toString();
    const vercelClientIp = process.env.VERCEL === "1"
      ? request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for")
      : null;
    if (process.env.VERCEL === "1" && !vercelClientIp) {
      return NextResponse.json({ error: "The trusted client IP is unavailable for the Clerk proxy." }, { status: 503 });
    }

    headers.set("Clerk-Proxy-Url", proxyUrl);
    headers.set("Clerk-Secret-Key", secretKey);
    headers.set("X-Forwarded-For", vercelClientIp || "127.0.0.1");

    return NextResponse.rewrite(targetUrl, { request: { headers } });
  } catch {
    return NextResponse.json({ error: "Clerk proxy configuration is invalid." }, { status: 503 });
  }
};

/**
 * Clerk authentication middleware
 * Protects routes and handles authentication
 *
 * Public routes that don't require authentication:
 * - Home page
 * - Health check endpoint
 * - Sign in/up pages
 * - Invite pages
 */
export default authMiddleware({
  proxyUrl: process.env.NEXT_PUBLIC_CLERK_PROXY_URL
    ? (url) => new URL(`${clerkProxyPath}/`, url).toString()
    : undefined,
  beforeAuth: buildClerkProxyResponse,
  publicRoutes: [
    "/",
    "/api/health",
    "/api/reminders/dispatch",
    "/manifest.webmanifest",
    "/sw.js",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/invite(.*)",
  ],
});

/**
 * Matcher configuration
 * Defines which routes the middleware should run on
 *
 * Excludes:
 * - Static files (/_next/static)
 * - Image optimization (/_next/image)
 * - Favicon and other static assets
 * - Health check endpoint (handled separately for monitoring)
 */
export const config = {
  matcher: [
    // Clerk's recommended matcher for app routes and APIs.
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    "/(api|trpc)(.*)",
    // Clerk Frontend API proxy requests must always reach this middleware.
    "/__clerk/:path*",
  ],
};
