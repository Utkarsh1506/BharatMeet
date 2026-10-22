import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/api/health(.*)",
  "/api/reminders/dispatch(.*)",
  "/manifest.webmanifest",
  "/sw.js",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite(.*)",
]);

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect();
    }
  },
  {
    frontendApiProxy: {
      enabled: true,
      path: "/__clerk",
    },
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals and static files, while always running for APIs.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // Clerk Frontend API requests must reach the built-in proxy middleware.
    "/__clerk/:path*",
  ],
};
