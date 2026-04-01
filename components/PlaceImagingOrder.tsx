"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Scan, Radio, Save } from "lucide-react";
import { toast } from "sonner";

export default function PlaceImagingOrder({
  encounterId,
  orderedBy,
}: {
  encounterId: Id<"encounters">;
  orderedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [studyName, setStudyName] = useState("");
  const [modality, setModality] = useState("X-Ray");
  const [priority, setPriority] = useState("Routine");
  const [reason, setReason] = useState("");

  const createOrder = useMutation(api.imaging.createOrder);

  const handleSubmit = async () => {
    if (!studyName || !reason) return;
    setIsSaving(true);
    
    try {
      await createOrder({
        encounterId,
        studyName,
        modality,
        reason,
        priority,
        orderedBy,
      });
      toast.success("Radiology Order Placed", {
        description: `${studyName} has been sent to the imaging queue.`
      });
      setOpen(false);
      setStudyName("");
      setReason("");
    } catch {
      toast.error("Order Failed", { description: "Clinical system error." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-[10px] font-black uppercase tracking-widest gap-2 h-8 px-4">
          <Radio className="h-3.5 w-3.5" /> New Order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-106.25 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <Scan className="h-4 w-4 text-blue-600" /> CPOE: Radiology
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Study Description</Label>
            <Input 
              placeholder="e.g., CT Head w/o Contrast" 
              className="h-10 text-sm font-bold bg-slate-50 border-none rounded-xl"
              value={studyName}
              onChange={(e) => setStudyName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Modality</Label>
              <Select value={modality} onValueChange={setModality}>
                <SelectTrigger className="bg-slate-50 border-none rounded-xl h-10 font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="X-Ray">X-Ray</SelectItem>
                  <SelectItem value="CT">CT Scan</SelectItem>
                  <SelectItem value="MRI">MRI</SelectItem>
                  <SelectItem value="US">Ultrasound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className={`border-none rounded-xl h-10 font-bold text-xs ${priority === 'STAT' ? 'bg-red-50 text-red-600' : 'bg-slate-50'}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Routine">Routine</SelectItem>
                  <SelectItem value="STAT">STAT (Urgent)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Clinical Indication</Label>
            <Input 
              placeholder="e.g., Rule out acute hemorrhage" 
              className="h-10 text-sm bg-slate-50 border-none rounded-xl italic"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleSubmit} 
            disabled={isSaving || !studyName || !reason}
            className="w-full bg-slate-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-widest h-12 rounded-2xl gap-2 shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-slate-950"
          >
            {isSaving ? "Submitting..." : <><Save className="h-4 w-4" /> Place Order</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}