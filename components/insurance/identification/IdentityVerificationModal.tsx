"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserCheck, ShieldAlert, CheckCircle2, IdCard } from "lucide-react";
import VirtualInsuranceCard from "../finances/VirtualInsuranceCard";

interface Patient {
  name: string;
  dob: string;
}

interface Insurance {
  [key: string]: unknown;
}

export default function IdentityVerificationModal({ patient, insurance }: { patient: Patient, insurance: Insurance }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center justify-center gap-2 py-4 bg-slate-100 text-slate-500 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all italic border border-slate-200 w-full">
          <IdCard className="h-4 w-4" /> Verify Legal ID
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-white border-none rounded-[3rem] p-10 overflow-hidden">
        <DialogHeader className="mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Patient Identity Audit</DialogTitle>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Compliance Protocol: Red Flag Rule 114</p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* LEFT: MOCK NJ DRIVER'S LICENSE */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Government Issued ID (Scan)</p>
            <div className="relative aspect-[1.58/1] w-full rounded-2xl bg-linear-to-br from-yellow-50 to-amber-100 border-2 border-amber-200/50 p-6 shadow-xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-8 bg-blue-800 flex items-center px-4">
                <span className="text-[8px] font-black text-white tracking-widest">NEW JERSEY DRIVER LICENSE</span>
              </div>
              <div className="mt-6 flex gap-4">
                <div className="w-24 h-30 bg-slate-200 rounded-lg flex items-center justify-center border border-amber-300/50 grayscale">
                  <span className="text-4xl font-black text-slate-400">{patient.name.charAt(0)}</span>
                </div>
                <div className="flex-1 space-y-2 pt-2">
                  <p className="text-[10px] font-black text-blue-900 tracking-tighter uppercase">{patient.name}</p>
                  <p className="text-[8px] font-bold text-slate-600 uppercase">DOB: {new Date(patient.dob).toLocaleDateString()}</p>
                  <p className="text-[7px] font-medium text-slate-500 leading-tight">123 HOSPITAL PLAZA<br/>HACKENSACK, NJ 07601</p>
                  <div className="pt-2">
                    <p className="text-[6px] font-black text-red-600">DL NO. S1234-56789-01234</p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-2 right-4 opacity-10">
                <div className="h-12 w-12 rounded-full border-4 border-blue-900" />
              </div>
            </div>
          </div>

          {/* RIGHT: VIRTUAL INSURANCE CARD */}
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Payer Documentation (Primary)</p>
            <VirtualInsuranceCard insurance={insurance} patientName={patient.name} />
          </div>
        </div>

        {/* AUDIT CHECKLIST */}
        <div className="mt-10 bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
          <div className="grid grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-[9px] font-black uppercase text-slate-600">Name Match</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-[9px] font-black uppercase text-slate-600">DOB Verified</span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-4 w-4 text-blue-500" />
              <span className="text-[9px] font-black uppercase text-slate-600">Address Update Required</span>
            </div>
          </div>
        </div>

        <button className="w-full mt-8 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">
          Confirm Audit & Save to Chart
        </button>
      </DialogContent>
    </Dialog>
  );
}