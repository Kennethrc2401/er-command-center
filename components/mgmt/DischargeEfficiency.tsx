"use client";

import { Timer, Zap, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DischargeEfficiency() {
  // Simulated data for turnaround times (in minutes)
  const metrics = [
    { label: "Physician Discharge -> Bed Empty", time: 14, target: 15, status: "optimal" },
    { label: "Bed Empty -> EVS Clean Complete", time: 32, target: 25, status: "delayed" },
    { label: "Clean Complete -> New Patient In", time: 8, target: 10, status: "optimal" },
  ];

  return (
    <Card className="border-slate-200 shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 p-6 px-8 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Timer className="h-4 w-4 text-blue-400" />
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400 italic">
            Throughput Efficiency (Unit 4B)
          </CardTitle>
        </div>
        <Badge className="bg-blue-500 text-[8px] font-black uppercase">Live Benchmarking</Badge>
      </CardHeader>
      
      <CardContent className="p-8">
        <div className="space-y-8">
          {/* VISUAL THROUGHPUT TIMELINE */}
          <div className="relative flex justify-between items-center px-4">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
            
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className={`z-10 h-4 w-4 rounded-full border-2 border-white shadow-sm ${step === 4 ? 'bg-slate-200' : 'bg-blue-500'}`} />
            ))}
          </div>

          {/* DETAILED METRICS */}
          <div className="grid grid-cols-1 gap-4">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50 group hover:border-blue-200 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-xl ${m.status === 'optimal' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {m.status === 'optimal' ? <Zap className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-700 italic tracking-tight">{m.label}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Target: {m.target} min</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-black italic tracking-tighter ${m.status === 'optimal' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {m.time}m
                  </p>
                  {m.status === 'delayed' && (
                    <div className="flex items-center gap-1 text-[8px] font-black text-amber-500 uppercase">
                      <AlertTriangle className="h-2 w-2" /> +{m.time - m.target}m Over
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100">
           <div className="flex justify-between items-center bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <div>
                <p className="text-[9px] font-black text-blue-800 uppercase italic">Overall Bed Turnaround (Average)</p>
                <p className="text-2xl font-black text-blue-900 tracking-tighter italic">54 Minutes</p>
              </div>
              <div className="text-right">
                <Badge className="bg-blue-600 text-white border-none text-[8px] font-black uppercase tracking-widest px-3 py-1">Top 10% in Region</Badge>
              </div>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}