"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Badge 
} from "@/components/ui/badge";
import { 
  Users, 
  Clock, 
  ArrowRightCircle 
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function TrackingBoard() {
  // 1. Fetch all active encounters (those not yet discharged)
  const activeEncounters = useQuery(api.encounters.getActive);

  if (!activeEncounters) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-pulse text-slate-400 font-black tracking-widest uppercase text-xs">
          Loading Live Tracking Data...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-600" />
          ED TRACKING BOARD
        </h2>
        <Badge variant="outline" className="font-mono text-[10px] border-blue-200 text-blue-700 bg-blue-50">
          LIVE UPDATES ENABLED
        </Badge>
      </div>

      <Card className="border-slate-900 border-t-8 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Room/Bed</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Patient Name</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">ESI</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Wait Time</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeEncounters.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                    All beds clear. Department is currently at zero census.
                  </td>
                </tr>
              ) : (
                activeEncounters.map((encounter) => (
                  <tr key={encounter._id} className="hover:bg-slate-50/50 transition-colors group">
                    {/* ROOM NUMBER */}
                    <td className="px-6 py-4">
                      <span className="font-black text-lg text-slate-800 tracking-tighter">
                        {encounter.location || "Triage"}
                      </span>
                    </td>

                    {/* PATIENT INFO */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{encounter.patientName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">CC: {encounter.chiefComplaint}</span>
                      </div>
                    </td>

                    {/* ESI ACUITY */}
                    <td className="px-6 py-4">
                      <div className={`
                        inline-flex items-center justify-center h-8 w-8 rounded-full font-black text-sm
                        ${encounter.acuity === 1 ? "bg-red-600 text-white shadow-lg shadow-red-100" : 
                          encounter.acuity === 2 ? "bg-orange-500 text-white" :
                          encounter.acuity === 3 ? "bg-yellow-400 text-slate-900" :
                          "bg-blue-100 text-blue-700"}
                      `}>
                        {encounter.acuity}
                      </div>
                    </td>

                    {/* STATUS BADGE */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <StatusBadge status={encounter.status} />
                        <FlowStageBadge
                          flowStage={encounter.flowStage}
                          delayReason={encounter.delayReason}
                        />
                      </div>
                    </td>

                    {/* WAIT TIME */}
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                      <WaitTimer startTime={encounter._creationTime} />
                    </td>

                    {/* ACTION */}
                    <td className="px-6 py-4 text-right">
                      <Link href={`/patient/${encounter.patientId}`}>
                        <button className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all group-hover:translate-x-1">
                          <ArrowRightCircle className="h-5 w-5" />
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper: Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    waiting: "bg-slate-100 text-slate-600 border-slate-200",
    triage: "bg-blue-100 text-blue-700 border-blue-200",
    "seen-by-doctor": "bg-purple-100 text-purple-700 border-purple-200",
    "labs-pending": "bg-yellow-100 text-yellow-700 border-yellow-200",
    "ready-for-discharge": "bg-emerald-100 text-emerald-700 border-emerald-200 animate-pulse",
  };

  return (
    <Badge variant="outline" className={`capitalize font-black text-[9px] tracking-widest ${styles[status] || styles.waiting}`}>
      {status.replace(/-/g, " ")}
    </Badge>
  );
}

function FlowStageBadge({ flowStage, delayReason }: { flowStage?: string; delayReason?: string | null }) {
  const stage = flowStage || "unspecified";
  const styles: Record<string, string> = {
    triage: "bg-blue-50 text-blue-700 border-blue-200",
    awaiting_bed: "bg-amber-50 text-amber-700 border-amber-200",
    bedded: "bg-emerald-50 text-emerald-700 border-emerald-200",
    provider_assigned: "bg-cyan-50 text-cyan-700 border-cyan-200",
    workup_pending: "bg-violet-50 text-violet-700 border-violet-200",
    consult_pending: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    discharge_ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
    admit_ready: "bg-sky-50 text-sky-700 border-sky-200",
    boarded: "bg-rose-50 text-rose-700 border-rose-200",
    unspecified: "bg-slate-50 text-slate-500 border-slate-200",
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant="outline"
        className={`capitalize font-black text-[9px] tracking-widest ${styles[stage] || styles.unspecified}`}
      >
        {(flowStage || "flow stage").replace(/_/g, " ")}
      </Badge>
      {delayReason && delayReason !== "none" ? (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-slate-500">
          Hold: {delayReason.replace(/_/g, " ")}
        </span>
      ) : null}
    </div>
  );
}

// Helper: Real-time Wait Timer
function WaitTimer({ startTime }: { startTime: number }) {
  const [mins, setMins] = useState<number>(() => Math.floor((Date.now() - startTime) / 60000));

  useEffect(() => {
    const timer = setInterval(() => {
      setMins(Math.floor((Date.now() - startTime) / 60000));
    }, 60000); 

    return () => clearInterval(timer);
  }, [startTime]);

  return (
    <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-500">
      <Clock className="h-3 w-3 text-slate-300" />
      {mins}m
    </div>
  );
}