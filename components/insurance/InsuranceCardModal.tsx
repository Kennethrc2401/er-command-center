"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreditCard, ShieldCheck, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Insurance {
  patientName?: string;
  policyNumber?: string;
  groupNumber?: string;
}

export default function InsuranceCardModal({ insurance }: { insurance: Insurance }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-[2rem] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2 group italic">
          <CreditCard className="h-4 w-4 group-hover:rotate-12 transition-transform" />
          View Scanned Insurance Card
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl bg-slate-50 border-none rounded-[3rem] p-8">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <DialogTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Document Imaging System: Primary Payer
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* THE CARD UI */}
        <div className="relative mt-4 aspect-[1.6/1] w-full rounded-2xl bg-linear-to-br from-blue-700 to-blue-900 p-8 shadow-2xl overflow-hidden text-white border-4 border-white/10">
          {/* Mock Logo */}
          <div className="flex justify-between items-start mb-12">
            <div className="space-y-1">
              <h2 className="text-2xl font-black italic tracking-tighter">HORIZON</h2>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest leading-none">Blue Cross Blue Shield of NJ</p>
            </div>
            <div className="h-10 w-10 bg-white/20 rounded-full blur-xs absolute -top-4 -right-4" />
          </div>

          {/* Member Details */}
          <div className="space-y-4">
            <div>
              <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">Subscriber Name</p>
              <p className="text-xl font-bold uppercase tracking-tight">{insurance?.patientName || "Sophia Ramirez"}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">Member ID</p>
                <p className="text-lg font-mono font-bold tracking-widest">{insurance?.policyNumber || "HZN-9923847"}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">Group No.</p>
                <p className="text-lg font-mono font-bold tracking-widest">{insurance?.groupNumber || "NJ-4402"}</p>
              </div>
            </div>
          </div>

          {/* Card Footer */}
          <div className="absolute bottom-6 left-8 right-8 flex justify-between items-end">
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-[7px] font-black uppercase opacity-50">Office Copay</p>
                <p className="text-xs font-bold">$25</p>
              </div>
              <div className="text-center">
                <p className="text-[7px] font-black uppercase opacity-50">ER Copay</p>
                <p className="text-xs font-bold">$150</p>
              </div>
            </div>
            <p className="text-[8px] font-mono opacity-40">BCBSNJ-PPO-2026-v4</p>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <Button variant="outline" className="flex-1 rounded-2xl font-black text-[10px] uppercase gap-2 border-slate-200">
            <Printer className="h-4 w-4" /> Print Copy
          </Button>
          <Button className="flex-1 bg-slate-900 rounded-2xl font-black text-[10px] uppercase gap-2">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}