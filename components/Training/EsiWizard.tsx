"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Activity, Box, RotateCcw } from "lucide-react";

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
    <Card className="w-full overflow-hidden rounded-[2rem] border-none bg-white shadow-2xl sm:rounded-[3rem] dark:bg-slate-900">
      <div className="flex flex-col gap-3 bg-blue-600 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
          <Activity className="h-4 w-4" /> ESI Decision Tree
        </h3>
        <button onClick={reset} className="text-white/60 hover:text-white transition-colors">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <CardContent className="flex min-h-[28rem] flex-col items-center justify-center p-6 text-center sm:min-h-[32rem] sm:p-10">
        {step === "A" && (
          <div className="animate-in fade-in zoom-in-95 space-y-6">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase italic">Decision A</h2>
            <p className="mx-auto max-w-md text-sm font-medium leading-7 text-slate-500 sm:text-base">Is the patient dying? Does the patient require immediate life-saving intervention?</p>
            <div className="flex w-full max-w-md flex-col justify-center gap-3 sm:flex-row sm:gap-4">
              <button onClick={() => handleDecision("RESULT", 1)} className="w-full rounded-2xl bg-red-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white sm:w-auto sm:px-8">Yes (ESI 1)</button>
              <button onClick={() => handleDecision("B")} className="w-full rounded-2xl bg-slate-100 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200 sm:w-auto sm:px-8">No</button>
            </div>
          </div>
        )}

        {step === "B" && (
          <div className="animate-in slide-in-from-right-4 space-y-6">
            <h2 className="text-2xl font-black text-slate-900 uppercase italic">Decision B</h2>
            <p className="mx-auto max-w-md text-sm font-medium leading-7 text-slate-500 sm:text-base">Is this a high-risk situation? Confused, lethargic, or in severe distress or pain?</p>
            <div className="flex w-full max-w-md flex-col justify-center gap-3 sm:flex-row sm:gap-4">
              <button onClick={() => handleDecision("RESULT", 2)} className="w-full rounded-2xl bg-orange-500 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white sm:w-auto sm:px-8">Yes (ESI 2)</button>
              <button onClick={() => handleDecision("C")} className="w-full rounded-2xl bg-slate-100 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 sm:w-auto sm:px-8">No</button>
            </div>
          </div>
        )}

        {step === "C" && (
          <div className="animate-in slide-in-from-right-4 space-y-6">
            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Box className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase italic">Decision C</h2>
            <p className="mx-auto max-w-md text-sm font-medium leading-7 text-slate-500 sm:text-base">How many resources are needed? Labs, imaging, IV meds, or procedures.</p>
            <div className="mx-auto grid w-full max-w-sm grid-cols-1 gap-3">
              <button onClick={() => handleDecision("RESULT", 3)} className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Many Resources (ESI 3)</button>
              <button onClick={() => handleDecision("RESULT", 4)} className="py-4 bg-slate-100 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-200">One Resource (ESI 4)</button>
              <button onClick={() => handleDecision("RESULT", 5)} className="py-4 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-dashed border-slate-200">None (ESI 5)</button>
            </div>
          </div>
        )}

        {step === "RESULT" && (
          <div className="animate-in zoom-in-95 space-y-6">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Triage Recommended Level</p>
            <div className={`text-7xl font-black sm:text-9xl ${
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