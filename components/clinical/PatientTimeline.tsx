"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Activity, FileText, Clock } from "lucide-react";

export default function PatientTimeline({ encounterId, patientId }: { encounterId: Id<"encounters">; patientId: Id<"patients"> }) {
  const events = useQuery(api.encounters.getPatientTimeline, { encounterId, patientId });

  if (!events) return <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500 animate-pulse">Loading Clinical History...</div>;
  if (events.length === 0) {
    return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">No timeline events yet for this encounter.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="mb-6 flex items-center gap-2 px-1">
        <Clock className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Encounter Timeline</span>
      </div>

      <div className="relative ml-3 space-y-6 before:absolute before:inset-0 before:ml-1 before:-translate-x-px before:h-full before:w-0.5 before:bg-linear-to-b before:from-blue-500 before:via-slate-200 before:to-transparent">
        {events.map((event, idx) => (
          <div key={idx} className="group relative flex items-start gap-5">
            {/* The Node Dot */}
            <div className={`absolute left-0 mt-2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white transition-colors ${
              event.type === "VITALS" ? "bg-emerald-500" : "bg-blue-500"
            }`} />

            <div className="flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all group-hover:border-blue-200 sm:p-5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  {new Date(event.time ?? 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {event.type === "VITALS" ? (
                  <Activity className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                )}
              </div>
              <h4 className="text-xs font-black uppercase leading-tight text-slate-900 sm:text-[13px]">
                {event.title}
              </h4>
              <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-slate-600 sm:text-xs">
                {event.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}