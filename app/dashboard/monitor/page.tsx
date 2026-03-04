"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Activity, Clock, AlertTriangle, User } from "lucide-react";
import { useEffect, useState } from "react";

export default function MonitorPage() {
  const activeEncounters = useQuery(api.encounters.getActive);
  const [currentTime, setCurrentTime] = useState(0);
  const totalBeds = 20;
  const occupiedBeds = activeEncounters?.filter(e => e.location && e.location.startsWith("Bed")).length ?? 0;
  const capacityPercentage = (occupiedBeds / totalBeds) * 100;
  
  // DIVERSION LOGIC: Trigger at 90% (18+ beds)
  const isAtCriticalCapacity = capacityPercentage >= 90;

  // Sync clock for wait times
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Census Stats
  const esi1Count = activeEncounters?.filter(e => e.acuity === 1).length ?? 0;
  const esi2Count = activeEncounters?.filter(e => e.acuity === 2).length ?? 0;

  return (
    <div className="min-h-screen bg-slate-950 p-10 text-white font-sans selection:bg-blue-500/30">
      {/* 1. MONITOR HEADER (Designed for TV) */}
      <header className="flex justify-between items-end mb-16 border-b border-slate-800 pb-10">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-[0.4em] text-slate-500">Unit 4B Management Board</span>
          </div>
          <h1 className="text-6xl font-black tracking-tighter uppercase italic text-white">
            Emergency <span className="text-blue-600">Census</span>
          </h1>
          <div className="flex gap-8">
            <div className="flex items-center gap-4 bg-red-950/30 border border-red-900/50 px-6 py-3 rounded-2xl">
              <div className="h-4 w-4 bg-red-600 rounded-full animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.8)]" />
              <span className="text-2xl font-black uppercase tracking-widest text-red-500">{esi1Count} Level 1</span>
            </div>
            <div className="flex items-center gap-4 bg-orange-950/30 border border-orange-900/50 px-6 py-3 rounded-2xl">
              <div className="h-4 w-4 bg-orange-500 rounded-full" />
              <span className="text-2xl font-black uppercase tracking-widest text-orange-500">{esi2Count} Level 2</span>
            </div>
            <div className="mt-4 flex items-center gap-4 bg-slate-900 border border-slate-800 px-6 py-2 rounded-2xl">
             <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Census Load:</span>
             <span className={`text-2xl font-black ${isAtCriticalCapacity ? 'text-red-500' : 'text-blue-500'}`}>
               {occupiedBeds} / {totalBeds} <span className="text-sm">({Math.round(capacityPercentage)}%)</span>
             </span>
          </div>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-7xl font-black tabular-nums tracking-tighter">
            {new Date(currentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-slate-500 font-black uppercase tracking-[0.3em] mt-2 text-sm">
            Telemetry Synced
          </p>
        </div>
      </header>

      {/* 2. BED GRID (5x4 Matrix) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
        {Array.from({ length: totalBeds }).map((_, i) => {
          const bedId = `Bed ${i + 1}`;
          const occupant = activeEncounters?.find(e => e.location === bedId);

          return (
            <Card key={bedId} className={`relative h-72 rounded-[3rem] flex flex-col items-center justify-center p-8 border-4 transition-all duration-700 ${
              occupant 
                ? (occupant.acuity === 1 
                    ? "bg-red-950/40 border-red-600 shadow-[0_0_60px_rgba(220,38,38,0.25)] animate-in zoom-in-95" 
                    : "bg-slate-900 border-blue-600 shadow-2xl")
                : "bg-transparent border-dashed border-slate-800 opacity-30"
            }`}>
              {/* Bed Label */}
              <span className="absolute top-8 left-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                {bedId}
              </span>

              {occupant ? (
                <div className="flex flex-col items-center gap-6 text-center w-full">
                  <div className="text-4xl font-black tracking-tighter uppercase truncate w-full px-2 text-white">
                    {occupant.patientName.split(' ')[0]}
                  </div>
                  
                  {/* ESI Indicator Badge */}
                  <div className={`w-24 h-24 rounded-[2rem] flex flex-col items-center justify-center shadow-lg ${
                    occupant.acuity === 1 ? 'bg-red-600 shadow-red-900/20' : 'bg-blue-600 shadow-blue-900/20'
                  }`}>
                    <span className="text-[10px] font-black uppercase tracking-tighter leading-none text-white/80">ESI</span>
                    <span className="text-5xl font-black leading-none text-white">{occupant.acuity}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-widest">
                    <Clock className="h-4 w-4" /> 
                    {Math.floor((currentTime - occupant._creationTime) / 60000)}M Wait
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-slate-800" />
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Available</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* 3. LEGEND / SYSTEM FOOTER */}
      <footer className="mt-20 flex justify-between items-center border-t border-slate-900 pt-10 px-4">
        <div className="flex gap-10">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">ESI 1: Immediate Resuscitation Required</span>
          </div>
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-500" />
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">ESI 2-5: Routine Monitoring Active</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
           <User className="h-4 w-4 text-slate-500" />
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Staff Secure View</span>
        </div>
      </footer>
    </div>
  );
}