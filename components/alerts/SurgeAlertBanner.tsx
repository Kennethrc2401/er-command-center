"use client";

import { AlertTriangle, Info, CheckCircle, Zap } from "lucide-react";

interface Stats {
  availableBeds: number;
  boardingPatients: number;
  highAcuity: number;
}

export default function SurgeAlertBanner({ stats }: { stats: Stats | null }) {
  if (!stats) return null;

  const isCritical = stats.availableBeds <= 2;
  const isBoarding = stats.boardingPatients > 0;
  const isOptimal = stats.availableBeds >= 10 && stats.highAcuity === 0;

  if (isCritical) {
    return (
      <div className="w-full bg-red-600 text-white p-4 rounded-[2rem] shadow-xl shadow-red-200 animate-pulse flex items-center justify-between px-8 border-4 border-red-500">
        <div className="flex items-center gap-4">
          <AlertTriangle className="h-6 w-6" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em]">Status: Critical Overload</p>
            <p className="text-[10px] font-bold opacity-90 uppercase">Initiate Surge Protocol 1: Notify Charge Nurse & EMS Diversion</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black italic tracking-tighter">{stats.availableBeds} BEDS LEFT</p>
        </div>
      </div>
    );
  }

  if (isBoarding) {
    return (
      <div className="w-full bg-amber-500 text-white p-4 rounded-[2rem] shadow-lg shadow-amber-100 flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <Info className="h-6 w-6" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em]">Status: Unit Boarding</p>
            <p className="text-[10px] font-bold opacity-90 uppercase">Warning: {stats.boardingPatients} patients awaiting physical treatment bays.</p>
          </div>
        </div>
        <Zap className="h-5 w-5 animate-bounce" />
      </div>
    );
  }

  if (isOptimal) {
    return (
      <div className="w-full bg-emerald-50 text-emerald-700 p-4 rounded-[2rem] border border-emerald-100 flex items-center gap-4 px-8">
        <CheckCircle className="h-5 w-5 text-emerald-500" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Status: Optimal Operations | Capacity High</p>
      </div>
    );
  }

  return null;
}