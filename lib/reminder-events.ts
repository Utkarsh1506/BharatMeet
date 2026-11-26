export const OPEN_REMINDER_EVENT = "bharatmeet:open-reminder";

export type OpenReminderDetail = {
  title?: string;
  link?: string;
};

export function openReminder(detail: OpenReminderDetail) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<OpenReminderDetail>(OPEN_REMINDER_EVENT, { detail }),
  );
}
