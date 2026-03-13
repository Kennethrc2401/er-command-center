"use client";

import { Users2 } from "lucide-react";
import ClinicianDirectory from "@/components/admin/ClinicianDirectory";

export default function StaffManagementPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in duration-500">
      <header>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-600/10 border border-blue-600/20">
            <Users2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-slate-100">
              Staff <span className="text-blue-600">Management</span>
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              Clinician Directory · Roles · Credentials
            </p>
          </div>
        </div>
      </header>

      <ClinicianDirectory />
    </div>
  );
}
