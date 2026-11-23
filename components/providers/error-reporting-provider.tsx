"use client";

import axios from "axios";
import React, { Component, useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bug, Copy, Trash2, X } from "lucide-react";
import type { ClientErrorDetail } from "@/lib/report-client-error";

type ErrorReport = {
  id: string;
  title: string;
  message: string;
  details: string;
  occurredAt: string;
  occurrences?: number;
};

type ReportError = (report: Omit<ErrorReport, "id">) => void;

const ERROR_LOG_KEY = "bharatmeet:error-log:v1";
const MAX_ERROR_LOGS = 50;
const ERROR_REPEAT_WINDOW_MS = 5 * 60 * 1000;

const compactReports = (reports: ErrorReport[]) => {
  const compacted: ErrorReport[] = [];
  const seen = new Map<string, number>();

  for (const report of reports) {
    if (!report || typeof report.title !== "string" || typeof report.message !== "string") continue;
    const signature = `${report.title}\u0000${report.message}`;
    const matchingIndex = seen.get(signature);
    if (matchingIndex === undefined) {
      seen.set(signature, compacted.length);
      compacted.push({ ...report, occurrences: Math.max(1, report.occurrences || 1) });
      continue;
    }

    const current = compacted[matchingIndex];
    compacted[matchingIndex] = {
      ...current,
      details: report.occurredAt > current.occurredAt ? report.details : current.details,
      occurredAt: report.occurredAt > current.occurredAt ? report.occurredAt : current.occurredAt,
      occurrences: (current.occurrences || 1) + Math.max(1, report.occurrences || 1),
    };
  }

  return compacted.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, MAX_ERROR_LOGS);
};

const redactSensitiveValues = (text: string) => text
  .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[redacted]")
  .replace(/((?:secret|token|password|authorization|cookie)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi, "$1[redacted]");

const formatDiagnosticValue = (value: unknown) => {
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
};

const getReportText = (report: ErrorReport) =>
  `${report.title}\n${report.message}\nOccurred: ${report.occurredAt}\n\n${report.details}`;

const copyText = async (text: string) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back for browsers that block Clipboard API access.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
};

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

const ErrorLogPanel = ({ reports, onClose, onClear }: { reports: ErrorReport[]; onClose: () => void; onClear: () => void }) => {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [filter, setFilter] = useState<"all" | "workspace">("all");
  const [expandedReportIds, setExpandedReportIds] = useState<Set<string>>(() => new Set());
  const visibleReports = filter === "all"
    ? reports
    : reports.filter((report) => /workspace|\/api\/servers/i.test(`${report.title}\n${report.details}`));
  const allVisibleExpanded = visibleReports.length > 0 && visibleReports.every((report) => expandedReportIds.has(report.id));

  const toggleReportDetails = (reportId: string) => {
    setExpandedReportIds((current) => {
      const next = new Set(current);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  };

  const copyDetails = async () => {
    const copied = await copyText(reports.map(getReportText).join("\n\n---\n\n"));
    setCopyStatus(copied ? "copied" : "failed");
  };

  return (
    <section id="bharatmeet-error-log" aria-label="Error log" className="pointer-events-auto fixed bottom-16 right-4 z-[10001] flex max-h-[75vh] w-[min(38rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-rose-400/40 bg-card text-card-foreground shadow-2xl shadow-black/40">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Error log</h2>
          <p className="text-xs text-muted-foreground">{reports.length} recent {reports.length === 1 ? "issue" : "issues"} · saved on this device</p>
        </div>
        <button type="button" onClick={onClear} disabled={!reports.length} aria-label="Clear error log" className="rounded-md p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground disabled:opacity-40">
          <Trash2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} aria-label="Close error log" className="rounded-md p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2 border-b border-border px-3 py-2">
        <button type="button" onClick={() => setFilter("all")} aria-pressed={filter === "all"} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-hover"}`}>All issues</button>
        <button type="button" onClick={() => setFilter("workspace")} aria-pressed={filter === "workspace"} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === "workspace" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-hover"}`}>Workspace creation</button>
      </div>
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">{visibleReports.length} shown</span>
        <button
          type="button"
          disabled={!visibleReports.length}
          onClick={() => setExpandedReportIds(allVisibleExpanded ? new Set() : new Set(visibleReports.map((report) => report.id)))}
          className="rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-surface-hover disabled:opacity-40"
        >
          {allVisibleExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!visibleReports.length && <p className="p-5 text-center text-sm text-muted-foreground">{filter === "workspace" ? "No workspace creation errors are in this log yet." : "No errors have been captured on this device."}</p>}
        {visibleReports.map((report) => (
          <article key={report.id} className="rounded-xl border border-border bg-background/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{report.title}</h3>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{report.message}</p>
                <time className="mt-2 block text-[11px] text-muted-foreground">{report.occurredAt}{(report.occurrences || 1) > 1 ? ` · repeated ${report.occurrences} times` : ""}</time>
              </div>
              <button type="button" onClick={async () => setCopyStatus(await copyText(getReportText(report)) ? "copied" : "failed")} aria-label="Copy this error" className="pointer-events-auto shrink-0 rounded-md p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              aria-expanded={expandedReportIds.has(report.id)}
              aria-controls={`error-details-${report.id}`}
              onClick={() => toggleReportDetails(report.id)}
              className="mt-2 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {expandedReportIds.has(report.id) ? "Hide exact details" : "Show exact details"}
            </button>
            {expandedReportIds.has(report.id) && (
              <pre id={`error-details-${report.id}`} className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-card p-3 text-[11px] text-muted-foreground">{report.details || report.message}</pre>
            )}
          </article>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border p-3">
        <p className="text-[11px] leading-4 text-muted-foreground">Server errors include a support ID. Match it in Vercel function logs.</p>
        <button type="button" onClick={copyDetails} disabled={!reports.length} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-surface-hover disabled:opacity-40">
          <Copy className="h-3.5 w-3.5" /> {copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy all"}
        </button>
      </div>
    </section>
  );
};

export const ErrorReportingProvider = ({ children }: { children: React.ReactNode }) => {
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [hasLoadedSavedLogs, setHasLoadedSavedLogs] = useState(false);
  const reportError = useCallback<ReportError>((nextReport) => {
    const safeReport = {
      ...nextReport,
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      title: redactSensitiveValues(nextReport.title),
      message: redactSensitiveValues(nextReport.message),
      details: redactSensitiveValues(nextReport.details),
    };
    setReports((current) => {
      const mostRecent = current[0];
      const duplicateIndex = current.findIndex((report) =>
        report.title === safeReport.title
        && report.message === safeReport.message
        && Date.now() - Date.parse(report.occurredAt) < ERROR_REPEAT_WINDOW_MS,
      );
      if (duplicateIndex >= 0) {
        const duplicate = current[duplicateIndex];
        const updated = {
          ...duplicate,
          details: safeReport.details || duplicate.details,
          occurredAt: safeReport.occurredAt,
          occurrences: (duplicate.occurrences || 1) + 1,
        };
        return [updated, ...current.filter((_, index) => index !== duplicateIndex)].slice(0, MAX_ERROR_LOGS);
      }
      return [{ ...safeReport, occurrences: 1 }, ...current].slice(0, MAX_ERROR_LOGS);
    });
    setIsLogOpen(true);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ERROR_LOG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ErrorReport[];
        if (Array.isArray(parsed)) setReports((current) => compactReports([...current, ...parsed]));
      }
    } catch {
      localStorage.removeItem(ERROR_LOG_KEY);
    } finally {
      setHasLoadedSavedLogs(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedLogs) return;
    try {
      localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(reports));
    } catch {
      // Keep errors visible for this session if storage is disabled or full.
    }
  }, [reports, hasLoadedSavedLogs]);

  useEffect(() => {
    const originalConsoleError = console.error;
    const capturedConsoleError: typeof console.error = (...args) => {
      const diagnostic = args.map(formatDiagnosticValue).join(" ");
      reportError({
        title: "Console error",
        message: redactSensitiveValues(diagnostic.split("\n")[0] || "An error was logged by the app"),
        details: diagnostic,
        occurredAt: new Date().toISOString(),
      });
      originalConsoleError.apply(console, args);
    };
    console.error = capturedConsoleError;

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
              error?: { message?: string; code?: string; requestId?: string; details?: unknown } | string;
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
                apiError?.requestId || response.headers.get("x-request-id") ? `Support ID: ${apiError?.requestId || response.headers.get("x-request-id")}` : "",
                clerkErrors ? `Clerk error details: ${clerkErrors}` : "",
                apiError?.details ? `Validation or server details: ${formatDiagnosticValue(apiError.details)}` : "",
              ].filter(Boolean).join("\n"),
              occurredAt: new Date().toISOString(),
            });
          }).catch(() => {
            void response.clone().text().then((body) => {
              const bodyPreview = body
                .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
                .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 1200);
              reportError({
                title: `Request failed (HTTP ${response.status})`,
                message: bodyPreview || response.statusText || "Request failed",
                details: [
                  `Request: ${requestPath}`,
                  `Response content type: ${response.headers.get("content-type") || "unknown"}`,
                  response.headers.get("x-request-id") ? `Support ID: ${response.headers.get("x-request-id")}` : "",
                  bodyPreview ? `Response preview: ${bodyPreview}` : "",
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
      if (console.error === capturedConsoleError) console.error = originalConsoleError;
      if (window.fetch === watchedFetch) window.fetch = originalFetch;
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("bharatmeet:error", onApplicationError);
      axios.interceptors.response.eject(interceptorId);
    };
  }, [reportError]);

  const clearReports = () => setReports([]);

  return (
    <>
      <UiErrorBoundary reportError={reportError}>{children}</UiErrorBoundary>
      {isLogOpen && <ErrorLogPanel reports={reports} onClose={() => setIsLogOpen(false)} onClear={clearReports} />}
      {!isLogOpen && (
        <button type="button" onClick={() => setIsLogOpen(true)} aria-expanded={false} aria-controls="bharatmeet-error-log" className="pointer-events-auto fixed bottom-4 right-4 z-[10001] inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-xl shadow-black/30 transition hover:border-rose-400/50 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Bug className="h-4 w-4 text-rose-400" /> Error log
          {reports.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{reports.length}</span>}
        </button>
      )}
    </>
  );
};
