"use client";

import axios from "axios";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/file-upload";
import { useRouter } from "next/navigation";
import { reportClientError } from "@/lib/report-client-error";

const formSchema = z.object({
  name: z.string().trim().min(2, { message: "Workspace name must be at least 2 characters." }).max(80),
  imageUrl: z.string(),
});

const starterTemplates = [
  "Product Lab",
  "Design Studio",
  "Community Hub",
  "Startup Crew",
  "Learning Circle",
];

const getWorkspaceErrorMessage = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return "We couldn't create your workspace. Please try again.";
  }

  const status = error.response?.status;
  const responseData = error.response?.data as { error?: { requestId?: string } } | undefined;
  const requestId = error.response?.headers?.["x-request-id"] || responseData?.error?.requestId;
  if (status === 401) return `Your session expired. Refresh the page and sign in again.${requestId ? ` Reference: ${requestId}` : ""}`;
  if (status === 429) return `You’ve created workspaces too quickly. Please wait and try again.${requestId ? ` Reference: ${requestId}` : ""}`;

  let parsedResponse: unknown = error.response?.data;

  // Next.js and proxy failures sometimes return an HTML error page. Never
  // render that document inside the form; show a useful, safe message instead.
  if (typeof parsedResponse === "string") {
    try {
      parsedResponse = JSON.parse(parsedResponse);
    } catch {
      parsedResponse = null;
    }
  }

  if (parsedResponse && typeof parsedResponse === "object") {
    const data = parsedResponse as Record<string, unknown>;
    const nestedError = data.error;
    if (typeof nestedError === "string") return `${nestedError}${requestId ? ` Reference: ${requestId}` : ""}`;
    if (nestedError && typeof nestedError === "object" && "message" in nestedError) {
      const message = nestedError.message;
      if (typeof message === "string") return `${message}${requestId ? ` Reference: ${requestId}` : ""}`;
    }
    if (typeof data.message === "string") return `${data.message}${requestId ? ` Reference: ${requestId}` : ""}`;
  }

  if (requestId) return `We couldn’t create the workspace right now. Reference: ${requestId}`;
  if (!error.response) return "We couldn’t reach the workspace service. Check your connection and try again.";
  return `Workspace creation failed (HTTP ${status || "unknown"}). Try again; if it repeats, open the Error log for details.`;
};

const getWorkspaceErrorDetails = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const requestId = error.response?.headers?.["x-request-id"]
      || (responseData && typeof responseData === "object" && "error" in responseData
        ? (responseData as { error?: { requestId?: string } }).error?.requestId
        : undefined);
    return [
      `Request: ${error.config?.method?.toUpperCase() || "POST"} ${error.config?.url || "/api/servers"}`,
      `HTTP status: ${error.response?.status ?? "no response"}`,
      error.code ? `Client error code: ${error.code}` : "",
      requestId ? `Support ID: ${requestId}` : "",
      `Message: ${error.message}`,
      responseData ? `Response body: ${typeof responseData === "string" ? responseData.slice(0, 4000) : JSON.stringify(responseData, null, 2)}` : "No response body was received.",
      error.stack || "",
    ].filter(Boolean).join("\n");
  }

  if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack || ""}`;
  return typeof error === "string" ? error : JSON.stringify(error) || "Unknown workspace creation error";
};

export const InitialModal = () => {
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      imageUrl: "",
    },
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const response = await axios.post("/api/servers", values);

      form.reset();
      router.push(`/servers/${response.data.id}`);
    } catch (error) {
      reportClientError({
        title: "Workspace creation failed",
        message: axios.isAxiosError(error)
          ? `POST /api/servers failed${error.response?.status ? ` with HTTP ${error.response.status}` : " before receiving a response"}.`
          : error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        details: getWorkspaceErrorDetails(error),
      });
      form.setError("root", { message: getWorkspaceErrorMessage(error) });
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <Dialog open>
      <DialogContent className="overflow-hidden rounded-[1.75rem] border-border bg-card p-0 text-card-foreground shadow-2xl shadow-black/20 sm:max-w-xl">
        <DialogHeader className="border-b border-border/70 bg-gradient-to-br from-primary/15 via-transparent to-emerald-500/10 px-6 pb-6 pt-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/15 text-primary shadow-lg shadow-primary/10">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center text-2xl font-bold tracking-tight text-foreground">
            Build your first workspace
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Name your space now; add a workspace image whenever you’re ready.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-6 px-6 pt-6">
              <div className="flex items-center justify-center text-center">
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="section-kicker">Workspace image · optional</FormLabel>
                      <FormControl>
                        <FileUpload
                          endpoint="serverImage"
                          value={field.value}
                          onChange={field.onChange}
                          onUploadError={(error) =>
                            form.setError("imageUrl", { message: error.message })
                          }
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-rose-300" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <p className="section-kicker">
                  Quick picks
                </p>
                <div className="flex flex-wrap gap-2">
                  {starterTemplates.map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => form.setValue("name", template, { shouldValidate: true })}
                      className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground/80 transition duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/10 hover:text-foreground"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="section-kicker">
                      Workspace name
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className="h-12 rounded-xl border-border bg-input text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
                        placeholder="e.g. Product Builders"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-rose-300" />
                  </FormItem>
                )}
              />

              {form.formState.errors.root?.message && (
                  <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}
            </div>

            <DialogFooter className="border-t border-border/70 bg-sidebar px-6 py-4">
              <Button className="w-full sm:w-auto" variant="primary" disabled={isLoading}>
                {isLoading ? "Creating workspace..." : "Create workspace"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
