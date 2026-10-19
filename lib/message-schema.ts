import { z } from "zod";
import { sanitizeMessage, sanitizeFileUrl } from "./sanitize";

const fileUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((value) => sanitizeFileUrl(value) !== null, "Only secure UploadThing attachments are allowed")
  .optional()
  .nullable()
  .transform((val) => sanitizeFileUrl(val) ?? null);

export const createMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Content is required.")
    .max(4000)
    .transform((val) => sanitizeMessage(val)),
  fileUrl: fileUrlSchema,
  replyToId: z.string().uuid().optional().nullable(),
});

export const updateMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Content is required.")
    .max(4000)
    .transform((val) => sanitizeMessage(val)),
});
