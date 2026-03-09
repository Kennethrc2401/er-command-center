"use client";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle, Printer, Share2 } from "lucide-react";
import { useState } from "react";

interface Patient {
  name: string;
}

interface Insurance {
  provider?: string;
}

export default function CoPayReceiptModal({ 
  patient, 
  insurance, 
  amount 
}: { 
  patient: Patient, 
  insurance: Insurance, 
  amount: number 
}) {
  const [transactionId] = useState(() => `TXN-${Math.floor(Math.random() * 1000000)}`);
  const [authCode] = useState(() => Math.random().toString(36).substring(7).toUpperCase());

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200/50 italic">
          Collect ${amount} Co-Pay
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm bg-white border-none rounded-[2rem] p-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2">
            <CheckCircle className="h-10 w-10 animate-in zoom-in duration-300" />
          </div>
          
          <div className="space-y-1">
            <DialogTitle className="text-xl font-black uppercase italic tracking-tighter text-slate-900">
              Payment Successful
            </DialogTitle>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Point of Service Collection: Complete
            </p>
          </div>

          {/* THE RECEIPT SLIP */}
          <div className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 font-mono text-left space-y-4 relative overflow-hidden">
            {/* "PAID" WATERMARK */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-emerald-500/20 text-emerald-500/20 text-4xl font-black -rotate-12 pointer-events-none uppercase">
              Paid
            </div>

            <div className="border-b border-slate-200 pb-3 mb-3">
              <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-tighter italic">HACKENSACK MERIDIAN ER</h4>
              <p className="text-[8px] text-slate-400">Date: {new Date().toLocaleDateString()} | {new Date().toLocaleTimeString()}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[9px]">
                <span className="text-slate-500 uppercase">Patient</span>
                <span className="font-bold text-slate-800 uppercase">{patient.name}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-slate-500 uppercase">Payer</span>
                <span className="font-bold text-slate-800 uppercase">{insurance?.provider || "Self-Pay"}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-slate-500 uppercase">Auth Code</span>
                <span className="font-bold text-slate-800">{authCode}</span>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between items-center">
              <span className="text-xs font-black uppercase text-slate-900">Amount Paid</span>
              <span className="text-lg font-black text-emerald-600">${amount}.00</span>
            </div>

            <div className="pt-2 text-center">
              <p className="text-[7px] text-slate-400 leading-none">ID: {transactionId}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full mt-4">
            <button className="flex items-center justify-center gap-2 py-3 border-2 border-slate-100 rounded-xl text-[9px] font-black uppercase text-slate-500 hover:bg-slate-50 transition-all">
              <Printer className="h-3 w-3" /> Print
            </button>
            <button className="flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase hover:text-white transition-all">
              <Share2 className="h-3 w-3" /> E-Mail
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}