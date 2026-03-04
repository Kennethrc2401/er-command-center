"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Activity, Beaker, Scan, Clock } from "lucide-react";

export default function PatientTimeline({ encounterId }: { encounterId: Id<"encounters"> }) {
  const events = useQuery(api.encounters.getTimeline, { encounterId });

  if (!events) return <div className="p-8 text-center text-slate-400">Loading Journey...</div>;

  const getIcon = (type: string) => {
    switch (type) {
      case "VITALS": return <Activity className="h-3 w-3 text-emerald-500" />;
      case "LABS": return <Beaker className="h-3 w-3 text-blue-500" />;
      case "IMAGING": return <Scan className="h-3 w-3 text-purple-500" />;
      default: return <Clock className="h-3 w-3 text-slate-400" />;
    }
  };

  return (
    <div className="relative space-y-8 before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent">
      {events.map((event, idx) => (
        <div key={idx} className="relative flex items-center justify-between md:justify-start">
          {/* Dot/Icon container */}
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-slate-100 shadow-sm z-10 shrink-0 md:order-1">
            {getIcon(event.type)}
          </div>
          
          {/* Content Card */}
          <div className="w-[calc(100%-3rem)] md:w-[60%] p-4 rounded-2xl bg-white border border-slate-100 shadow-sm ml-4 md:order-2 hover:border-blue-200 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                {event.type}
              </span>
              <time className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
            <p className="text-xs font-bold text-slate-700 leading-snug uppercase tracking-tight">
              {event.detail}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}