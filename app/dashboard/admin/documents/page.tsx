"use client";

import { FolderCog } from "lucide-react";
import DocumentRetentionSettings from "@/components/admin/DocumentRetentionSettings";

export default function DocumentPolicyPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in duration-500">
      <header>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-indigo-600/20 bg-indigo-600/10 p-2.5">
            <FolderCog className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-slate-100">
              Document <span className="text-indigo-600">Policy</span>
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              Retention Windows · Purge Grace · Global Sweep Cadence
            </p>
          </div>
        </div>
      </header>

      <DocumentRetentionSettings />
    </div>
  );
}
