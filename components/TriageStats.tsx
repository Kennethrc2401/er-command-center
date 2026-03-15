"use client";

import { AlertTriangle } from "lucide-react";

interface TriageStatsProps {
  level1: number;
  level2: number;
  level3: number;
  availableBeds: number;
  totalBeds: number;
}

export default function TriageStats({ level1, level2, level3, availableBeds, totalBeds }: TriageStatsProps) {
  const isOverloaded = availableBeds <= 0;
  const occupancyRate = Math.min(100, Math.round(((totalBeds - availableBeds) / totalBeds) * 100));

  return (
    <div className="space-y-4 mb-8">
      {/* Surge Alert Banner */}
      {isOverloaded && (
        <div className="bg-red-600 text-white px-4 py-3 rounded-xl flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="h-4 w-4" />
            CRITICAL OVERLOAD: SURGE PROTOCOL ACTIVE
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* ESI 1 */}
        <div className="bg-red-600 p-4 rounded-xl text-white shadow-lg">
          <p className="text-xs font-bold uppercase opacity-80">ESI 1</p>
          <h2 className="text-4xl font-black mt-2">{level1}</h2>
        </div>

        {/* ESI 2 */}
        <div className="bg-orange-500 p-4 rounded-xl text-white shadow-lg">
          <p className="text-xs font-bold uppercase opacity-80">ESI 2</p>
          <h2 className="text-4xl font-black mt-2">{level2}</h2>
        </div>

        {/* ESI 3 */}
        <div className="bg-yellow-400 p-4 rounded-xl text-slate-900 shadow-lg">
          <p className="text-xs font-bold uppercase opacity-70">ESI 3</p>
          <h2 className="text-4xl font-black mt-2">{level3}</h2>
        </div>

        {/* Dynamic Bed Card */}
        <div className={`rounded-xl border-2 p-4 shadow-lg transition-colors ${
          isOverloaded
            ? "border-red-500 bg-red-50 dark:bg-red-950/30"
            : "border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900"
        }`}>
          <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-400">Available Beds</p>
          <h2 className={`mt-2 text-4xl font-black ${isOverloaded ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"}`}>
            {availableBeds < 0 ? 0 : availableBeds}
          </h2>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div 
              className={`h-full transition-all duration-500 ${isOverloaded ? "bg-red-500" : "bg-blue-600 dark:bg-blue-500"}`}
              style={{ width: `${occupancyRate}%` }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}