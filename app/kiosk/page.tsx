"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChevronRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function PatientKiosk() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: "", complaint: "" });
  
  const createEncounter = useMutation(api.encounters.createEncounter);
  const createPatient = useMutation(api.patients.createPatient);

  const handleSubmit = async () => {
    if (!formData.name || !formData.complaint) {
      toast.error("Please fill out all fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create the permanent Patient Record first
      const patientId = await createPatient({
        name: formData.name,
      });

      // 2. Create the specific ER Visit (Encounter) linked to that ID
      await createEncounter({
        patientId,
        chiefComplaint: formData.complaint,
        acuity: 5, 
        vitals: { hr: 0, bp: "0/0", temp: 0, spO2: 0 },
      });

      setStep(3); // Success Screen

      // Reset for the next person in line after 5 seconds
      setTimeout(() => {
        setFormData({ name: "", complaint: "" });
        setStep(1);
        setIsSubmitting(false);
      }, 5000);

    } catch (error) {
      console.error(error);
      toast.error("Connection error. Please alert the front desk.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
      <div className="max-w-xl w-full">
        {/* KIOSK HEADER */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">
            Nexus <span className="text-blue-500">Express</span> Check-In
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
            Hackensack Meridian Health | Emergency Services
          </p>
        </div>

        <Card className="rounded-[3.5rem] border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] bg-white overflow-hidden">
          <CardContent className="p-12">
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest px-2 italic">Legal Full Name</label>
                  <input 
                    type="text"
                    placeholder="John Doe"
                    className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[2rem] text-2xl font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-inner"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <button 
                  onClick={() => setStep(2)}
                  disabled={!formData.name}
                  className="w-full py-8 bg-blue-600 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-tighter hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20 disabled:opacity-50"
                >
                  Continue <ChevronRight className="h-6 w-6" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-6 duration-500">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase text-slate-400 tracking-widest px-2 italic">Reason for Visit</label>
                  <textarea 
                    placeholder="Briefly describe why you are here (e.g., severe headache, flu symptoms, sprained ankle)"
                    className="w-full h-56 p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] text-xl font-bold text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all resize-none shadow-inner"
                    value={formData.complaint}
                    onChange={(e) => setFormData({ ...formData, complaint: e.target.value })}
                  />
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setStep(1)} 
                    className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleSubmit}
                    disabled={!formData.complaint || isSubmitting}
                    className="flex-[2.5] py-6 bg-emerald-500 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Complete Check-In"}
                    {!isSubmitting && <CheckCircle2 className="h-5 w-5" />}
                  </button>
                </div>
                <div className="flex items-start gap-4 p-6 bg-amber-50 rounded-[2rem] border border-amber-100">
                  <AlertCircle className="h-6 w-6 text-amber-500 shrink-0 mt-1" />
                  <p className="text-[11px] font-bold text-amber-800 uppercase leading-relaxed tracking-tight">
                    If you have chest pain, difficulty breathing, or severe bleeding, stop and tell the nurse at the desk immediately.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center py-16 space-y-8 animate-in zoom-in-95 duration-700">
                <div className="h-32 w-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <CheckCircle2 className="h-16 w-16" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">You&apos;re Checked In</h2>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Thank you, {formData.name.split(' ')[0]}</p>
                </div>
                <p className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed max-w-75 mx-auto bg-slate-50 py-4 px-6 rounded-2xl">
                  Please take a seat in the waiting area. A CCMA will call you for triage shortly.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div >
    </div>
  );
}