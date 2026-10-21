import { authMiddleware } from "@clerk/nextjs/server";

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
  publicRoutes: [
    "/",
    "/api/health",
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
    // Match all routes except static files and the public health endpoint.
    "/((?!_next/static|_next/image|favicon.ico|api/health(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
