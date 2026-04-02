"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, TimerReset, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

const TURNOVER_STATUS_STYLES: Record<string, string> = {
  not_started: "border-slate-200 bg-slate-50 text-slate-500",
  cleaning: "border-amber-200 bg-amber-50 text-amber-700",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function RoomTurnoverMonitor() {
  const queue = useQuery(api.workflow.getRoomTurnoverQueue);
  const updateBoarding = useMutation(api.encounters.updateBoardingWorkflow);

  const setStatus = async (encounterId: Id<"encounters">, roomTurnoverStatus: "not_started" | "cleaning" | "ready") => {
    try {
      await updateBoarding({ encounterId, roomTurnoverStatus });
      toast.success(`Room turnover set to ${roomTurnoverStatus.replaceAll("_", " ")}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update room turnover.";
      toast.error(message);
    }
  };

  return (
    <Card className="overflow-hidden rounded-[2.5rem] border border-amber-100 bg-white shadow-sm dark:border-amber-900/30 dark:bg-slate-900">
      <CardHeader className="border-b border-amber-50 bg-amber-50/50 pb-4 dark:border-amber-900/30 dark:bg-amber-950/20">
        <CardTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
          <Sparkles className="h-4 w-4" /> Room Turnover Monitor
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 p-4">
        {!queue ? (
          <p className="py-6 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Loading turnover queue...</p>
        ) : queue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-500">
            No rooms awaiting turnover
          </div>
        ) : (
          queue.slice(0, 8).map((item) => (
            <div
              key={item._id}
              className={`rounded-[1.5rem] border p-4 shadow-sm ${item.isOverdue ? "border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/50"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                      {item.location}
                    </p>
                    <Badge className={`border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${TURNOVER_STATUS_STYLES[item.roomTurnoverStatus]}`}>
                      {item.roomTurnoverStatus.replaceAll("_", " ")}
                    </Badge>
                    {item.isOverdue && (
                      <Badge className="bg-red-600 text-white">
                        <TimerReset className="mr-1 h-3 w-3" /> Overdue
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.patientName}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Turnover age: {formatAge(item.ageMinutes)} · Stage: {item.flowStage.replaceAll("_", " ")}
                  </p>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-500">
                  {item.isCleaning ? "Cleaning" : item.canStartCleaning ? "Needs Start" : "Ready"}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {item.canStartCleaning && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full border-amber-300 bg-white text-[10px] font-black uppercase tracking-widest text-amber-700 hover:bg-amber-50"
                    onClick={() => void setStatus(item._id, "cleaning")}
                  >
                    Start Cleaning
                  </Button>
                )}
                {item.canMarkReady && (
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full bg-emerald-600 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-500"
                    onClick={() => void setStatus(item._id, "ready")}
                  >
                    Mark Ready
                  </Button>
                )}
                {item.roomTurnoverStatus !== "not_started" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                    onClick={() => void setStatus(item._id, "not_started")}
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Reset
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}