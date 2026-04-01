"use client";

import { ShieldCheck } from "lucide-react";

interface Insurance {
  provider?: string;
  policyNumber?: string;
  groupNumber?: string;
  coPayAmount?: string | number;
}

export default function VirtualInsuranceCard({ insurance, patientName }: { insurance: Insurance, patientName: string }) {
  // Determine card style based on provider
  const isHorizon = insurance?.provider?.toLowerCase().includes("horizon");
  
  return (
    <div className="relative w-full max-w-md aspect-[1.58/1] rounded-[1.5rem] overflow-hidden shadow-2xl transition-all hover:scale-[1.02] cursor-default group">
      {/* CARD BACKGROUND (Dynamic Colors) */}
      <div className={`absolute inset-0 bg-linear-to-br ${
        isHorizon ? 'from-blue-600 to-blue-900' : 'from-slate-700 to-slate-900'
      }`} />
      
      {/* GLASS OVERLAY */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />

      {/* CARD CONTENT */}
      <div className="relative h-full p-6 flex flex-col justify-between text-white font-sans">
        
        {/* TOP ROW: LOGO & PLAN */}
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <h2 className="text-xl font-black italic tracking-tighter leading-none">
              {isHorizon ? "Horizon" : insurance?.provider || "PRIMARY PAYER"}
            </h2>
            <p className="text-[7px] font-bold uppercase tracking-[0.2em] opacity-80">
              {isHorizon ? "Blue Cross Blue Shield of New Jersey" : "Healthcare Network"}
            </p>
          </div>
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
            <ShieldCheck className="h-5 w-5 text-white/90" />
          </div>
        </div>

        {/* MIDDLE ROW: MEMBER INFO */}
        <div className="space-y-3">
          <div>
            <p className="text-[7px] font-black uppercase opacity-60 tracking-widest mb-1">Subscriber / Member</p>
            <p className="text-lg font-black uppercase tracking-tight italic">{patientName}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[7px] font-black uppercase opacity-60 tracking-widest mb-1">Member ID</p>
              <p className="text-sm font-mono font-black tracking-widest">{insurance?.policyNumber || "HZN-9923847"}</p>
            </div>
            <div>
              <p className="text-[7px] font-black uppercase opacity-60 tracking-widest mb-1">Group No.</p>
              <p className="text-sm font-mono font-black tracking-widest">{insurance?.groupNumber || "NJ-4402"}</p>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: COPAYS & CHIP */}
        <div className="flex justify-between items-end pt-2 border-t border-white/10">
          <div className="flex gap-4">
            <div className="text-left">
              <p className="text-[6px] font-black uppercase opacity-50">Office</p>
              <p className="text-[10px] font-black italic">$25</p>
            </div>
            <div className="text-left">
              <p className="text-[6px] font-black uppercase opacity-50">ER Visit</p>
              <p className="text-[10px] font-black italic">${insurance?.coPayAmount || "150"}</p>
            </div>
            <div className="text-left">
              <p className="text-[6px] font-black uppercase opacity-50">Urgent</p>
              <p className="text-[10px] font-black italic">$50</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
             <div className="h-6 w-8 bg-linear-to-r from-amber-200 to-amber-500 rounded-sm opacity-30 shadow-inner" />
             <p className="text-[5px] font-mono opacity-40">BCBSNJ-PPO-2026-v4</p>
          </div>
        </div>
      </div>
    </div>
  );
}