"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/cn";

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => api<Notification[]>("/notifications/"), refetchInterval: 60_000 });
  const unread = data?.filter((n) => !n.is_read).length ?? 0;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function markRead() {
    await api("/notifications/read-all", { method: "POST" });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded text-muted hover:bg-canvas hover:text-ink"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" aria-hidden />}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-[min(22rem,calc(100vw-2rem))] animate-fade-in rounded-md border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && <button type="button" onClick={markRead} className="text-sm font-semibold text-forest hover:underline">Mark all as read</button>}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {!data?.length && <li className="px-4 py-8 text-center text-sm text-muted">No notifications yet. Updates about your listings, claims and verification appear here.</li>}
            {data?.map((n) => (
              <li key={n.id} className={cn("px-4 py-3", !n.is_read && "bg-forest-50/50")}>
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{n.message}</p>
                <p className="mt-1 text-xs text-muted">{relativeTime(n.created_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
