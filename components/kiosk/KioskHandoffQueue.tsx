"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { ArrowRight, ClipboardPlus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function KioskHandoffQueue() {
  const { actorName } = useResolvedActor();
  const queue = useQuery(api.kiosk.getQueue);
  const acknowledge = useMutation(api.kiosk.acknowledge);
  const markRoomed = useMutation(api.kiosk.markRoomed);

  const handleAcknowledge = async (intakeId: NonNullable<typeof queue>[number]["_id"]) => {
    await acknowledge({ intakeId, actorName });
    toast.success("Kiosk handoff acknowledged");
  };

  const handleRoomed = async (intakeId: NonNullable<typeof queue>[number]["_id"]) => {
    await markRoomed({ intakeId });
    toast.success("Kiosk intake marked roomed");
  };

  return (
    <Card className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70 pb-4 dark:border-slate-800 dark:bg-slate-950/40">
        <CardTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-200">
          <ClipboardPlus className="h-4 w-4 text-emerald-600" /> Kiosk Handoff Queue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {!queue || queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-500">
            No kiosk arrivals waiting
          </div>
        ) : (
          queue.slice(0, 6).map((item) => (
            <div key={item._id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{item.patientName}</p>
                    <Badge className={`${item.priority === "urgent" ? "bg-red-600" : "bg-blue-600"} text-white`}>
                      {item.priority}
                    </Badge>
                    {item.urgentFlags.length > 0 && (
                      <Badge className="bg-amber-500 text-white">
                        <ShieldAlert className="mr-1 h-3 w-3" /> {item.urgentFlags.length} flags
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.chiefComplaint}</p>
                  {item.symptomSummary && <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.symptomSummary}</p>}
                </div>
                <Link href={`/patient/${item.patientId}`} className="text-[10px] font-black uppercase tracking-wide text-blue-600 hover:text-blue-500">
                  Chart
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {item.urgentFlags.map((flag) => (
                    <Badge key={`${item._id}-${flag}`} variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                      {flag}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  {item.status === "new" && (
                    <Button type="button" size="sm" variant="outline" onClick={() => void handleAcknowledge(item._id)}>
                      Ack
                    </Button>
                  )}
                  <Button type="button" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void handleRoomed(item._id)}>
                    Roomed <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
