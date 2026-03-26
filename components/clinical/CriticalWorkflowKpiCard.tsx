"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { AlertTriangle, CheckCircle2, Clock3, Siren } from "lucide-react";

export default function CriticalWorkflowKpiCard({ encounterId }: { encounterId: Id<"encounters"> }) {
  const metrics = useQuery(api.labs.getCriticalWorkflowMetrics, { encounterId });
  const hasOverdue = (metrics?.overdueCount ?? 0) > 0;
  const medianAckMinutes = metrics?.medianAckMinutes;
  const medianAckAtRisk = typeof medianAckMinutes === "number" && medianAckMinutes > 10;
  const medianAckWarning = typeof medianAckMinutes === "number" && medianAckMinutes > 6 && medianAckMinutes <= 10;

  if (!metrics) {
    return (
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Loading critical workflow metrics...</p>
      </div>
    );
  }

  return (
    <div className={`rounded-[1.5rem] border bg-white p-4 shadow-sm dark:bg-slate-900 ${
      hasOverdue
        ? "border-red-300 ring-1 ring-red-200 dark:border-red-700"
        : "border-slate-200 dark:border-slate-800"
    }`}>
      <div className="mb-3 flex items-center gap-2">
        <Siren className={`h-4 w-4 ${hasOverdue ? "text-red-700" : "text-red-600"}`} />
        <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-200">Critical Workflow KPIs</h3>
        {hasOverdue && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-white">
            SLA Breach
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-rose-700">Open</p>
          <p className="text-lg font-black text-rose-800">{metrics.openCount}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-red-700">Overdue</p>
          <p className="flex items-center gap-1 text-lg font-black text-red-800">
            <AlertTriangle className="h-4 w-4" /> {metrics.overdueCount}
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-amber-700">Escalated</p>
          <p className="text-lg font-black text-amber-800">{metrics.escalatedCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-emerald-700">Resolved</p>
          <p className="flex items-center gap-1 text-lg font-black text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> {metrics.resolvedCount}
          </p>
        </div>
        <div
          className={`rounded-xl border p-2 ${
            medianAckAtRisk
              ? "border-red-100 bg-red-50"
              : medianAckWarning
                ? "border-amber-100 bg-amber-50"
                : "border-blue-100 bg-blue-50"
          }`}
        >
          <p
            className={`text-[9px] font-black uppercase tracking-wide ${
              medianAckAtRisk
                ? "text-red-700"
                : medianAckWarning
                  ? "text-amber-700"
                  : "text-blue-700"
            }`}
          >
            Median Ack
          </p>
          <p
            className={`flex items-center gap-1 text-lg font-black ${
              medianAckAtRisk
                ? "text-red-800"
                : medianAckWarning
                  ? "text-amber-800"
                  : "text-blue-800"
            }`}
          >
            <Clock3 className="h-4 w-4" />
            {metrics.medianAckMinutes === null ? "-" : `${metrics.medianAckMinutes}m`}
          </p>
        </div>
      </div>
    </div>
  );
}
