"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NotificationItem {
  id: string;
  title: string;
  content: string;
  link: string;
  read: boolean;
  createdAt: Date | string;
}

interface NotificationsPanelProps {
  initialNotifications: NotificationItem[];
}

const formatTime = (timestamp: Date | string) => {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export const NotificationsPanel = ({
  initialNotifications,
}: NotificationsPanelProps) => {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isLoading, setIsLoading] = useState(false);

  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    let active = true;

    const refreshNotifications = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/notifications", { cache: "no-store" });

        if (!response.ok || !active) {
          return;
        }

        const nextNotifications = await response.json();
        setNotifications(nextNotifications);
      } catch (error) {
        console.log("[NOTIFICATIONS_REFRESH]", error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    refreshNotifications();
    const interval = window.setInterval(refreshNotifications, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markAllAsRead: true }),
      });

      if (!response.ok) {
        return;
      }

      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    } catch (error) {
      console.log("[NOTIFICATIONS]", error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId }),
      });

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, read: true } : item,
        ),
      );
    } catch (error) {
      console.log("[NOTIFICATION_READ]", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-10 w-10 border border-white/5 bg-surface text-zinc-300 hover:bg-surface-hover hover:text-white"
        >
          <Bell className="h-[1.1rem] w-[1.1rem]" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 border border-white/5 bg-surface p-0 text-zinc-200">
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
          <p className="text-sm font-semibold text-white">
            Notifications{isLoading ? "..." : ""}
          </p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1 text-[11px] text-indigo-300 transition hover:text-indigo-200"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-zinc-400">
            No notifications yet.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem key={notification.id} asChild>
                <Link
                  href={notification.link}
                  onClick={() => markAsRead(notification.id)}
                  className={notification.read ? "block px-3 py-3 text-zinc-300 transition hover:bg-white/5" : "block bg-indigo-500/5 px-3 py-3 text-white transition hover:bg-indigo-500/10"}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-400">{notification.content}</p>
                    </div>
                    {!notification.read && (
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-400" />
                    )}
                  </div>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    {formatTime(notification.createdAt)}
                  </p>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
