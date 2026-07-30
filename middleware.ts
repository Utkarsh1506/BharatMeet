import { withClerkMiddleware } from "@clerk/nextjs/server";

// Apply Clerk middleware to handle authentication and public routes
export default withClerkMiddleware();

// Define public routes
export const config = {
  matcher: ["/api/uploadthing", "/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
