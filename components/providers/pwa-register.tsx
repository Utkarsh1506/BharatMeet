"use client";

import { useEffect } from "react";

export const PwaRegister = () => {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const registrationPromise = navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("[PWA_SERVICE_WORKER] Registration failed", error);
      return null;
    });
    const checkDueReminders = async () => {
      if (!("Notification" in window) || Notification.permission !== "granted" || document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/reminders", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const due = (data.reminders || []).filter((reminder: { dueAt: string; completedAt?: string | null; sentAt?: string | null }) =>
          new Date(reminder.dueAt).getTime() <= Date.now() && !reminder.completedAt && !reminder.sentAt,
        );
        if (!due.length) return;
        const registration = await registrationPromise;
        if (!registration) return;
        for (const reminder of due) {
          const storageKey = `bharatmeet-reminder-alert-${reminder.id}`;
          if (localStorage.getItem(storageKey)) continue;
          await registration.showNotification("Bharat Meet reminder", {
            body: reminder.title,
            icon: "/icons/icon-192.png",
            tag: `reminder-${reminder.id}`,
            data: { url: reminder.link || "/" },
            renotify: false,
          });
          localStorage.setItem(storageKey, "shown");
        }
      } catch {
        // Reminder polling is best-effort; scheduled push delivery runs server-side.
      }
    };
    void checkDueReminders();
    const interval = window.setInterval(checkDueReminders, 60_000);
    window.addEventListener("focus", checkDueReminders);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkDueReminders);
    };
  }, []);

  return null;
};
