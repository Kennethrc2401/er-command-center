"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BarChart3, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import RevenuePayerMix from "@/components/mgmt/RevenuePayerMix";

interface RevenueCardProps {
  title: string;
  value: string | number;
  trend: string;
  trendUp: boolean;
}

export default function RevenuePage() {
  const stats = useQuery(api.encounters.getERStats);

  // Simulated payer mix for the chart
  const payerMix = [
    { name: "Horizon BCBS", count: 42, color: "bg-blue-600" },
    { name: "United Healthcare", count: 25, color: "bg-emerald-600" },
    { name: "Medicare", count: 28, color: "bg-purple-600" },
    { name: "Self-Pay", count: 10, color: "bg-amber-500" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">Revenue <span className="text-blue-600">Analytics</span></h1>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Fiscal Year 2026 | Unit 4B Performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RevenueCard title="Net Collections" value={`$${stats?.dailyRevenue || 0}`} trend="+12.5%" trendUp={true} />
        <RevenueCard title="Avg. Reimbursement" value="$1,840" trend="-2.1%" trendUp={false} />
        <RevenueCard title="Clean Claim Rate" value="98.4%" trend="+0.5%" trendUp={true} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <RevenuePayerMix payerData={payerMix} />
        <Card className="rounded-[2.5rem] border-slate-200 bg-white p-8">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 italic">Shift Collection Velocity</h3>
          <div className="h-64 flex items-end gap-2 px-4">
            {[40, 70, 45, 90, 65, 80, 95].map((h, i) => (
              <div key={i} className="flex-1 bg-slate-100 rounded-t-lg relative group hover:bg-blue-100 transition-colors">
                <div className="absolute bottom-0 w-full bg-blue-600 rounded-t-lg transition-all duration-1000" style={{ height: `${h}%` }} />
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400 opacity-0 group-hover:opacity-100">0{i+1}:00</span>
              </div>
            ))}
          </div>
          <p className="text-center text-[9px] font-black text-slate-400 uppercase mt-4 tracking-widest">Hourly Cash Capture (Current Shift)</p>
        </Card>
      </div>
    </div>
  );
}

function RevenueCard({ title, value, trend, trendUp }: RevenueCardProps) {
  return (
    <Card className="p-6 rounded-[2rem] border-slate-200 bg-white shadow-sm">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <div className="flex items-baseline gap-3">
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic">{value}</h2>
        <div className={`flex items-center text-[10px] font-black ${trendUp ? 'text-emerald-500' : 'text-red-500'}`}>
          {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trend}
        </div>
      </div>
    </Card>
  );
}