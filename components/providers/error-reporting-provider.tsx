"use client";

import axios from "axios";
import React, { Component, useCallback, useEffect, useState } from "react";
import { AlertTriangle, Copy, X } from "lucide-react";
import type { ClientErrorDetail } from "@/lib/report-client-error";

type ErrorReport = {
  title: string;
  message: string;
  details: string;
  occurredAt: string;
};

type ReportError = (report: ErrorReport) => void;

class UiErrorBoundary extends Component<
  { children: React.ReactNode; reportError: ReportError },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.reportError({
      title: "A screen failed to render",
      message: error.message || error.name || "Unknown rendering error",
      details: [error.stack, info.componentStack].filter(Boolean).join("\n\nReact component stack:\n"),
      occurredAt: new Date().toISOString(),
    });
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
          <div className="w-full max-w-xl rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl">
            <h1 className="text-xl font-semibold">This screen ran into an error</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The exact error details are shown in the report panel. Reload the page to try again.
            </p>
            <button className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

const ErrorReportPanel = ({ report, onDismiss }: { report: ErrorReport; onDismiss: () => void }) => {
  const [copied, setCopied] = useState(false);
  const diagnosticText = `${report.title}\n${report.message}\nOccurred: ${report.occurredAt}\n\n${report.details}`;

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section role="alert" aria-live="assertive" className="fixed bottom-4 right-4 z-[9999] max-h-[75vh] w-[min(38rem,calc(100vw-2rem))] overflow-auto rounded-2xl border border-rose-400/40 bg-card text-card-foreground shadow-2xl shadow-black/40">
      <div className="flex items-start gap-3 border-b border-border p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{report.title}</h2>
          <p className="mt-1 break-words text-sm text-foreground">{report.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">{report.occurredAt}</p>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss error report" className="rounded-md p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 p-4">
        <details open>
          <summary className="cursor-pointer text-sm font-medium">Exact diagnostic details</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background p-3 text-xs text-muted-foreground">{report.details || report.message}</pre>
        </details>
        <button type="button" onClick={copyDetails} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-surface-hover">
          <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy error details"}
        </button>
      </div>
    </section>
  );
};

export const ErrorReportingProvider = ({ children }: { children: React.ReactNode }) => {
  const [report, setReport] = useState<ErrorReport | null>(null);
  const reportError = useCallback<ReportError>((nextReport) => setReport(nextReport), []);

  useEffect(() => {
    const originalFetch = window.fetch;
    const isWatchedPath = (value: RequestInfo | URL) => {
      try {
        const rawUrl = typeof value === "string" ? value : value instanceof URL ? value.href : value.url;
        const pathname = new URL(rawUrl, window.location.origin).pathname;
        return pathname.startsWith("/__clerk/") || pathname.startsWith("/api/servers") || pathname.startsWith("/api/uploadthing");
      } catch {
        return false;
      }
    };
    const watchedFetch: typeof window.fetch = async (input, init) => {
      const watched = isWatchedPath(input);
      try {
        const response = await originalFetch(input, init);
        if (watched && !response.ok) {
          const requestPath = new URL(
            typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
            window.location.origin,
          ).pathname;
          void response.clone().json().then((payload: unknown) => {
            const value = payload as {
              errors?: Array<{ message?: string; longMessage?: string; code?: string }>;
              error?: { message?: string; code?: string; requestId?: string } | string;
              message?: string;
            };
            const clerkErrors = value.errors?.map((item) => item.longMessage || item.message).filter(Boolean).join("; ");
            const apiError = typeof value.error === "object" ? value.error : undefined;
            const message = clerkErrors || apiError?.message || (typeof value.error === "string" ? value.error : "") || value.message || response.statusText || "Request failed";
            reportError({
              title: `Request failed (HTTP ${response.status})`,
              message,
              details: [
                `Request: ${requestPath}`,
                apiError?.code || value.errors?.[0]?.code ? `Error code: ${apiError?.code || value.errors?.[0]?.code}` : "",
                apiError?.requestId ? `Support ID: ${apiError.requestId}` : "",
                clerkErrors ? `Clerk error details: ${clerkErrors}` : "",
              ].filter(Boolean).join("\n"),
              occurredAt: new Date().toISOString(),
            });
          }).catch(() => {
            reportError({
              title: `Request failed (HTTP ${response.status})`,
              message: response.statusText || "Request failed",
              details: `Request: ${requestPath}\nResponse content type: ${response.headers.get("content-type") || "unknown"}`,
              occurredAt: new Date().toISOString(),
            });
          });
        }
        return response;
      } catch (error) {
        if (watched) {
          const message = error instanceof Error ? error.message : String(error);
          const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          reportError({
            title: "Authentication or workspace request could not reach the server",
            message,
            details: `Request: ${new URL(rawUrl, window.location.origin).pathname}\n${error instanceof Error ? error.stack || message : message}`,
            occurredAt: new Date().toISOString(),
          });
        }
        throw error;
      }
    };
    window.fetch = watchedFetch;

    const onWindowError = (event: ErrorEvent) => {
      const message = event.error instanceof Error ? event.error.message : event.message || "A browser resource failed to load.";
      const stack = event.error instanceof Error ? event.error.stack : undefined;
      reportError({
        title: "A browser error occurred",
        message,
        details: [stack, event.filename && `Source: ${event.filename}:${event.lineno}:${event.colno}`].filter(Boolean).join("\n"),
        occurredAt: new Date().toISOString(),
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason instanceof Error && reason.name === "AbortError") return;
      const message = reason instanceof Error ? reason.message : String(reason ?? "Promise rejected without a reason");
      reportError({
        title: "An unhandled operation failed",
        message,
        details: reason instanceof Error ? reason.stack || message : message,
        occurredAt: new Date().toISOString(),
      });
    };

    const onApplicationError = (event: Event) => {
      const detail = (event as CustomEvent<ClientErrorDetail>).detail;
      if (!detail) return;
      reportError({
        title: detail.title,
        message: detail.message,
        details: detail.details || detail.message,
        occurredAt: new Date().toISOString(),
      });
    };

    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (!status || status >= 400) {
            const payload = error.response?.data as { error?: { message?: string; code?: string; requestId?: string } } | undefined;
            const message = payload?.error?.message || error.message || "Request failed";
            reportError({
              title: status ? `Request failed (HTTP ${status})` : "The server could not be reached",
              message,
              details: [
                error.config?.method?.toUpperCase() && error.config?.url ? `Request: ${error.config.method.toUpperCase()} ${error.config.url}` : "",
                payload?.error?.code ? `Error code: ${payload.error.code}` : "",
                payload?.error?.requestId ? `Support ID: ${payload.error.requestId}` : "",
                error.response?.data ? `Response: ${JSON.stringify(error.response.data, null, 2)}` : "No response received. Check the network tab and server logs.",
              ].filter(Boolean).join("\n"),
              occurredAt: new Date().toISOString(),
            });
          }
        }
        return Promise.reject(error);
      },
    );

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("bharatmeet:error", onApplicationError);
    return () => {
      if (window.fetch === watchedFetch) window.fetch = originalFetch;
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("bharatmeet:error", onApplicationError);
      axios.interceptors.response.eject(interceptorId);
    };
  }, [reportError]);

  return (
    <>
      <UiErrorBoundary reportError={reportError}>{children}</UiErrorBoundary>
      {report && <ErrorReportPanel report={report} onDismiss={() => setReport(null)} />}
    </>
  );
};
