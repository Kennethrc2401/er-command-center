"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertCircle, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function PatientKiosk() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [priority, setPriority] = useState<"routine" | "urgent" | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    complaint: "",
    symptomSummary: "",
    painScore: 0,
    chestPain: false,
    breathingDifficulty: false,
    severeBleeding: false,
  });

  const submitCheckIn = useMutation(api.kiosk.submitCheckIn);

  const handleSubmit = async () => {
    if (!formData.name || !formData.complaint) {
      toast.error("Please fill out all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitCheckIn({
        name: formData.name,
        chiefComplaint: formData.complaint,
        symptomSummary: formData.symptomSummary,
        painScore: formData.painScore,
        chestPain: formData.chestPain,
        breathingDifficulty: formData.breathingDifficulty,
        severeBleeding: formData.severeBleeding,
      });

      setPriority(result.priority as "routine" | "urgent");
      setStep(3);

      if (result.priority === "urgent") {
        toast.warning("Urgent symptoms flagged", {
          description: "Front desk and triage queue have been updated for immediate review.",
        });
      }

      setTimeout(() => {
        setFormData({
          name: "",
          complaint: "",
          symptomSummary: "",
          painScore: 0,
          chestPain: false,
          breathingDifficulty: false,
          severeBleeding: false,
        });
        setPriority(null);
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
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6 font-sans">
      <div className="w-full max-w-2xl">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
            Nexus <span className="text-blue-500">Express</span> Check-In
          </h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Hackensack Meridian Health | Emergency Services
          </p>
        </div>

        <Card className="overflow-hidden rounded-[3.5rem] border-none bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
          <CardContent className="p-12">
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-bottom-6 space-y-8 duration-500">
                <div className="space-y-3">
                  <label className="px-2 text-[11px] font-black uppercase italic tracking-widest text-slate-400">Legal Full Name</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    className="w-full rounded-[2rem] border-2 border-slate-100 bg-slate-50 p-8 text-2xl font-bold text-slate-900 shadow-inner outline-none transition-all focus:border-blue-500 focus:bg-white"
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  />
                </div>
                <button
                  onClick={() => setStep(2)}
                  disabled={!formData.name}
                  className="flex w-full items-center justify-center gap-3 rounded-[2.5rem] bg-blue-600 py-8 text-xl font-black uppercase tracking-tighter text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
                >
                  Continue <ChevronRight className="h-6 w-6" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-6 space-y-8 duration-500">
                <div className="space-y-3">
                  <label className="px-2 text-[11px] font-black uppercase italic tracking-widest text-slate-400">Reason for Visit</label>
                  <textarea
                    placeholder="Briefly describe why you are here"
                    className="h-40 w-full resize-none rounded-[2.5rem] border-2 border-slate-100 bg-slate-50 p-8 text-xl font-bold text-slate-900 shadow-inner outline-none transition-all focus:border-blue-500 focus:bg-white"
                    value={formData.complaint}
                    onChange={(event) => setFormData({ ...formData, complaint: event.target.value })}
                  />
                </div>

                <div className="space-y-3">
                  <label className="px-2 text-[11px] font-black uppercase italic tracking-widest text-slate-400">Symptoms or Details</label>
                  <textarea
                    placeholder="When did it start? What feels worse right now?"
                    className="h-32 w-full resize-none rounded-[2rem] border-2 border-slate-100 bg-slate-50 p-6 text-base font-semibold text-slate-900 shadow-inner outline-none transition-all focus:border-blue-500 focus:bg-white"
                    value={formData.symptomSummary}
                    onChange={(event) => setFormData({ ...formData, symptomSummary: event.target.value })}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-5">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Pain Score</label>
                    <div className="mt-4 flex items-center gap-4">
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={formData.painScore}
                        onChange={(event) => setFormData({ ...formData, painScore: Number(event.target.value) })}
                        className="w-full"
                      />
                      <span className="w-10 text-center text-2xl font-black text-slate-900">{formData.painScore}</span>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-[2rem] border border-slate-100 bg-slate-50 p-5">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Emergency Flags</p>
                    {[
                      { key: "chestPain", label: "Chest Pain" },
                      { key: "breathingDifficulty", label: "Difficulty Breathing" },
                      { key: "severeBleeding", label: "Severe Bleeding" },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-3 text-sm font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={formData[item.key as keyof typeof formData] as boolean}
                          onChange={(event) => setFormData({ ...formData, [item.key]: event.target.checked })}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 rounded-[2rem] bg-slate-100 py-6 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-200"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!formData.complaint || isSubmitting}
                    className="flex flex-[2.5] items-center justify-center gap-2 rounded-[2rem] bg-emerald-500 py-6 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Complete Check-In"}
                    {!isSubmitting && <CheckCircle2 className="h-5 w-5" />}
                  </button>
                </div>

                <div className="flex items-start gap-4 rounded-[2rem] border border-amber-100 bg-amber-50 p-6">
                  <AlertCircle className="mt-1 h-6 w-6 shrink-0 text-amber-500" />
                  <p className="text-[11px] font-bold uppercase leading-relaxed tracking-tight text-amber-800">
                    If you have chest pain, difficulty breathing, or severe bleeding, stop and tell the nurse at the desk immediately.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-in zoom-in-95 space-y-8 py-16 text-center duration-700">
                <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
                  <CheckCircle2 className="h-16 w-16" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900">You&apos;re Checked In</h2>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Thank you, {formData.name.split(" ")[0]}</p>
                </div>
                <p className={`mx-auto max-w-lg rounded-2xl px-6 py-4 text-[11px] font-bold uppercase leading-relaxed ${priority === "urgent" ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-500"}`}>
                  {priority === "urgent"
                    ? "Urgent symptoms were flagged. Please remain visible to the front desk while a triage clinician is alerted."
                    : "Please take a seat in the waiting area. A CCMA will call you for triage shortly."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
