"use client";

import * as z from "zod";
import axios from "axios";
import qs from "query-string";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useModal } from "@/hooks/use-modal-store";
import { EmojiPicker } from "@/components/emoji-picker";

interface ChatInputProps {
  apiUrl: string;
  query: Record<string, any>;
  name: string;
  type: "conversation" | "channel";
}

const formSchema = z.object({
  content: z.string().trim().min(1, "Write a message before sending."),
});

export const ChatInput = ({
  apiUrl,
  query,
  name,
  type,
}: ChatInputProps) => {
  const { onOpen } = useModal();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
    }
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const url = qs.stringifyUrl({
        url: apiUrl,
        query,
      });

      await axios.post(url, values);

      form.reset();
      router.refresh();
    } catch (error) {
      form.setError("root", {
        message: axios.isAxiosError(error)
          ? error.response?.data || "Your message could not be sent. Try again."
          : "Your message could not be sent. Try again.",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative p-4 pb-6">
                  <button
                    type="button"
                    onClick={() => onOpen("messageFile", { apiUrl, query })}
                    aria-label="Attach a file"
                    className="absolute left-8 top-7 flex h-6 w-6 items-center justify-center rounded-full bg-background p-1 text-primary transition hover:bg-primary hover:text-primary-foreground"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <Input
                    disabled={isLoading}
                    className="border-border bg-muted/80 px-14 py-6 text-foreground focus-visible:ring-primary"
                    placeholder={`Message ${type === "conversation" ? name : "🔥" + name}`}
                    {...field}
                  />
                  <div className="absolute top-7 right-8">
                    <EmojiPicker
                      onChange={(emoji: string) => field.onChange(`${field.value} ${emoji}`)}
                    />
                  </div>
                </div>
                {form.formState.errors.root?.message && (
                  <p role="alert" className="px-1 text-xs text-destructive">
                    {form.formState.errors.root.message}
                  </p>
                )}
                {isLoading && (
                  <Loader2 className="absolute right-14 top-7 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}