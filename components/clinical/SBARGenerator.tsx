"use client";

import { ClipboardCheck, Copy, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SBARPatient {
  name: string;
  mrn: string;
  gender: string;
  medicalHistory?: string[];
  allergies?: string[];
}

interface SBAREncounter {
  chiefComplaint: string;
  acuity: string | number;
  status: string;
  vitals: {
    hr: string | number;
    bp: string;
    spO2: string | number;
    temp: string | number;
  };
}

export default function SBARGenerator({ patient, encounter }: { patient: SBARPatient; encounter: SBAREncounter }) {
  const [copied, setCopied] = useState(false);

  // 📝 The SBAR Assembly
  const sbarText = `
[S] SITUATION: ${patient.name} (${patient.mrn}) is a ${patient.gender} presenting with ${encounter.chiefComplaint}. Currently ESI ${encounter.acuity}.
[B] BACKGROUND: PMH includes ${patient.medicalHistory?.join(", ") || "none"}. Allergies: ${patient.allergies?.join(", ") || "NKDA"}.
[A] ASSESSMENT: Latest Vitals - HR: ${encounter.vitals.hr}, BP: ${encounter.vitals.bp}, O2: ${encounter.vitals.spO2}%, Temp: ${encounter.vitals.temp}F. Patient is currently ${encounter.status}.
[R] RECOMMENDATION: Continue monitoring vitals. Evaluate for ${encounter.chiefComplaint} protocols.
  `.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(sbarText);
    setCopied(true);
    toast.success("SBAR Handoff Copied", { description: "Ready for shift-change report." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 rounded-[2rem] p-6 text-white border border-white/10 shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Auto-SBAR Handoff</span>
        </div>
        <button 
          onClick={handleCopy}
          className="p-2 hover:bg-white/10 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400"
        >
          {copied ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy Note"}
        </button>
      </div>
      
      <pre className="text-[11px] font-mono leading-relaxed text-slate-300 whitespace-pre-wrap bg-black/20 p-4 rounded-xl border border-white/5">
        {sbarText}
      </pre>
    </div>
  );
}