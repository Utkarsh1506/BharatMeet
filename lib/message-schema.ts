import { z } from "zod";

const fileUrlSchema = z.string().url().max(2048).optional().nullable();

export const createMessageSchema = z.object({
  content: z.string().trim().min(1, "Content is required.").max(4000),
  fileUrl: fileUrlSchema,
});

export const updateMessageSchema = z.object({
  content: z.string().trim().min(1, "Content is required.").max(4000),
});