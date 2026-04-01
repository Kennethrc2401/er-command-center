"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ClipboardCopy, FileText, Printer, CheckCircle2, AlertCircle, Share2, Badge } from "lucide-react";
import { toast } from "sonner";

interface ShiftStats {
  totalPatients: number;
  availableBeds: number;
  highAcuity: number;
  boardingPatients: number;
  dailyRevenue: number;
  collectionCount: number;
  pendingInsurance: number;
}

export default function ShiftHandoffModal({ stats }: { stats: ShiftStats }) {
  const handoffText = `
UNIT 4B SHIFT HANDOFF REPORT
Date: ${new Date().toLocaleDateString()} | Time: ${new Date().toLocaleTimeString()}
Coordinator: Sophia Ramirez
-------------------------------------------
OPERATIONAL STATUS:
- Current Census: ${stats?.totalPatients}
- Available Beds: ${stats?.availableBeds}
- High Acuity (ESI 1-2): ${stats?.highAcuity}
- Boarding Patients: ${stats?.boardingPatients}

FINANCIAL SUMMARY:
- POS Collections: $${stats?.dailyRevenue}
- Transactions: ${stats?.collectionCount}
- Pending Insurance: ${stats?.pendingInsurance}

COMPLIANCE:
- Identity Audits: ${stats?.availableBeds > 15 ? 'Critical' : 'Complete'}
- Red Flag Rule Status: ACTIVE
-------------------------------------------
END OF REPORT
  `.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(handoffText);
    toast.success("Handoff report copied to clipboard");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="w-full py-7 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-200 transition-all gap-3 flex items-center justify-center italic">
          <Share2 className="h-4 w-4" /> Generate Shift Handoff
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-white border-none rounded-[3rem] p-10">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Shift Handoff Protocol</DialogTitle>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Standardized Unit Communication</p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* VISUAL SUMMARY */}
          <div className="space-y-6">
             <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100">
                <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Unit Health Summary</h4>
                <div className="space-y-3">
                   <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-600">Bed Availability</span>
                      <span className="text-[11px] font-black text-blue-600">{stats?.availableBeds}/20</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-600">Revenue Capture</span>
                      <span className="text-[11px] font-black text-emerald-600">${stats?.dailyRevenue}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-600">High Acuity Risk</span>
                      <Badge className="bg-red-100 text-red-600 border-none text-[8px]">{stats?.highAcuity} Cases</Badge>
                   </div>
                </div>
             </div>
             
             <div className="flex items-start gap-3 px-4">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-[9px] font-medium text-slate-500 italic uppercase">
                  Ensure the incoming coordinator reviews the **Identity Audit Log** for the {stats?.pendingInsurance} pending insurance records.
                </p>
             </div>
          </div>

          {/* TEXT PREVIEW */}
          <div className="relative">
            <pre className="p-6 bg-slate-900 text-blue-400 font-mono text-[9px] rounded-3xl h-64 overflow-y-auto border-4 border-slate-800">
              {handoffText}
            </pre>
            <button 
              onClick={handleCopy}
              className="absolute top-4 right-4 p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-colors"
            >
              <ClipboardCopy className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <button className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
            <Printer className="h-4 w-4" /> Print PDF Report
          </button>
          <button className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
            <CheckCircle2 className="h-4 w-4" /> Finalize Handoff
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}