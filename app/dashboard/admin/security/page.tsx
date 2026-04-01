"use client";

import { ScrollText } from "lucide-react";
import AuditLogViewer from "@/components/admin/AuditLogViewer";
import SecurityDiagnostics from "@/components/admin/SecurityDiagnostics";
import SessionActivityTimeline from "@/components/admin/SessionActivityTimeline";

export default function SecurityAuditPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in duration-500">
      <header>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-600/10 border border-emerald-600/20">
            <ScrollText className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-slate-100">
              Security <span className="text-emerald-600">Audit</span>
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              HIPAA Access Log · User Actions · Compliance Trail
            </p>
          </div>
        </div>
      </header>

      <SecurityDiagnostics />

      <SessionActivityTimeline />

      <AuditLogViewer />
    </div>
  );
}
