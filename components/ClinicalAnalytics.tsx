"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Timer, Users, Activity } from "lucide-react";

export default function ClinicalAnalytics() {
  const metrics = useQuery(api.analytics.getUnitMetrics, {});

  if (!metrics) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* KPI: Door-to-Doc Time */}
      <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Timer className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Avg Wait Time</p>
            <h3 className="text-2xl font-black text-slate-900">{metrics.avgWaitMinutes}m</h3>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Critical Ratio */}
      <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center">
            <Activity className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">High Acuity (1&2)</p>
            <h3 className="text-2xl font-black text-slate-900">
              {metrics.acuityMix.level1 + metrics.acuityMix.level2} <span className="text-xs text-slate-400">Pts</span>
            </h3>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Census Volume */}
      <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center">
            <Users className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Census</p>
            <h3 className="text-2xl font-black text-slate-900">{metrics.totalCensus}</h3>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Unit Velocity */}
      <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 overflow-hidden">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-slate-800 flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Efficiency Score</p>
            <h3 className="text-2xl font-black text-white">94%</h3>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}