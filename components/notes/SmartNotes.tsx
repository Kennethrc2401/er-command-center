"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Zap, Save } from "lucide-react";
import { toast } from "sonner";
import TEMPLATES from "./templates";

export default function SmartNotes({ encounterId }: { encounterId: Id<"encounters"> }) {
  const [content, setContent] = useState("");
  const addNote = useMutation(api.notes.addNote);

  const applyTemplate = (templateText: string) => {
    setContent(templateText);
    toast.success("Template Applied");
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
      <div className="flex flex-wrap gap-2">
        {Object.entries(TEMPLATES).map(([key, t]) => (
          <button
            key={key}
            onClick={() => applyTemplate(t.text)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black uppercase border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
          >
            <Zap className="h-3 w-3" /> {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Select a template above or type a free-text clinical note..."
          className="w-full h-48 p-6 rounded-[2rem] border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-inner resize-none"
        />
        <button
          onClick={handleSave}
          disabled={!content}
          className="absolute bottom-4 right-4 flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> Finalize Note
        </button>
      </div>
    </div>
  );
}