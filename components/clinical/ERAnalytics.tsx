"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BarChart3, TrendingUp, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import VolumeHeatmap from "@/components/clinical/VolumeHeatmap";

export default function ERAnalytics() {
  const stats = useQuery(api.encounters.getComplaintStats);
  const totalPatients = useQuery(api.encounters.getActive)?.length || 0;

  if (!stats) return null;

  const maxVal = Math.max(...stats.map(s => s.value));

  return (
    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl border border-white/5 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <BarChart3 className="h-32 w-32" />
      </div>

      <div className="relative z-10 space-y-8">
        <header className="flex justify-between items-end">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-400">
              <TrendingUp className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Real-time Volume</span>
            </div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">
              ER <span className="text-blue-500">Pulse</span>
            </h2>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black tracking-tighter leading-none">{totalPatients}</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total Active</p>
          </div>
        </header>

        <Tabs defaultValue="pulse" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-white/10 bg-white/5 p-1">
            <TabsTrigger value="pulse" className="rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400">
              ER Pulse
            </TabsTrigger>
            <TabsTrigger value="executive" className="rounded-xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400">
              Executive View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pulse" className="mt-5 space-y-5">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] border-b border-white/10 pb-2">
              Volume by Chief Complaint
            </h3>
            <div className="space-y-4">
              {stats.map((item) => (
                <div key={item.name} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold uppercase tracking-tight">{item.name}</span>
                    <span className="text-[10px] font-black text-blue-400">{item.value} Patients</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${(item.value / maxVal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="executive" className="mt-5 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Department Workflow Executive View
            </p>
            <VolumeHeatmap />
          </TabsContent>
        </Tabs>

        <div className="pt-4 border-t border-white/10 flex items-center gap-2 text-slate-500">
          <Users className="h-3 w-3" />
          <p className="text-[9px] font-medium uppercase tracking-widest">Data synchronized with 100 seeded records</p>
        </div>
      </div>
    </div>
  );
}