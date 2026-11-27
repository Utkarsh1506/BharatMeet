import type { Instrumentation } from "next";

/**
 * Next.js intentionally redacts Server Component exception details from the
 * browser in production. Keep the actionable error and route context in the
 * Vercel Function Logs so a digest can be traced to its actual cause.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const pathname = request.path.split("?")[0].replace(/^\/invite\/[^/]+/, "/invite/[redacted]");
  const errorRecord = error && typeof error === "object" ? error as { digest?: unknown; name?: unknown; message?: unknown } : null;

  console.error("[NEXT_REQUEST_ERROR]", {
    message: error instanceof Error ? error.message : typeof errorRecord?.message === "string" ? errorRecord.message : String(error),
    name: error instanceof Error ? error.name : typeof errorRecord?.name === "string" ? errorRecord.name : typeof error,
    digest: typeof errorRecord?.digest === "string" ? errorRecord.digest : undefined,
    stack: error instanceof Error ? error.stack : undefined,
    method: request.method,
    pathname,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });
};
