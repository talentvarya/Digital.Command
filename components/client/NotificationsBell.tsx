"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { markAllNotificationsReadAction } from "@/app/app/notifications/actions";
import type { Notification } from "@/types/database";

export function NotificationsBell({ notifications }: { notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-ink-100 bg-white p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-semibold text-ink-900">Notifications</span>
            {unreadCount > 0 && (
              <ActionForm action={markAllNotificationsReadAction}>
                {() => <SubmitButton className="text-xs text-brand-600 hover:underline" pendingLabel="…">Mark all read</SubmitButton>}
              </ActionForm>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && <p className="px-2 py-4 text-center text-sm text-ink-400">No notifications yet.</p>}
            {notifications.map((n) => (
              <div key={n.id} className={`rounded-lg px-2 py-2 text-sm ${n.read ? "text-ink-500" : "bg-brand-50 text-ink-900"}`}>
                <div className="font-medium">{n.title}</div>
                {n.body && <div className="text-xs text-ink-500">{n.body}</div>}
                <div className="text-[11px] text-ink-400">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
