"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, FileCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DischargeButton({ encounterId }: { encounterId: Id<"encounters"> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const discharge = useMutation(api.encounters.dischargePatient);
  const router = useRouter();

  const handleDischarge = async () => {
    await discharge({
      encounterId,
      disposition: "Home",
      followUp: followUp,
    });
    setIsOpen(false);
    router.push("/"); // Return to Command Center after discharge
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50 gap-2">
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
          <p className="text-sm text-slate-500">
            This will archive the encounter and move the patient out of the active ER queue.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-400">Follow-up Instructions</label>
            <Textarea 
              placeholder="e.g., Follow up with Cardiology in 3 days. Return for chest pain." 
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleDischarge}>
            Complete Discharge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}