"use client";

import { exportShiftReport, Encounter } from "@/lib/shiftReports/exportReport";
import { FileDown, ClipboardCheck } from "lucide-react";

interface ExportReportButtonProps {
  encounters: Encounter[];
}

export default function ExportReportButton({ encounters }: ExportReportButtonProps) {
  const handleExport = () => {
    if (!encounters || encounters.length === 0) {
      alert("No active encounters to export.");
      return;
    }
    exportShiftReport(encounters);
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-slate-200 active:scale-95 group"
    >
      <div className="relative">
        <FileDown className="h-4 w-4 text-blue-400 group-hover:-translate-y-0.5 transition-transform" />
      </div>
      <span>Export SBAR Report</span>
      <ClipboardCheck className="h-3.5 w-3.5 text-slate-500 ml-1" />
    </button>
  );
}