"use client";

import { usePresentationMode } from "@/lib/hooks/usePresentationMode";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export default function PresentationToggle() {
  const { isDemoMode, toggleDemoMode } = usePresentationMode();

  return (
    <button
      onClick={toggleDemoMode}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
        isDemoMode 
          ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
          : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
      }`}
    >
      {isDemoMode ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
      {isDemoMode ? "Privacy Mode: ON" : "Privacy Mode: OFF"}
    </button>
  );
}