"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ArrowUpRight, ArrowDownRight, Beaker, Minus } from "lucide-react";

interface LabHistoryItem {
  value: string;
  unit: string;
  _creationTime: number;
}

interface LabTrend {
  testName: string;
  history: LabHistoryItem[];
}

export default function LabTrends({ encounterId }: { encounterId: Id<"encounters"> }) {
  const trends = useQuery(api.labs.getLabTrends, { encounterId }) as LabTrend[] | undefined;

  if (!trends) return <div className="p-4 text-center text-[10px] font-black uppercase text-slate-400">Analyzing Trends...</div>;

  return (
    <div className="space-y-3">
      {trends.map((trend) => {
        const current = parseFloat(trend.history[0]?.value);
        const previous = trend.history[1] ? parseFloat(trend.history[1].value) : null;
        
        const isRising = previous !== null && current > previous;
        const isFalling = previous !== null && current < previous;

        return (
          <div key={trend.testName} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-blue-200 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl">
                <Beaker className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{trend.testName}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900">{trend.history[0].value}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">{trend.history[0].unit}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              {previous !== null ? (
                <>
                  <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                    isRising ? "bg-amber-50 text-amber-600" : isFalling ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"
                  }`}>
                    {isRising && <ArrowUpRight className="h-3 w-3" />}
                    {isFalling && <ArrowDownRight className="h-3 w-3" />}
                    {!isRising && !isFalling && <Minus className="h-3 w-3" />}
                    {isRising ? "Rising" : isFalling ? "Falling" : "Stable"}
                  </div>
                  <p className="text-[8px] font-bold text-slate-300 uppercase">Prev: {previous}</p>
                </>
              ) : (
                <span className="text-[8px] font-black text-slate-300 uppercase italic">Baseline</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}