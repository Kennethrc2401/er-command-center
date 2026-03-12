"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Activity, X, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";



interface Encounter {
  _id: string;
  patientId: string;
  acuity: number;
  vitals: {
    hr: string | number;
    bp: string;
    temp: string | number;
    spO2: string | number;
  };
}

export default function VitalsUpdate({ encounter, onClose }: { encounter: Encounter, onClose: () => void }) {
  const updateVitals = useMutation(api.patients.updateVitals);
  const updateAcuity = useMutation(api.encounters.updateAcuity);
  
  const [vitals, setVitals] = useState(encounter.vitals);

  // Derive suggested ESI directly from the current vitals to avoid effect-driven state churn.
  const suggestedAcuity = (() => {
    const hr = Number(vitals.hr);
    const o2 = Number(vitals.spO2);

    if (o2 < 88 || hr > 140 || hr < 40) {
      return 1;
    }

    if (o2 < 93 || hr > 115 || hr < 50) {
      return 2;
    }

    return 3;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Update the master vital record
      await updateVitals({
        patientId: encounter.patientId as Id<"patients">,
        encounterId: encounter._id as Id<"encounters">,
        vitals: {
          hr: Number(vitals.hr),
          bp: vitals.bp,
          temp: Number(vitals.temp),
          spO2: Number(vitals.spO2),
        }
      });

      // 2. Automatically synchronize acuity if it has changed
      if (suggestedAcuity !== encounter.acuity) {
        await updateAcuity({
          id: encounter._id as Id<"encounters">,
          acuity: suggestedAcuity
        });
        toast.info(`Acuity Adjusted`, {
          description: `Patient priority moved to ESI ${suggestedAcuity} based on vitals.`
        });
      }

      toast.success("Vitals Updated", { description: "Clinical trend and acuity updated successfully." });
      onClose();
    } catch {
      toast.error("Update failed. Please check values.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(event) => event.preventDefault()}
        className="z-1000! w-full max-w-md overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-md"
      >
        <DialogTitle className="sr-only">Update Vitals</DialogTitle>
        <DialogDescription className="sr-only">
          Update patient vital signs and save to the active encounter.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="w-full max-h-[calc(100vh-2rem)] overflow-y-auto">
          {/* HEADER */}
          <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-blue-400" />
              <h2 className="text-xl font-black uppercase italic tracking-tight">Clinical Vitals</h2>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-8 space-y-6">
            {/* 🚨 AUTO-ACUITY ALERT */}
            {suggestedAcuity !== encounter.acuity && (
              <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex items-center gap-3 animate-in zoom-in-95">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase text-amber-700 tracking-tight">
                    Suggested Acuity Shift
                  </p>
                  <p className="text-[10px] font-bold text-amber-600/80">
                    ESI {encounter.acuity} → <span className="underline font-black">ESI {suggestedAcuity}</span>
                  </p>
                </div>
              </div>
            )}

            {/* INPUT GRID */}
            <div className="grid grid-cols-2 gap-6">
              <VitalInput label="Heart Rate" unit="BPM" value={vitals.hr} onChange={(v) => setVitals({...vitals, hr: v})} />
              <VitalInput label="Blood Pressure" unit="mmHg" value={vitals.bp} onChange={(v) => setVitals({...vitals, bp: v})} isString />
              <VitalInput label="Temp" unit="°F" value={vitals.temp} onChange={(v) => setVitals({...vitals, temp: v})} />
              <VitalInput label="O2 Sat" unit="%" value={vitals.spO2} onChange={(v) => setVitals({...vitals, spO2: v})} />
            </div>

            <button 
              type="submit" 
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
            >
              <Check className="h-4 w-4" /> Save Vital Signs
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface VitalInputProps {
  label: string;
  unit: string;
  value: string | number;
  onChange: (value: string) => void;
  isString?: boolean;
}

function VitalInput({ label, unit, value, onChange, isString = false }: VitalInputProps) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">{label}</label>
      <div className="relative group">
        <input 
          type={isString ? "text" : "number"}
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-black text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 uppercase pointer-events-none group-focus-within:text-blue-400">
          {unit}
        </span>
      </div>
    </div>
  );
}