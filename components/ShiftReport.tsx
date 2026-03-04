"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
   Activity, Pill,  
  ClipboardList, AlertTriangle, Printer 
} from "lucide-react";

interface ShiftReportProps {
  patient: {
    name: string;
    mrn: string;
    dob: string;
    codeStatus: string;
    allergies: string[];
  };
  encounter: {
    chiefComplaint: string;
    acuity: number;
    location?: string;
    vitals: {
      hr: number;
      bp: string;
      spO2: number;
    };
  };
  medsDue: Array<{ name: string; dose: string; time: string }>;
  pendingTasks: number;
}

export default function ShiftReport({ patient, encounter, medsDue, pendingTasks }: ShiftReportProps) {
  return (
    <Card className="border-2 border-slate-900 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white max-w-2xl mx-auto print:shadow-none print:border-slate-300">
      <CardHeader className="bg-slate-900 text-white p-8">
        <div className="flex justify-between items-start">
          <div>
            <Badge className="bg-blue-500 text-white border-none mb-3 text-[10px] font-black uppercase tracking-widest">
              Shift Handoff Summary
            </Badge>
            <CardTitle className="text-3xl font-black tracking-tighter uppercase leading-none">
              {patient.name}
            </CardTitle>
            <p className="text-slate-400 text-[10px] font-bold mt-2 tracking-widest uppercase">
              MRN: {patient.mrn} • DOB: {new Date(patient.dob).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <div className={`px-4 py-2 rounded-2xl font-black text-xs uppercase border-2 ${
              encounter.acuity <= 2 ? "border-red-500 text-red-500" : "border-blue-500 text-blue-500"
            }`}>
              ESI Level {encounter.acuity}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-8 space-y-8">
        {/* ROW 1: SAFETY & VITALS */}
        <div className="grid grid-cols-2 gap-8">
          <section className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-red-500" /> Safety Flags
            </h4>
            <div className="space-y-2">
              <p className="text-xs font-black text-slate-700 uppercase tracking-tight">
                Code: <span className="text-blue-600">{patient.codeStatus}</span>
              </p>
              <p className="text-xs font-black text-slate-700 uppercase tracking-tight">
                Allergies: <span className="text-red-600">{patient.allergies.join(", ") || "NKDA"}</span>
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-3 w-3 text-emerald-500" /> Latest Vitals
            </h4>
            <div className="text-[11px] font-bold text-slate-600 grid grid-cols-2 gap-2">
              <span>BP: {encounter.vitals.bp}</span>
              <span>HR: {encounter.vitals.hr}</span>
              <span>O2: {encounter.vitals.spO2}%</span>
              <span>Loc: {encounter.location || "Bedside"}</span>
            </div>
          </section>
        </div>

        <hr className="border-dashed border-slate-200" />

        {/* ROW 2: MEDS & TASKS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Pill className="h-3 w-3 text-blue-500" /> Medications Due
            </h4>
            <div className="space-y-2">
              {medsDue.length > 0 ? medsDue.map((med, i) => (
                <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-black text-slate-700">{med.name} ({med.dose})</span>
                  <span className="text-[9px] font-bold text-blue-600 uppercase">{med.time}</span>
                </div>
              )) : <p className="text-[10px] font-bold text-slate-400 italic uppercase">No meds due this shift</p>}
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <ClipboardList className="h-3 w-3 text-purple-500" /> Handoff To-Do
            </h4>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 min-h-20">
              <p className="text-xs font-bold text-slate-600 leading-relaxed uppercase tracking-tight">
                {pendingTasks > 0 
                  ? `${pendingTasks} tasks remaining (Labs/Imaging). Ensure morning labs are drawn.`
                  : "Workup complete. Patient stable for transfer/discharge."}
              </p>
            </div>
          </section>
        </div>

        <button 
          onClick={() => window.print()}
          className="w-full py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl flex items-center justify-center gap-3 transition-all print:hidden"
        >
          <Printer className="h-4 w-4 text-slate-600" />
          <span className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em]">Print Handoff Sheet</span>
        </button>
      </CardContent>
    </Card>
  );
}