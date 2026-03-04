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
import { Switch } from "@/components/ui/switch";
import { PlusCircle, FlaskConical, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function AddLabResult({ encounterId }: { encounterId: Id<"encounters"> }) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [testName, setTestName] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [range, setRange] = useState("");
  const [isAbnormal, setIsAbnormal] = useState(false);

  const postResult = useMutation(api.labs.postResult);

  const handleSubmit = async () => {
    if (!testName || !value) return;
    setIsSaving(true);
    
    try {
      await postResult({
        encounterId,
        testName,
        value,
        unit,
        range,
        isAbnormal,
        status: "final"
      });
      toast.success(`${testName} Resulted`, {
        description: `Value of ${value} ${unit} added to clinical chart.`
      });
      setOpen(false);
      resetForm();
    } catch (e) {
      toast.error("Entry Failed", { description: "Check server connection." });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setTestName("");
    setValue("");
    setUnit("");
    setRange("");
    setIsAbnormal(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-[10px] font-black uppercase tracking-widest gap-2">
          <PlusCircle className="h-3.5 w-3.5" /> Post Result
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-indigo-600" /> POC Lab Entry
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-[10px] font-bold uppercase text-slate-400">Test</Label>
            <Input 
              placeholder="e.g., Troponin I" 
              className="col-span-3 h-9 text-sm font-bold bg-slate-50 border-none rounded-xl"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-[10px] font-bold uppercase text-slate-400">Value</Label>
            <Input 
              placeholder="12.4" 
              className="col-span-3 h-9 text-sm font-bold bg-slate-50 border-none rounded-xl"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-[10px] font-bold uppercase text-slate-400">Unit/Range</Label>
            <div className="col-span-3 flex gap-2">
              <Input 
                placeholder="mg/dL" 
                className="h-9 text-sm bg-slate-50 border-none rounded-xl"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
              <Input 
                placeholder="0-0.4" 
                className="h-9 text-sm bg-slate-50 border-none rounded-xl"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2">
              <AlertCircle className={`h-4 w-4 ${isAbnormal ? 'text-red-500 animate-pulse' : 'text-slate-300'}`} />
              <Label className="text-[10px] font-black uppercase text-slate-600">Mark as Abnormal?</Label>
            </div>
            <Switch 
              checked={isAbnormal} 
              onCheckedChange={setIsAbnormal}
              className="data-[state=checked]:bg-red-500" 
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleSubmit} 
            disabled={isSaving || !testName || !value}
            className="w-full bg-slate-900 hover:bg-black font-black uppercase text-[10px] tracking-widest h-12 rounded-2xl gap-2"
          >
            {isSaving ? "Processing..." : <><Save className="h-4 w-4" /> Sign & Result</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}