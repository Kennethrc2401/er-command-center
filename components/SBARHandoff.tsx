"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCopy, MessageSquare, AlertTriangle, Activity, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useMemo, useState } from "react";

// Define strict types for the SBAR data
interface SBARProps {
  patient: {
    name: string;
    mrn: string;
    dob: string;
    allergies: string[];
    codeStatus?: string;
  };
  encounter: {
    chiefComplaint: string;
    vitals: {
      bp?: string;
      hr?: number;
      spO2?: number;
    };
  };
  gcs?: number | null;
  criticalLabs: Array<{ testName: string }>;
}

export default function SBARHandoff({ patient, encounter, gcs, criticalLabs }: SBARProps) {
  const [aiRecommendation, setAiRecommendation] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  const sbarCopyText = useMemo(() => {
    const allergyText = patient.allergies.length > 0 ? patient.allergies.join(", ") : "No known allergies";
    const criticalLabText = criticalLabs.length > 0 ? criticalLabs.map((lab) => lab.testName).join(", ") : "None reported";
    const recommendationText =
      aiRecommendation ||
      "Continue monitoring q4h vitals and reassess for worsening respiratory or neurologic status.";

    return [
      "SBAR CLINICAL HANDOFF",
      `Patient: ${patient.name}`,
      `MRN: ${patient.mrn}`,
      `DOB: ${patient.dob || "N/A"}`,
      "",
      "S - Situation",
      `Chief complaint: ${encounter.chiefComplaint || "N/A"}`,
      `Current vitals: BP ${encounter.vitals.bp ?? "N/A"}, HR ${encounter.vitals.hr ?? "N/A"}, SpO2 ${encounter.vitals.spO2 ?? "N/A"}%`,
      "",
      "B - Background",
      `Code status: ${patient.codeStatus ?? "Full Code"}`,
      `Allergies: ${allergyText}`,
      `Critical labs: ${criticalLabText}`,
      "",
      "A - Assessment",
      `GCS: ${gcs ?? "Not documented"}`,
      "Escalation risks: Monitor oxygenation, hemodynamics, and lab follow-up.",
      "",
      "R - Recommendation",
      recommendationText,
      "",
      `Generated: ${new Date().toLocaleString()}`,
    ].join("\n");
  }, [patient, encounter, gcs, criticalLabs, aiRecommendation]);

  const copyToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const success = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (!success) {
      throw new Error("Clipboard copy failed");
    }
  };

  const handleCopy = async () => {
    if (isCopying) return;

    setIsCopying(true);
    try {
      await copyToClipboard(sbarCopyText);
      setCopied(true);
      toast.success("SBAR handoff copied to clipboard.");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Unable to copy SBAR handoff.");
    } finally {
      setIsCopying(false);
    }
  };

  const generateRecommendation = () => {
    setIsGenerating(true);
    // Clinical Logic Simulation
    setTimeout(() => {
      let rec = "Continue monitoring q4h vitals. ";
      if (gcs && gcs <= 8) rec = "CRITICAL: Protect airway. Evaluate for immediate intubation. ";
      if (encounter.vitals.spO2 && encounter.vitals.spO2 < 92) rec += "Titrate O2 to maintain >94%. ";
      if (criticalLabs.length > 0) rec += `Follow up on abnormal ${criticalLabs[0].testName}.`;
      
      setAiRecommendation(rec);
      setIsGenerating(false);
      toast.info("Clinical recommendation generated");
    }, 800);
  };

  return (
    <Card className="border-slate-200 shadow-xl rounded-[2rem] overflow-hidden bg-white">
      <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between p-6">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-500" /> Clinical SBAR Handoff
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={handleCopy} disabled={isCopying} className="h-7 text-[9px] font-black uppercase text-blue-600">
          <ClipboardCopy className="h-3.5 w-3.5 mr-1" /> {copied ? "Copied" : isCopying ? "Copying" : "Copy"}
        </Button>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* S, B, A Sections as before... */}

        {/* R: RECOMMENDATION with AI */}
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">R: Recommendation</h4>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={generateRecommendation}
              disabled={isGenerating}
              className="h-6 text-[8px] font-black uppercase text-purple-600 gap-1 hover:bg-purple-50"
            >
              <Sparkles className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} /> 
              {aiRecommendation ? "Regenerate" : "AI Suggest"}
            </Button>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 min-h-15">
             <p className="text-xs font-medium text-slate-600 italic leading-relaxed">
               {aiRecommendation || "Select 'AI Suggest' to generate a clinical recommendation based on current data."}
             </p>
          </div>
        </section>

        {/* SHIFT CHANGE CHECKLIST */}
        <section className="pt-4 border-t border-dashed border-slate-200 space-y-3">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> CCMA Sign-Off Checklist
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {[
              "IV Site Patent & Dressing Intact",
              "Call Light Within Reach",
              "Side Rails x2 Up",
              "Final Set of Vitals Charted"
            ].map((item) => (
              <label key={item} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                <input type="checkbox" className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4" />
                <span className="text-[11px] font-bold text-slate-600">{item}</span>
              </label>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}