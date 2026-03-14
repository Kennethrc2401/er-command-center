"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Bell, Zap, AlertTriangle, CheckCheck } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

/** Plays a two-tone alert via the Web Audio API — no external files needed. */
function playStatAlert() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    // Rising double-beep pattern (classic pager sound)
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.12);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.24);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.36);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);
  } catch {
    // AudioContext not available (SSR guard / browser restriction)
  }
}

export default function NotificationBell({ userId }: { userId?: Id<"users"> }) {
  const notifications = useQuery(api.notifications.getActive, { userId });
  const markRead = useMutation(api.notifications.markAsRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const prevCountRef = useRef(0);
  const initializedRef = useRef(false);

  const count = notifications?.length ?? 0;
  const hasStats = notifications?.some((n) => n.type === "STAT_ORDER") ?? false;

  const handleMarkAll = useCallback(() => {
    markAllRead({ userId }).catch(() => null);
  }, [markAllRead, userId]);

  // 🔔 Asynchronous listener: fires every time Convex pushes new notifications
  useEffect(() => {
    if (!initializedRef.current) {
      prevCountRef.current = count;
      initializedRef.current = true;
      return;
    }

    if (notifications && count > prevCountRef.current) {
      // Show a toast for every newly arrived notification
      const newOnes = notifications.slice(0, count - prevCountRef.current);
      newOnes.forEach((n) => {
        if (n.type === "STAT_ORDER") {
          // Critical result — play pager sound + high-priority toast
          playStatAlert();
          toast.error(n.title, {
            description: n.message,
            icon: <Zap className="h-4 w-4 text-amber-400" />,
            duration: 10000,
          });
        } else {
          toast(n.title, {
            description: n.message,
            icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
            duration: 6000,
          });
        }
      });
    }

    prevCountRef.current = count;
  }, [notifications, count]);

  return (
    <div className="relative group">
      {/* ─── Bell button ──────────────────────────────────────────── */}
      <button
        className={`p-3 rounded-2xl transition-all relative ${
          hasStats
            ? "bg-red-50 dark:bg-red-950/40 text-red-600 animate-pulse"
            : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200"
        }`}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {/* ─── Dropdown ─────────────────────────────────────────────── */}
      <div className="absolute right-0 top-full z-1000 w-80 pt-2 opacity-0 invisible pointer-events-none translate-y-1 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-focus-within:visible group-focus-within:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900">

          {/* Header row */}
          <div className="flex items-center justify-between px-2 mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clinical Alerts</p>
            {count > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-blue-500 hover:text-blue-700 transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {count === 0 && (
              <p className="p-8 text-center text-xs text-slate-400 font-medium italic">No pending alerts</p>
            )}
            {notifications?.map((n) => (
              <div
                key={n._id}
                className={`p-4 rounded-2xl flex items-start gap-4 ${
                  n.type === "STAT_ORDER"
                    ? "bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40"
                    : "bg-slate-50 dark:bg-white/5"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {n.type === "STAT_ORDER" ? (
                    <Zap className="h-4 w-4 text-amber-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {n.type === "STAT_ORDER" && (
                      <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-red-500 text-white rounded-full shrink-0">
                        STAT
                      </span>
                    )}
                    <p className="text-[11px] font-black uppercase text-slate-900 dark:text-white leading-tight truncate">
                      {n.title}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">{n.message}</p>
                  <button
                    onClick={() => markRead({ id: n._id })}
                    className="mt-2 text-[8px] font-black uppercase text-blue-500 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}