"use client";

import { useState } from "react";
import { Wand2, Copy, RefreshCw, FileText } from "lucide-react";
import {
  generateScribeNote,
  type ScribeEncounter,
  type ScribeOrder,
  type ScribePatient,
} from "@/lib/helpers/scribe";
import { toast } from "sonner";

type AmbientScribeProps = {
  patient: ScribePatient;
  encounter: ScribeEncounter;
  orders: ScribeOrder[];
};

export default function AmbientScribe({ patient, encounter, orders }: AmbientScribeProps) {
  const [note, setNote] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleScribe = () => {
    setIsGenerating(true);
    // Simulate AI processing delay
    setTimeout(() => {
      const generatedNote = generateScribeNote(patient, encounter, orders);
      setNote(generatedNote);
      setIsGenerating(false);
      toast.success("Clinical Note Drafted");
    }, 800);
  };

  return (
    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl border border-white/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10">
        <Wand2 className="h-24 w-24 rotate-12" />
      </div>

      <div className="relative z-10 space-y-6">
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-blue-500 rounded-xl flex items-center justify-center">
              <Wand2 className="h-4 w-4" />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Ambient AI Scribe</h3>
          </div>
          {note && (
            <button 
              onClick={() => { navigator.clipboard.writeText(note); toast.success("Copied to clipboard"); }}
              className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              <Copy className="h-3 w-3" /> Copy Note
            </button>
          )}
        </header>

        {!note ? (
          <div className="py-8 text-center space-y-4">
            <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
              Ready to synthesize vitals, history, and orders into a professional SOAP note.
            </p>
            <button 
              onClick={handleScribe}
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
            >
              {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {isGenerating ? "Analyzing Data..." : "Draft Progress Note"}
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <pre className="bg-black/30 border border-white/10 p-6 rounded-2xl text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
              {note}
            </pre>
            <button 
              onClick={() => setNote("")}
              className="text-[9px] font-black uppercase text-slate-500 hover:text-white transition-all"
            >
              ← Clear and Re-Draft
            </button>
          </div>
        )}
      </div>
    </div>
  );
}