"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertTriangle, Zap, Activity } from "lucide-react";

export default function MorningReport() {
  const report = useQuery(api.clinical.getMorningReport);

  if (!report) return <div className="h-48 w-full bg-slate-100 rounded-[2.5rem] animate-pulse" />;

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-6">
      <header className="flex justify-between items-center border-b border-slate-50 pb-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Department SitRep
        </h3>
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      </header>

      <div className="grid grid-cols-2 gap-4">
        {/* STAT BACKLOG */}
        <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 space-y-2">
          <Zap className="h-4 w-4 text-amber-600 fill-amber-500" />
          <p className="text-2xl font-black text-amber-700 tracking-tighter">{report.statBacklog}</p>
          <p className="text-[9px] font-black uppercase text-amber-600/60 leading-none">STAT Backlog</p>
        </div>

        {/* CRITICAL ALERTS */}
        <div className={`p-6 rounded-3xl border space-y-2 transition-colors ${
          report.criticalAlerts > 0 ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"
        }`}>
          <AlertTriangle className={`h-4 w-4 ${report.criticalAlerts > 0 ? "text-red-600 fill-red-500" : "text-slate-300"}`} />
          <p className={`text-2xl font-black tracking-tighter ${report.criticalAlerts > 0 ? "text-red-700" : "text-slate-400"}`}>
            {report.criticalAlerts}
          </p>
          <p className="text-[9px] font-black uppercase text-slate-500 leading-none tracking-tight">Vitals Alerts</p>
        </div>

        {/* HIGH ACUITY */}
        <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-2 col-span-2">
          <div className="flex justify-between items-start">
            <Activity className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] font-black text-blue-400">{((report.highAcuityCount / report.totalCensus) * 100).toFixed(0)}%</span>
          </div>
          <p className="text-2xl font-black tracking-tighter">{report.highAcuityCount}</p>
          <p className="text-[9px] font-black uppercase text-slate-400 leading-none tracking-widest">High Acuity (ESI 1-2)</p>
          
          {/* Progress bar for acuity mix */}
          <div className="h-1 w-full bg-white/10 rounded-full mt-4 overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-1000" 
              style={{ width: `${(report.highAcuityCount / report.totalCensus) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}