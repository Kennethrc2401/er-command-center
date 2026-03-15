"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function DischargeReadinessPanel({ encounterId }: { encounterId: Id<"encounters"> }) {
  const { actorName, actorRole } = useResolvedActor();
  const ensureChecklist = useMutation(api.checklists.ensureDischargeChecklist);
  const readiness = useQuery(api.checklists.getDischargeReadiness, { encounterId });
  const toggleTask = useMutation(api.checklists.toggle);

  useEffect(() => {
    void ensureChecklist({ encounterId }).catch(() => undefined);
  }, [encounterId, ensureChecklist]);

  const handleToggle = async (taskId: Id<"checklists">) => {
    await toggleTask({ taskId, completedBy: actorName, completedByRole: actorRole });
    toast.success("Discharge task updated");
  };

  const summary = readiness?.summary;

  return (
    <Card className="overflow-hidden rounded-[2rem] border border-emerald-200 bg-white shadow-sm dark:border-emerald-900/40 dark:bg-slate-900">
      <CardHeader className="border-b border-emerald-200 bg-emerald-50/60 pb-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <CardTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
          <ClipboardCheck className="h-4 w-4" /> Discharge Readiness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            {summary?.requiredCompleted ?? 0}/{summary?.requiredTotal ?? 0} required tasks complete
          </p>
          <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
            {summary?.canDischarge ? "Required safety items complete. Encounter is ready for discharge finalization." : `${summary?.requiredRemaining ?? 0} required item(s) still need completion.`}
          </p>
        </div>

        <div className="space-y-3">
          {readiness?.tasks.map((task) => (
            <div key={task._id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <Checkbox checked={task.completed} onCheckedChange={() => void handleToggle(task._id)} />
              <div className="min-w-0">
                <p className={`text-sm font-bold ${task.completed ? "text-emerald-700 line-through dark:text-emerald-300" : "text-slate-800 dark:text-slate-100"}`}>{task.item}</p>
                {task.completedBy && (
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Completed by {task.completedBy}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {summary?.canDischarge && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white p-3 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-900/40 dark:bg-slate-950/40 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4" /> Discharge safeguards complete
          </div>
        )}
      </CardContent>
    </Card>
  );
}
