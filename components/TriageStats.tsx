"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertCircle, Activity, Users, BedDouble, AlertTriangle } from "lucide-react";

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
        <div className={`p-4 rounded-xl border-2 ${isOverloaded ? "bg-red-50 border-red-500" : "bg-white border-slate-100"}`}>
          <p className="text-xs font-bold uppercase text-slate-400">Available Beds</p>
          <h2 className="text-4xl font-black mt-2">{availableBeds < 0 ? 0 : availableBeds}</h2>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-blue-600 h-full transition-all duration-500" 
              style={{ width: `${occupancyRate}%` }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}