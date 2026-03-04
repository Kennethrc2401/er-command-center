"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Activity, Box, RotateCcw, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Step = "A" | "B" | "C" | "D" | "RESULT";

export default function EsiWizard() {
  const [step, setStep] = useState<Step>("A");
  const [result, setResult] = useState<number | null>(null);

  const reset = () => {
    setStep("A");
    setResult(null);
  };

  const handleDecision = (next: Step, esi?: number) => {
    if (esi) {
      setResult(esi);
      setStep("RESULT");
    } else {
      setStep(next);
    }
  };

  return (
    <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden min-h-100">
      <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
        <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
          <Activity className="h-4 w-4" /> ESI Decision Tree
        </h3>
        <button onClick={reset} className="text-white/60 hover:text-white transition-colors">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <CardContent className="p-10 flex flex-col items-center justify-center text-center">
        {step === "A" && (
          <div className="space-y-6 animate-in fade-in zoom-in-95">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase italic">Decision A</h2>
            <p className="text-slate-500 font-medium max-w-xs">Is the patient dying? Does the patient require immediate life-saving intervention?</p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => handleDecision("RESULT", 1)} className="px-8 py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Yes (ESI 1)</button>
              <button onClick={() => handleDecision("B")} className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">No</button>
            </div>
          </div>
        )}

        {step === "B" && (
          <div className="space-y-6 animate-in slide-in-from-right-4">
            <h2 className="text-2xl font-black text-slate-900 uppercase italic">Decision B</h2>
            <p className="text-slate-500 font-medium max-w-xs">Is this a high-risk situation? Confused, lethargic, or in severe distress/pain?</p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => handleDecision("RESULT", 2)} className="px-8 py-3 bg-orange-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Yes (ESI 2)</button>
              <button onClick={() => handleDecision("C")} className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest">No</button>
            </div>
          </div>
        )}

        {step === "C" && (
          <div className="space-y-6 animate-in slide-in-from-right-4">
            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Box className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase italic">Decision C</h2>
            <p className="text-slate-500 font-medium">How many resources are needed? (Labs, Imaging, IV Meds, Procedures)</p>
            <div className="grid grid-cols-1 gap-3 w-full max-w-xs mx-auto">
              <button onClick={() => handleDecision("RESULT", 3)} className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Many Resources (ESI 3)</button>
              <button onClick={() => handleDecision("RESULT", 4)} className="py-4 bg-slate-100 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-200">One Resource (ESI 4)</button>
              <button onClick={() => handleDecision("RESULT", 5)} className="py-4 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-dashed border-slate-200">None (ESI 5)</button>
            </div>
          </div>
        )}

        {step === "RESULT" && (
          <div className="space-y-6 animate-in zoom-in-95">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Triage Recommended Level</p>
            <div className={`text-9xl font-black ${
              result === 1 ? 'text-red-600' : result === 2 ? 'text-orange-500' : 'text-blue-600'
            }`}>
              {result}
            </div>
            <button onClick={reset} className="flex items-center gap-2 mx-auto px-6 py-3 bg-slate-100 rounded-xl text-xs font-black uppercase tracking-tight text-slate-600 hover:bg-slate-200">
              <RotateCcw className="h-4 w-4" /> Start New Assessment
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}