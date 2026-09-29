"use client";

import axios from "axios";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";

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
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/file-upload";
import { useRouter } from "next/navigation";

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Server name is required."
  }),
  imageUrl: z.string().min(1, {
    message: "Server image is required."
  })
});

// ... previous imports and code ...

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
    }
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
  }

  if (!isMounted) {
    return null;
  }

  return (
    <Dialog open>
      <DialogContent className="overflow-hidden border-border bg-background p-0 text-foreground sm:max-w-md">
        <DialogHeader className="border-b border-border bg-card px-6 pb-6 pt-8">
          <DialogTitle className="text-center text-2xl font-bold tracking-tight">
            Start your first Sabha
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Create a focused space for your team, community, or next big idea.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-6 px-6 pt-2">
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

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Name your Sabha
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className="h-11 border-border bg-background focus-visible:ring-indigo-500"
                        placeholder="e.g. Product Builders"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root?.message && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}
            </div>
            <DialogFooter className="border-t border-border bg-muted/30 px-6 py-4">
              <Button className="w-full sm:w-auto" variant="primary" disabled={isLoading}>
                {isLoading ? "Creating Sabha..." : "Create Sabha"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
