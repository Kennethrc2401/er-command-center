"use client";

import { PieChart, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PayerData {
  name: string;
  count: number;
  color: string;
}

export default function RevenuePayerMix({ payerData }: { payerData: PayerData[] }) {
  // Calculate total for percentages
  const totalVolume = payerData.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Card className="border-slate-200 shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
      <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 px-8 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <PieChart className="h-4 w-4 text-purple-600" />
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 italic">
            Market Share by Payer
          </CardTitle>
        </div>
        <Badge variant="outline" className="text-[8px] font-black border-slate-200 uppercase">
          Shift Analytics
        </Badge>
      </CardHeader>
      
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row items-center gap-12">
          
          {/* THE VISUAL CHART (CSS Radial) */}
          <div className="relative h-48 w-48 shrink-0">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              {payerData.map((payer, idx) => {
                // Logic to calculate offset for each slice
                const previousTotal = payerData.slice(0, idx).reduce((acc, curr) => acc + curr.count, 0);
                const offset = (previousTotal / totalVolume) * 100;
                const percentage = (payer.count / totalVolume) * 100;

                return (
                  <circle
                    key={payer.name}
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    className={`${payer.color.replace('bg-', 'stroke-')} transition-all duration-1000 ease-in-out`}
                    strokeWidth="3.5"
                    strokeDasharray={`${percentage} 100`}
                    strokeDashoffset={`-${offset}`}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-black text-slate-900 tracking-tighter italic">100%</p>
              <p className="text-[8px] font-black text-slate-400 uppercase">Capture</p>
            </div>
          </div>

          {/* THE LEGEND */}
          <div className="flex-1 w-full space-y-4">
            {payerData.map((payer) => (
              <div key={payer.name} className="group">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${payer.color}`} />
                    <span className="text-[10px] font-black uppercase text-slate-700 italic group-hover:text-blue-600 transition-colors">
                      {payer.name}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black text-slate-400">
                    {Math.round((payer.count / totalVolume) * 100)}%
                  </span>
                </div>
                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${payer.color} opacity-20`} 
                    style={{ width: '100%' }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM ANALYTIC */}
        <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
          <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5" />
          <p className="text-[9px] font-bold text-slate-500 leading-relaxed uppercase italic">
            Insight: <span className="text-slate-900">Commercial Payer Mix</span> is up 4% this week, indicating a decrease in uncompensated care burden for Unit 4B.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}