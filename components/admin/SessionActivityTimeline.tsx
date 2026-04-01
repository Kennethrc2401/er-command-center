"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CheckCircle2, Fingerprint, LogIn, LogOut, ShieldCheck, UserCog } from "lucide-react";

const actionMeta: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  STAFF_LOGIN_SUCCESS: {
    label: "Staff Login",
    icon: LogIn,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  STAFF_LOGOUT: {
    label: "Staff Logout",
    icon: LogOut,
    tone: "border-slate-200 bg-slate-50 text-slate-600",
  },
  PASSKEY_REGISTERED: {
    label: "Passkey Enrolled",
    icon: Fingerprint,
    tone: "border-blue-200 bg-blue-50 text-blue-700",
  },
  PASSKEY_LOGIN_SUCCESS: {
    label: "Passkey Login",
    icon: CheckCircle2,
    tone: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  PASSKEY_RENAMED: {
    label: "Passkey Renamed",
    icon: UserCog,
    tone: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  PASSKEY_REVOKED: {
    label: "Passkey Revoked",
    icon: ShieldCheck,
    tone: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return {
    time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    date: date.toLocaleDateString(),
  };
};

export default function SessionActivityTimeline() {
  const events = useQuery(api.audit.getSessionActivity, { limit: 40 });
  type EventRows = NonNullable<typeof events>;

  const grouped = useMemo(() => {
    if (!events) return [] as Array<{ day: string; rows: EventRows }>;

    const map = new Map<string, EventRows>();
    for (const row of events) {
      const day = new Date(row.timestamp).toDateString();
      const existing = map.get(day) ?? [];
      existing.push(row);
      map.set(day, existing);
    }

    return Array.from(map.entries()).map(([day, rows]) => ({ day, rows }));
  }, [events]);

  return (
    <section className="overflow-hidden rounded-[2.5rem] border border-emerald-100 bg-white shadow-sm">
      <header className="flex items-center gap-3 border-b border-emerald-50 bg-emerald-50/40 p-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-100 p-2">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">Session Activity Timeline</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">Login · Logout · Passkeys</p>
        </div>
      </header>

      <div className="space-y-6 p-6">
        {!events && <p className="text-xs font-semibold text-slate-400">Loading session activity...</p>}

        {events && events.length === 0 && (
          <p className="text-xs font-semibold text-slate-500">No recent session activity recorded yet.</p>
        )}

        {grouped.map((group) => (
          <div key={group.day} className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{group.day}</p>

            <div className="space-y-2">
              {(group.rows ?? []).map((event) => {
                const meta = actionMeta[event.action] ?? {
                  label: event.action,
                  icon: ShieldCheck,
                  tone: "border-slate-200 bg-slate-50 text-slate-700",
                };
                const Icon = meta.icon;
                const ts = formatTimestamp(event.timestamp);

                return (
                  <div
                    key={event._id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/40 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`rounded-xl border p-2 ${meta.tone}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-800">{meta.label}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {event.userName} · {event.metadata || "No metadata"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] font-black text-slate-700">{ts.time}</p>
                      <p className="text-[10px] text-slate-400">{ts.date}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
