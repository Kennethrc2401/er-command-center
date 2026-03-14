"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { calculateVolumeHeatmap } from "@/lib/helpers/analyticsLogic";
import { Flame } from "lucide-react";

export default function VolumeHeatmap() {
  const encounters = useQuery(api.encounters.getActive);
  
  if (!encounters) return <div className="h-32 w-full bg-slate-100 animate-pulse rounded-[2rem]" />;

  const data = calculateVolumeHeatmap(encounters);

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-6">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">24-Hour Volume Heatmap</span>
        </div>
        <span className="text-[9px] font-bold text-slate-300 uppercase">Live Metrics</span>
      </header>

      <div className="flex items-end justify-between gap-1 h-24">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
            {/* The Heat Bar */}
            <div 
              className="w-full rounded-t-full transition-all duration-500 relative"
              style={{ 
                height: `${d.intensity * 100}%`,
                backgroundColor: d.intensity > 0.8 ? '#ef4444' : d.intensity > 0.5 ? '#f97316' : '#3b82f6',
                opacity: d.intensity > 0 ? 0.3 + (d.intensity * 0.7) : 0.1
              }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 text-white text-[8px] font-black py-1 px-2 rounded whitespace-nowrap z-10">
                {d.count} Arrivals @ {d.hour}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-[8px] font-black uppercase text-slate-300 tracking-tighter pt-2 border-t border-slate-50">
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>11 PM</span>
      </div>
    </div>
  );
}