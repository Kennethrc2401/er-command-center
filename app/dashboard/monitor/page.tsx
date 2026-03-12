"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Activity, Clock, AlertTriangle, User, Siren } from "lucide-react";
import { useEffect, useState } from "react";
import { usePrivacyMode } from "@/lib/hooks/usePrivacyMode";
import { useSurgeAlert } from "@/lib/hooks/useSurgeAlert";

export default function MonitorPage() {
  const activeEncounters = useQuery(api.encounters.getActive);
  const { isPrivate } = usePrivacyMode();
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const totalBeds = 20;
  const occupiedBeds = activeEncounters?.filter((e) => e.location && e.location.startsWith("Bed")).length ?? 0;
  const capacityPercentage = (occupiedBeds / totalBeds) * 100;
  // 🔊 Active the Surge Listener
  useSurgeAlert(capacityPercentage);

  // Trigger diversion state at 90% census load.
  const isAtCriticalCapacity = capacityPercentage >= 90;

  const esi1Count = activeEncounters?.filter((e) => e.acuity === 1).length ?? 0;
  const esi2Count = activeEncounters?.filter((e) => e.acuity === 2).length ?? 0;

  // Keep wait timers and header clock in sync without re-rendering every second.
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-900 selection:bg-blue-500/30 dark:bg-slate-950 dark:text-white sm:p-6 lg:p-10">
      <div className="mx-auto max-w-450">
        <header className="mb-10 border-b border-slate-300 pb-8 dark:border-slate-800 lg:mb-16 lg:pb-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500 sm:text-xs sm:tracking-[0.4em]">
                  Unit 4B Management Board
                </span>

                {capacityPercentage >= 90 && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-red-600 rounded-lg animate-pulse">
                    <Siren className="h-3 w-3 text-white" />
                    <span className="text-[8px] font-black text-white uppercase tracking-widest">
                      Unit Surge Active
                    </span>
                  </div>
                )}
              </div>

              <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white sm:text-5xl lg:text-6xl xl:text-7xl">
                Emergency <span className="text-blue-600">Census</span>
              </h1>

              <div className="flex flex-wrap gap-3 lg:gap-6">
                <div className="flex items-center gap-3 rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-2 sm:px-6 sm:py-3">
                  <div className="h-3 w-3 rounded-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.8)] animate-pulse sm:h-4 sm:w-4" />
                  <span className="text-base font-black uppercase tracking-wider text-red-500 sm:text-xl lg:text-2xl">
                    {esi1Count} Level 1
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-orange-900/50 bg-orange-950/30 px-4 py-2 sm:px-6 sm:py-3">
                  <div className="h-3 w-3 rounded-full bg-orange-500 sm:h-4 sm:w-4" />
                  <span className="text-base font-black uppercase tracking-wider text-orange-500 sm:text-xl lg:text-2xl">
                    {esi2Count} Level 2
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-2 dark:border-slate-800 dark:bg-slate-900 sm:px-6 sm:py-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 sm:text-xs">
                    Census Load:
                  </span>
                  <span className={`text-lg font-black sm:text-2xl ${isAtCriticalCapacity ? "text-red-500" : "text-blue-500"}`}>
                    {occupiedBeds} / {totalBeds} <span className="text-xs sm:text-sm">({Math.round(capacityPercentage)}%)</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="text-left lg:text-right">
              <p className="text-5xl font-black tabular-nums tracking-tighter sm:text-6xl lg:text-7xl">
                {new Date(currentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-500 sm:text-sm sm:tracking-[0.3em]">
                Telemetry Synced
              </p>
            </div>
          </div>
        </header>

        {isPrivate && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 shadow-sm dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Privacy Mode Active: Patient Identifiers Hidden
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-8">
          {Array.from({ length: totalBeds }).map((_, i) => {
            const bedId = `Bed ${i + 1}`;
            const occupant = activeEncounters?.find((e) => e.location === bedId);

            return (
              <Card
                key={bedId}
                className={`relative flex h-56 flex-col items-center justify-center rounded-3xl border-4 p-6 text-center transition-all duration-700 sm:h-64 sm:p-8 lg:h-72 ${
                  occupant
                    ? occupant.acuity === 1
                      ? "bg-red-950/40 border-red-600 shadow-[0_0_60px_rgba(220,38,38,0.25)]"
                      : "bg-slate-900 border-blue-600 shadow-2xl"
                    : "border-dashed border-slate-300 bg-transparent opacity-60 dark:border-slate-800 dark:opacity-40"
                }`}
              >
                <span className="absolute left-6 top-6 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-500 sm:left-8 sm:top-8 sm:tracking-[0.3em]">
                  {bedId}
                </span>

                {occupant ? (
                  <div className="flex w-full flex-col items-center gap-5 sm:gap-6">
                    <div
                      className={`w-full truncate px-2 text-3xl font-black uppercase tracking-tighter transition-all duration-300 sm:text-4xl ${
                        isPrivate ? "text-slate-500" : "text-slate-100"
                      }`}
                    >
                      {isPrivate ? "PRIVATE PATIENT" : occupant.patientName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      MRN: {isPrivate ? "HIDDEN" : occupant.mrn}
                    </div>

                    <div
                      className={`flex h-20 w-20 flex-col items-center justify-center rounded-2xl shadow-lg sm:h-24 sm:w-24 sm:rounded-[2rem] ${
                        occupant.acuity === 1 ? "bg-red-600 shadow-red-900/20" : "bg-blue-600 shadow-blue-900/20"
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase leading-none tracking-tight text-white/80">ESI</span>
                      <span className="text-4xl font-black leading-none text-white sm:text-5xl">{occupant.acuity}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 sm:text-xs">
                      <Clock className="h-4 w-4" />
                      {Math.floor((currentTime - occupant._creationTime) / 60000)}M Wait
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-800" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-700">Available</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <footer className="mt-10 flex flex-col gap-4 border-t border-slate-300 px-2 pt-8 dark:border-slate-900 sm:mt-14 lg:mt-20 lg:flex-row lg:items-center lg:justify-between lg:pt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-8 lg:gap-10">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500">
                ESI 1: Immediate Resuscitation Required
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-blue-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500">
                ESI 2-5: Routine Monitoring Active
              </span>
            </div>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
            <User className="h-4 w-4 text-slate-500 dark:text-slate-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Staff Secure View</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
