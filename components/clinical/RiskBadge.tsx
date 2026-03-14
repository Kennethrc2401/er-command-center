"use client";

import { AlertCircle } from "lucide-react";
import { calculateNEWS2 } from "@/lib/helpers/news2";

type RiskBadgeProps = {
  vitals: Parameters<typeof calculateNEWS2>[0];
};

export default function RiskBadge({ vitals }: RiskBadgeProps) {
  const { score, level, color } = calculateNEWS2(vitals);

  return (
    <div className={`flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all ${
      score >= 5 ? "bg-red-50 border-red-200 animate-pulse" : "bg-slate-50 border-slate-100"
    }`}>
      <span className={`text-[9px] font-black uppercase tracking-widest ${color}`}>
        NEWS2 Score
      </span>
      <div className="flex items-center gap-2">
        <span className={`text-2xl font-black italic tracking-tighter ${color}`}>
          {score}
        </span>
        {score >= 5 && <AlertCircle className="h-4 w-4 text-red-600 fill-red-500/20" />}
      </div>
      <p className={`text-[8px] font-bold uppercase tracking-tight ${color} opacity-70`}>
        {level} RISK
      </p>
    </div>
  );
}