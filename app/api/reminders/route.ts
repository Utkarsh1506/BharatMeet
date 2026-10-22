import { NextResponse } from "next/server";
import { z } from "zod";

import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { ApiErrors, handleApiError } from "@/lib/api-error";
import { checkRateLimit, apiLimiter, getRateLimitHeaders } from "@/lib/rate-limit";
import { reminderSchedulerConfigured, scheduleReminderDelivery } from "@/lib/reminder-scheduler";

export const dynamic = "force-dynamic";

const reminderCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  dueAt: z.string().datetime({ offset: true }).refine((value) => new Date(value).getTime() > Date.now(), "Choose a future time"),
  link: z.string().trim().max(500).default("/").refine((value) => value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"), "Link must be an internal path"),
}).strict();

export async function GET() {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();
    const result = await checkRateLimit(apiLimiter, profile.id);
    if (!result.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(result));
    const reminders = await db.reminder.findMany({
      where: { profileId: profile.id, completedAt: null, dueAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      orderBy: { dueAt: "asc" },
      take: 50,
    });
    return NextResponse.json({ reminders, schedulerConfigured: reminderSchedulerConfigured }, { headers: getRateLimitHeaders(result) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();
    const result = await checkRateLimit(apiLimiter, profile.id);
    if (!result.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(result));
    const parsed = reminderCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid reminder." }, { status: 400 });
    const reminder = await db.reminder.create({
      data: { profileId: profile.id, title: parsed.data.title, dueAt: new Date(parsed.data.dueAt), link: parsed.data.link },
    });
    let scheduledDelivery = false;
    if (reminderSchedulerConfigured) {
      try {
        scheduledDelivery = await scheduleReminderDelivery(reminder.id, reminder.dueAt);
      } catch {
        await db.reminder.deleteMany({ where: { id: reminder.id, profileId: profile.id } });
        return NextResponse.json({ error: "Could not schedule this alert. Please try again." }, { status: 503 });
      }
    }
    return NextResponse.json({ ...reminder, scheduledDelivery }, { status: 201, headers: getRateLimitHeaders(result) });
  } catch (error) {
    return handleApiError(error);
  }
}

const reminderUpdateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete"), reminderId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("snooze"), reminderId: z.string().uuid(), dueAt: z.string().datetime({ offset: true }).refine((value) => new Date(value).getTime() > Date.now()) }).strict(),
]);

export async function PATCH(request: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();
    const result = await checkRateLimit(apiLimiter, profile.id);
    if (!result.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(result));
    const parsed = reminderUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid reminder update." }, { status: 400 });
    const { action, reminderId } = parsed.data;
    const update = action === "complete"
      ? { completedAt: new Date() }
      : { dueAt: new Date(parsed.data.dueAt), sentAt: null };
    const changed = await db.reminder.updateMany({ where: { id: reminderId, profileId: profile.id, completedAt: null }, data: update });
    if (changed.count === 0) return ApiErrors.notFound("Reminder not found.");
    return NextResponse.json({ success: true }, { headers: getRateLimitHeaders(result) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const profile = await currentProfile();
    if (!profile) return ApiErrors.unauthorized();
    const result = await checkRateLimit(apiLimiter, profile.id);
    if (!result.success) return ApiErrors.rateLimitExceeded(undefined, getRateLimitHeaders(result));
    const parsed = z.object({ reminderId: z.string().uuid() }).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid reminder ID." }, { status: 400 });
    await db.reminder.deleteMany({ where: { id: parsed.data.reminderId, profileId: profile.id } });
    return NextResponse.json({ success: true }, { headers: getRateLimitHeaders(result) });
  } catch (error) {
    return handleApiError(error);
  }
}
