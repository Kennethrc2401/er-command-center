"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BriefcaseMedical, Siren, UserRound } from "lucide-react";

export default function ProviderWorkloadPanel() {
  const providers = useQuery(api.workflow.getProviderWorkload);

  return (
    <Card className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70 pb-4 dark:border-slate-800 dark:bg-slate-950/40">
        <CardTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-200">
          <BriefcaseMedical className="h-4 w-4 text-blue-600" /> Provider Load
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {!providers || providers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-500">
            No provider assignments yet
          </div>
        ) : (
          providers.slice(0, 6).map((provider) => (
            <div key={provider.name} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{provider.name}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {provider.assignedCount} assigned · {provider.readyDischargeCount} discharge ready
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-red-600 text-white">{provider.highAcuityCount} high acuity</Badge>
                  <Badge className="bg-amber-500 text-white">{provider.openAlertCount} alerts</Badge>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1"><Siren className="h-3.5 w-3.5 text-amber-500" /> {provider.blockedCount} blocked</span>
                <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5 text-blue-500" /> live workload view</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
