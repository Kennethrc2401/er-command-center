"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface Encounter {
  _id: Id<"encounters">;
  patientName: string;
  acuity: number;
}

export default function TriageHandoffModal({ encounter, onClose }: { encounter: Encounter, onClose: () => void }) {
  const [vitals, setVitals] = useState({ hr: 72, bp: "120/80", spO2: 98, temp: 98.6 });
  const [acuity, setAcuity] = useState(encounter.acuity);
  const [bed, setBed] = useState("");
  const performHandoff = useMutation(api.encounters.triageHandoff);

  const handleComplete = async () => {
    if (vitals.spO2 > 100) return toast.error("Oxygen saturation cannot exceed 100%");
    if (vitals.hr > 300 || vitals.hr < 0) return toast.error("Please re-check Heart Rate entry");
    if (!bed.trim()) return toast.error("Please assign a treatment location");

    if (vitals.spO2 < 85 || vitals.hr > 160) {
      if (!window.confirm("These vitals are critically abnormal. Are you sure you want to proceed?")) return;
    }

    try {
      await performHandoff({
        encounterId: encounter._id,
        acuity,
        location: bed,
        vitals
      });

      toast.success(`Handoff complete for ${encounter.patientName}`);
      onClose();
    } catch {
      toast.error("Handoff failed. Please try again.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-2xl" showCloseButton={false}>
        <DialogTitle className="sr-only">
          Triage handoff for {encounter.patientName}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Review vitals, choose acuity and assign a bed before confirming admission.
        </DialogDescription>
        {/* Header */}
        <div className="bg-slate-900 p-8 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Incoming Triage</p>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter">{encounter.patientName}</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-4 py-2 rounded-xl font-black text-xl ${acuity <= 2 ? 'bg-red-600' : 'bg-blue-600'}`}>
                ESI {acuity}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close triage card"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white transition-all hover:bg-white/20 hover:text-blue-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Vitals Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <VitalInput label="Heart Rate" value={vitals.hr} onChange={(v) => setVitals({...vitals, hr: Number(v)})} suffix="BPM" />
            <VitalInput label="Blood Pressure" value={vitals.bp} onChange={(v) => setVitals({...vitals, bp: v})} />
            <VitalInput label="SpO2" value={vitals.spO2} onChange={(v) => setVitals({...vitals, spO2: Number(v)})} suffix="%" />
            <VitalInput label="Temp" value={vitals.temp} onChange={(v) => setVitals({...vitals, temp: Number(v)})} suffix="°F" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ESI Selector */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Clinical Acuity (ESI)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button 
                    key={lvl}
                    onClick={() => setAcuity(lvl)}
                    className={`flex-1 py-3 rounded-xl font-black transition-all ${acuity === lvl ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Bed Assignment */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Target Location</label>
              <select 
                value={bed}
                onChange={(e) => setBed(e.target.value)}
                className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-500 transition-all"
              >
                <option value="">Select Bed...</option>
                {Array.from({ length: 20 }).map((_, i) => (
                  <option key={i} value={`Bed ${i+1}`}>Bed {i+1}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button onClick={onClose} className="flex-1 py-4 font-black uppercase text-xs text-slate-400 hover:text-slate-600 tracking-widest">Cancel</button>
            <button 
              onClick={handleComplete}
              className="flex-2 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all"
            >
              Confirm Admission <CheckCircle2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface VitalInputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  suffix?: string;
}

function VitalInput({ label, value, onChange, suffix = "" }: VitalInputProps) {
  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
      <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-tighter">{label}</p>
      <div className="flex items-baseline gap-1">
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent font-black text-xl text-slate-900 w-full outline-none focus:text-blue-600 transition-colors"
        />
        <span className="text-[10px] font-bold text-slate-400">{suffix}</span>
      </div>
    </div>
  );
}