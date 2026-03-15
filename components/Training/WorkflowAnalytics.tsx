"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ClipboardList, TimerReset, TriangleAlert } from "lucide-react";

export default function WorkflowAnalytics() {
  const analytics = useQuery(api.workflow.getTrainingAnalytics);

  if (!analytics) return null;

  const cards = [
    { title: "Protocol Activations", value: analytics.activeProtocolCount, icon: ClipboardList, color: "text-blue-600" },
    { title: "Urgent Kiosk Arrivals", value: analytics.urgentKioskCount, icon: TriangleAlert, color: "text-red-600" },
    { title: "Kiosk To Ack", value: analytics.avgKioskAckMinutes === null ? "N/A" : `${analytics.avgKioskAckMinutes}m`, icon: TimerReset, color: "text-emerald-600" },
    { title: "Active ED Encounters", value: analytics.activeEncounterCount, icon: Activity, color: "text-violet-600" },
  ];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {card.title}
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {analytics.mostUsedProtocols.length > 0 && (
        <Card className="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Most Used Protocol Bundles</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {analytics.mostUsedProtocols.map((protocol) => (
              <div key={protocol.title} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{protocol.title}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{protocol.count} activations</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
