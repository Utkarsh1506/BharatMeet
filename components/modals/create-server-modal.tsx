"use client";

import axios from "axios";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

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
import { useModal } from "@/hooks/use-modal-store";

const getWorkspaceErrorMessage = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return "We couldn’t create the workspace. Check your connection and try again.";
  }

  const status = error.response?.status;
  if (status === 401) return "Your session expired. Refresh the page and sign in again.";
  if (status === 429) return "You’ve created workspaces too quickly. Please wait before trying again.";
  if (status === 503) return "Workspace creation is temporarily unavailable. Please try again shortly.";

  let data: unknown = error.response?.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      data = null;
    }
  }
  if (data && typeof data === "object") {
    const payload = data as Record<string, unknown>;
    const nested = payload.error;
    if (typeof nested === "string") return nested;
    if (nested && typeof nested === "object" && "message" in nested && typeof nested.message === "string") {
      return nested.message;
    }
    if (typeof payload.message === "string") return payload.message;
  }

  return "We couldn’t create the workspace. Check that its image finished uploading, then try again.";
};

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Workspace name is required."
  }),
  imageUrl: z.string().min(1, {
    message: "Workspace image is required."
  })
});

export const CreateServerModal = () => {
  const { isOpen, onClose, type } = useModal();
  const router = useRouter();

  const isModalOpen = isOpen && type === "createServer";

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
      await axios.post("/api/servers", values);

      form.reset();
      router.refresh();
      onClose();
    } catch (error) {
      form.setError("root", { message: getWorkspaceErrorMessage(error) });
    }
  }

  const handleClose = () => {
    form.reset();
    onClose();
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-card text-card-foreground p-0 overflow-hidden">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold">
            Customize your workspace
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500">
            Give your workspace a name and image. You can change them later.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-8 px-6">
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
                          onUploadError={(error) => form.setError("imageUrl", { message: error.message })}
                        />
                      </FormControl>
                      <FormMessage />
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
                      className="uppercase text-xs font-bold text-zinc-500 dark:text-secondary/70"
                    >
                      Workspace name
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className="border-border bg-input text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                        placeholder="Enter workspace name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {form.formState.errors.root?.message && (
              <p role="alert" className="px-6 text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}
            <DialogFooter className="bg-surface px-6 py-4">
              <Button variant="primary" disabled={isLoading}>
                {isLoading ? "Creating…" : "Create workspace"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
