"use client";

import { AlarmClock, BellRing, Check, Clock3, Loader2, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface ReminderItem {
  id: string;
  title: string;
  dueAt: string;
  link: string;
}

interface PushStatus {
  configured: boolean;
  publicKey: string | null;
  subscribed: boolean;
}

interface ReminderResponse {
  reminders: ReminderItem[];
  schedulerConfigured: boolean;
}

function localDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export const ReminderCenter = () => {
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [schedulerConfigured, setSchedulerConfigured] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState(() => localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    setError("");
    try {
      const [remindersResponse, pushResponse] = await Promise.all([
        fetch("/api/reminders", { cache: "no-store" }),
        fetch("/api/push-subscriptions", { cache: "no-store" }),
      ]);
      if (remindersResponse.ok) {
        const result: ReminderResponse = await remindersResponse.json();
        setReminders(result.reminders);
        setSchedulerConfigured(result.schedulerConfigured);
      }
      if (pushResponse.ok) {
        const status = await pushResponse.json();
        setPushStatus(status);
        if ("serviceWorker" in navigator && "PushManager" in window) {
          const registration = await navigator.serviceWorker.ready;
          const activeSubscription = await registration.pushManager.getSubscription();
          if (activeSubscription) setPushStatus({ ...status, subscribed: true });
        }
      }
    } catch {
      setError("Could not load reminders. Check your connection and try again.");
    }
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const createReminder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueAt: new Date(dueAt).toISOString(), link: window.location.pathname }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save this reminder.");
      setTitle("");
      setDeliveryNote(result.scheduledDelivery
        ? "Reminder saved. Bharat Meet will alert you at the scheduled time."
        : "Reminder saved. Keep Bharat Meet open for an alert, or configure QStash for background delivery.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this reminder.");
    } finally {
      setBusy(false);
    }
  };

  const enablePush = async () => {
    setBusy(true);
    setError("");
    try {
      if (!pushStatus?.configured || !pushStatus.publicKey) throw new Error("Push alerts are not configured for this deployment yet.");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error("This browser does not support push alerts. You can still use in-app reminders.");
      }
      const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      if (isIos && !isStandalone) throw new Error("On iPhone or iPad, install Bharat Meet to your Home Screen before enabling alerts.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Allow notifications in your browser settings to receive reminder alerts.");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(pushStatus.publicKey),
      });
      const response = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Could not enable push alerts.");
      setPushStatus({ ...pushStatus, subscribed: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not enable push alerts.");
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    setBusy(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      if (pushStatus) setPushStatus({ ...pushStatus, subscribed: false });
    } catch {
      setError("Could not turn off alerts for this device.");
    } finally {
      setBusy(false);
    }
  };

  const updateReminder = async (reminder: ReminderItem, action: "complete" | "snooze") => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "complete"
          ? { action, reminderId: reminder.id }
          : { action, reminderId: reminder.id, dueAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() }),
      });
      if (!response.ok) throw new Error("Could not update this reminder.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this reminder.");
    } finally {
      setBusy(false);
    }
  };

  const deleteReminder = async (reminderId: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/reminders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderId }),
      });
      if (!response.ok) throw new Error("Could not delete this reminder.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this reminder.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Reminders and alert settings" title="Reminders" className="h-11 w-11 shrink-0 rounded-xl border border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground sm:h-10 sm:w-10">
          <AlarmClock className="h-[1.1rem] w-[1.1rem]" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.25rem)] max-w-xl gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 text-card-foreground sm:w-full">
        <DialogHeader className="border-b border-border/70 px-5 py-5 pr-12 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2"><AlarmClock className="h-5 w-5 text-primary" /> Reminders</DialogTitle>
          <DialogDescription>Keep the next action close. Alerts can reach this device even when Bharat Meet isn’t open.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(90dvh-6rem)] space-y-5 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          <section className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface p-3.5 sm:p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BellRing className="h-4 w-4" /></span>
              <div className="min-w-0"><p className="text-sm font-semibold">Device alerts</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{pushStatus?.subscribed ? "Enabled on this device" : "Get reminder notifications on this device"}</p></div>
            </div>
            <Button size="sm" variant={pushStatus?.subscribed ? "outline" : "default"} disabled={busy || !pushStatus} onClick={() => pushStatus?.subscribed ? void disablePush() : void enablePush()} className="shrink-0 rounded-lg">
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{pushStatus?.subscribed ? "Turn off" : "Enable"}
            </Button>
          </section>

          <form onSubmit={createReminder} className="space-y-3 rounded-xl border border-border/70 p-3.5 sm:p-4">
            <div><h3 className="text-sm font-semibold">Create a reminder</h3><p className="mt-1 text-xs text-muted-foreground">We’ll alert you at the scheduled time.</p></div>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="What should you remember?" required className="h-11 rounded-xl bg-background" />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input type="datetime-local" value={dueAt} min={localDateTimeValue(new Date(Date.now() + 60_000))} onChange={(event) => setDueAt(event.target.value)} required className="h-11 min-w-0 flex-1 rounded-xl bg-background" />
              <Button type="submit" disabled={busy || !title.trim() || !dueAt} className="h-11 rounded-xl sm:px-5"><Plus className="mr-1.5 h-4 w-4" /> Add reminder</Button>
            </div>
          </form>

          <section className="space-y-2">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Upcoming</h3><span className="text-xs text-muted-foreground">{reminders.length}</span></div>
            {reminders.length === 0 ? <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No reminders yet. Add one for a meeting, follow-up, or next step.</div> : (
              <div className="space-y-2">
                {reminders.map((reminder) => {
                  const overdue = new Date(reminder.dueAt).getTime() <= Date.now();
                  return <article key={reminder.id} className="flex items-start gap-3 rounded-xl border border-border/70 bg-surface p-3">
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${overdue ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><Clock3 className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{reminder.title}</p><p className={`mt-1 text-xs ${overdue ? "text-primary" : "text-muted-foreground"}`}>{overdue ? "Due now · " : ""}{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(reminder.dueAt))}</p></div>
                    <div className="flex shrink-0 items-center gap-1">
                      {overdue && <Button size="icon" variant="ghost" aria-label="Snooze for 10 minutes" title="Snooze 10 minutes" disabled={busy} onClick={() => void updateReminder(reminder, "snooze")} className="h-8 w-8 rounded-lg"><Clock3 className="h-4 w-4" /></Button>}
                      <Button size="icon" variant="ghost" aria-label="Complete reminder" title="Complete reminder" disabled={busy} onClick={() => void updateReminder(reminder, "complete")} className="h-8 w-8 rounded-lg text-emerald-500"><Check className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Delete reminder" title="Delete reminder" disabled={busy} onClick={() => void deleteReminder(reminder.id)} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </article>;
                })}
              </div>
            )}
          </section>
          {error && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          {deliveryNote && <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">{deliveryNote}</p>}
          {(!pushStatus?.configured || !schedulerConfigured) && pushStatus && <p className="text-xs leading-5 text-muted-foreground">In-app reminders work now. Background alerts need QStash signing credentials; device push also needs VAPID keys.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
};
