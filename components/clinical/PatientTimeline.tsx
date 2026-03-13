"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Activity, FileText, Clock } from "lucide-react";

export default function PatientTimeline({ encounterId, patientId }: { encounterId: Id<"encounters">; patientId: Id<"patients"> }) {
  const events = useQuery(api.encounters.getPatientTimeline, { encounterId, patientId });

  if (!events) return <div className="p-8 text-center text-slate-400 animate-pulse">Loading Clinical History...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 px-1 mb-8">
        <Clock className="h-3 w-3 text-blue-500" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Encounter Timeline</span>
      </div>

      <div className="relative ml-3 space-y-8 before:absolute before:inset-0 before:ml-1 before:-translate-x-px before:h-full before:w-0.5 before:bg-linear-to-b before:from-blue-500 before:via-slate-200 before:to-transparent">
        {events.map((event, idx) => (
          <div key={idx} className="relative flex items-start gap-6 group">
            {/* The Node Dot */}
            <div className={`absolute left-0 mt-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white transition-colors ${
              event.type === "VITALS" ? "bg-emerald-500" : "bg-blue-500"
            }`} />

            <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm group-hover:border-blue-200 transition-all">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">
                  {new Date(event.time ?? 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {event.type === "VITALS" ? (
                  <Activity className="h-3 w-3 text-emerald-400" />
                ) : (
                  <FileText className="h-3 w-3 text-blue-400" />
                )}
              </div>
              <h4 className="text-[11px] font-black uppercase text-slate-900 leading-tight">
                {event.title}
              </h4>
              <p className="text-[10px] font-medium text-slate-500 mt-1">
                {event.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}