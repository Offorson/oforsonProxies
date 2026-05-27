"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleDollarSign,
  Info,
  Loader2,
} from "lucide-react";
import { cn } from "@/utils/cn";

type NotifType = "info" | "success" | "warning" | "error";

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  type: NotifType;
  created_at: string;
}

interface PlanSummary {
  plan: string;
  status: string;
  bandwidth_used_gb: number;
  bandwidth_gb: number;
  current_period_end: string;
}

const POLL_MS = 30_000;

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nRes, dRes] = await Promise.all([
        fetch("/api/notifications", { cache: "no-store" }),
        fetch("/api/dashboard", { cache: "no-store" }),
      ]);
      const nJson = await nRes.json();
      const dJson = await dRes.json();
      if (nRes.ok) {
        setNotifications(nJson.notifications ?? []);
        setUnread(nJson.unread ?? 0);
      }
      if (dRes.ok && dJson.subscription) {
        setPlan({
          plan: dJson.subscription.plan,
          status: dJson.subscription.status,
          bandwidth_used_gb: Number(dJson.subscription.bandwidth_used_gb ?? 0),
          bandwidth_gb: Number(dJson.subscription.bandwidth_gb ?? 0),
          current_period_end: dJson.subscription.current_period_end,
        });
      } else {
        setPlan(null);
      }
    } catch (err) {
      // Offline, network failure, or a non-JSON response. Degrade
      // quietly without this catch the rejection bubbles out of the
      // polling effect as an unhandled error and crashes the page.
      console.warn("[notifications] failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Reload when opened
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Close when the user clicks/taps anywhere outside the dropdown, or
  // presses Escape. A document-level listener is used instead of a
  // full-screen backdrop element so it can't be defeated by z-index /
  // stacking-context quirks in the surrounding chrome.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const markAllRead = useCallback(async () => {
    if (unread === 0) return;
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    setUnread(0);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch (err) {
      console.warn("[notifications] mark-all-read failed:", err);
    }
  }, [unread]);

  const markOneRead = useCallback(async (id: string) => {
    setNotifications((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch (err) {
      console.warn("[notifications] mark-read failed:", err);
    }
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative rounded-lg p-2 text-ink-600 hover:bg-ink-100 transition"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute right-0 z-40 mt-2 w-96 rounded-2xl border border-ink-200 bg-white shadow-soft"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-ink-100 p-4">
                <div>
                  <p className="text-sm font-semibold text-ink-900">Notifications</p>
                  <p className="text-xs text-ink-500">
                    {unread > 0 ? `${unread} unread` : "All caught up"}
                  </p>
                </div>
                <button
                  onClick={markAllRead}
                  disabled={unread === 0}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-40"
                >
                  Mark all read
                </button>
              </div>

              {/* Plan summary card */}
              {plan && <PlanCard plan={plan} />}

              {/* Notification list */}
              <ul className="max-h-80 overflow-y-auto">
                {loading && notifications.length === 0 && (
                  <li className="flex items-center justify-center gap-2 p-6 text-sm text-ink-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </li>
                )}
                {!loading && notifications.length === 0 && (
                  <li className="p-6 text-center text-sm text-ink-500">
                    No notifications yet. Plan changes and bandwidth alerts will show up here.
                  </li>
                )}
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => !n.read && markOneRead(n.id)}
                    className={cn(
                      "flex cursor-pointer gap-3 border-b border-ink-100 p-4 transition last:border-0 hover:bg-ink-50",
                      !n.read && "bg-brand-50/40"
                    )}
                  >
                    <NotifIcon type={n.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900">{n.title}</p>
                      <p className="mt-0.5 text-xs text-ink-600 line-clamp-2">{n.body}</p>
                      <p className="mt-1 text-[11px] text-ink-400">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  </li>
                ))}
              </ul>

              <div className="border-t border-ink-100 p-3 text-center">
                <a href="/dashboard/billing" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                  View billing & invoices →
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------

function PlanCard({ plan }: { plan: PlanSummary }) {
  const pct = plan.bandwidth_gb > 0 ? (plan.bandwidth_used_gb / plan.bandwidth_gb) * 100 : 0;
  const over = pct > 100;
  const warn = pct >= 80 && !over;
  const renews = plan.current_period_end
    ? new Date(plan.current_period_end).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "-";

  return (
    <div className="border-b border-ink-100 bg-gradient-to-br from-brand-50/60 to-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-brand-600" />
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Current plan</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
            plan.status === "active" && "bg-emerald-100 text-emerald-700",
            plan.status === "trialing" && "bg-sky-100 text-sky-700",
            plan.status === "past_due" && "bg-amber-100 text-amber-700",
            (plan.status === "canceled" || plan.status === "expired") && "bg-rose-100 text-rose-700"
          )}
        >
          {plan.status}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold capitalize text-ink-900">{plan.plan} plan</p>
      <p className="text-xs text-ink-500">Renews {renews}</p>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-ink-600">Bandwidth</span>
          <span className={cn("font-medium", over ? "text-rose-600" : warn ? "text-amber-700" : "text-ink-900")}>
            {plan.bandwidth_used_gb.toFixed(1)} / {plan.bandwidth_gb} GB
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              over ? "bg-rose-500" : warn ? "bg-amber-500" : "bg-gradient-to-r from-brand-500 to-blue-600"
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function NotifIcon({ type }: { type: NotifType }) {
  const map = {
    info: { Icon: Info, className: "text-sky-500 bg-sky-50" },
    success: { Icon: CheckCircle2, className: "text-emerald-500 bg-emerald-50" },
    warning: { Icon: AlertTriangle, className: "text-amber-500 bg-amber-50" },
    error: { Icon: AlertTriangle, className: "text-rose-500 bg-rose-50" },
  } as const;
  const entry = map[type] ?? map.info;
  const Icon = entry.Icon;
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        entry.className
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
