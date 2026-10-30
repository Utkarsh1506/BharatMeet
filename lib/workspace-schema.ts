import { z } from "zod";

import { sanitizeFileUrl, sanitizeName } from "@/lib/sanitize";

export const DEFAULT_WORKSPACE_IMAGE = "/icons/icon-192.png";

export const workspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters.")
    .max(80)
    .transform((value) => sanitizeName(value))
    .pipe(z.string().min(2).max(80)),
  imageUrl: z.preprocess(
    (value) => value === "" || value == null ? DEFAULT_WORKSPACE_IMAGE : value,
    z.union([
      z.literal(DEFAULT_WORKSPACE_IMAGE),
      z.string()
        .url("A valid workspace image is required.")
        .max(2048)
        .refine((value) => sanitizeFileUrl(value) !== null, "Use an image uploaded through UploadThing"),
    ]),
  ),
});
