"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FileCheck, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function DischargeButton({ encounterId }: { encounterId: Id<"encounters"> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const discharge = useMutation(api.encounters.dischargePatient);
  const ensureChecklist = useMutation(api.checklists.ensureDischargeChecklist);
  const readiness = useQuery(api.checklists.getDischargeReadiness, { encounterId });
  const router = useRouter();

  useEffect(() => {
    void ensureChecklist({ encounterId }).catch(() => undefined);
  }, [encounterId, ensureChecklist]);

  const canDischarge = readiness?.summary.canDischarge ?? false;
  const remainingRequired = readiness?.summary.requiredRemaining ?? 0;

  const handleDischarge = async () => {
    if (!canDischarge) {
      toast.error(`Discharge checklist incomplete: ${remainingRequired} required item(s) remaining.`);
      return;
    }

    await discharge({
      encounterId,
      summary: followUp,
    });
    setIsOpen(false);
    router.push("/");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          <LogOut className="h-4 w-4" /> Discharge
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-emerald-600" />
            Finalize Discharge
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-slate-500 dark:text-slate-300">
            This will archive the encounter and move the patient out of the active ER queue.
          </p>
          <div className={`rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] ${canDischarge ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"}`}>
            {canDischarge ? "Discharge readiness complete" : `${remainingRequired} required checklist item(s) still pending`}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">Follow-up Instructions</label>
            <Textarea
              placeholder="e.g., Follow up with Cardiology in 3 days. Return for chest pain."
              value={followUp}
              onChange={(event) => setFollowUp(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void handleDischarge()} disabled={!canDischarge}>
            Complete Discharge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
