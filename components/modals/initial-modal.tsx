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

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Server name is required.",
  }),
  imageUrl: z.string().min(1, {
    message: "Server image is required.",
  }),
});

const starterTemplates = [
  "Product Lab",
  "Design Studio",
  "Community Hub",
  "Startup Crew",
  "Learning Circle",
];

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
      const message = axios.isAxiosError(error)
        ? error.response?.data || "We couldn't create your Sabha. Please try again."
        : "We couldn't create your Sabha. Please try again.";

      form.setError("root", { message });
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <Dialog open>
      <DialogContent className="overflow-hidden border border-white/10 bg-surface p-0 text-white shadow-2xl shadow-indigo-950/30 sm:max-w-xl">
        <DialogHeader className="border-b border-white/10 bg-gradient-to-r from-indigo-500/20 via-violet-500/10 to-cyan-500/20 px-6 pb-6 pt-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 shadow-lg shadow-indigo-500/30">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <DialogTitle className="text-center text-2xl font-bold tracking-tight text-white">
            Build your first workspace
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-zinc-300">
            Start a focused space for your team, community, or next big idea.
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
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Quick picks
                </p>
                <div className="flex flex-wrap gap-2">
                  {starterTemplates.map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => form.setValue("name", template, { shouldValidate: true })}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-indigo-400/60 hover:bg-indigo-500/10"
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
                    <FormLabel className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      Workspace name
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className="h-11 border border-white/10 bg-surface-hover text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500"
                        placeholder="e.g. Product Builders"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-rose-300" />
                  </FormItem>
                )}
              />

              {form.formState.errors.root?.message && (
                <p role="alert" className="text-sm text-rose-300">
                  {form.formState.errors.root.message}
                </p>
              )}
            </div>

            <DialogFooter className="border-t border-white/10 bg-sidebar px-6 py-4">
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
