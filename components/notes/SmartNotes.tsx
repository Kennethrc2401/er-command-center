"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Zap, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import TEMPLATES from "./templates";

export default function SmartNotes({ encounterId }: { encounterId: Id<"encounters"> }) {
  const [content, setContent] = useState("");
  const addNote = useMutation(api.notes.addNote);
  
  // 🩺 Fetch the encounter to get the Insurance/Compliance data
  const encounter = useQuery(api.encounters.getById, { encounterId });

  const applyTemplate = (templateText: string) => {
    if (!encounter) return;

    // 🛡️ Use optional chaining and default strings to prevent errors
    const provider = encounter.insurance?.provider || "Self-Pay / Unverified";
    const status = encounter.insurance?.status === "Verified" 
      ? "ID Audit Complete (Red Flag Rule Compliant)" 
      : "ID Audit PENDING";

    const customizedText = templateText
      .replace("[INSURANCE]", provider)
      .replace("[COMPLIANCE]", status)
      .replace("[TIMESTAMP]", new Date().toLocaleString())
      .replace("[AUTHOR]", "Sophia Ramirez, CCMA");

    setContent(customizedText);
    toast.success("Template Applied with Admin Data");
  };

  const handleSave = async () => {
    if (!content) return;
    await addNote({
      encounterId,
      content,
      author: "Sophia Ramirez, CCMA",
      category: "Triage",
      isTemplate: false
    });
    setContent("");
    toast.info("Clinical Note Saved to Chart");
  };

  return (
    <div className="space-y-4">
      {/* TEMPLATE BUTTONS */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TEMPLATES).map(([key, t]) => (
          <button
            key={key}
            onClick={() => applyTemplate(t.text)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black uppercase border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
          >
            <Zap className="h-3 w-3" /> {t.label}
          </button>
        ))}
      </div>

      <div className="relative group">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Select a template above to auto-generate clinical and administrative documentation..."
          className="w-full h-56 p-6 rounded-[2rem] border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-inner resize-none transition-all"
        />
        
        {/* COMPLIANCE WATERMARK (Visual only) */}
        <div className="absolute top-4 right-6 flex items-center gap-2 pointer-events-none opacity-20 group-focus-within:opacity-5 transition-opacity">
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 italic">Audit Secure</span>
        </div>

        <button
          onClick={handleSave}
          disabled={!content}
          className="absolute bottom-4 right-4 flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-lg"
        >
          <Save className="h-4 w-4" /> Finalize Note
        </button>
      </div>
    </div>
  );
}