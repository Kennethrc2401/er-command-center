"use client";

import { FlaskConical } from "lucide-react";
import ClinicalResearchHub from "@/components/admin/ClinicalResearchHub";

export default function ClinicalResearchPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in duration-500">
      <header>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-blue-200 bg-blue-600/10 p-2.5">
            <FlaskConical className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-slate-100">
              Clinical <span className="text-blue-600">Research</span>
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              Admin Workspace · De-Identified By Default
            </p>
          </div>
        </div>
      </header>

      <ClinicalResearchHub />
    </div>
  );
}
