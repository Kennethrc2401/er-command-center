"use client";

import { Printer, ArrowLeft, ShieldCheck, Calendar } from "lucide-react";
import { toast } from "sonner";

interface DischargeSummaryPatient {
  name: string;
  gender: string;
  dob: string;
  mrn: string;
}

interface DischargeSummaryEncounter {
  chiefComplaint: string;
  vitals: {
    bp: string;
    hr: string | number;
    spO2: string | number;
    temp: string | number;
  };
  _id: string;
}

interface DischargeSummaryProps {
  patient: DischargeSummaryPatient;
  encounter: DischargeSummaryEncounter;
  onClose: () => void;
}

export default function DischargeSummary({ patient, encounter, onClose }: DischargeSummaryProps) {
  const handlePrint = () => {
    window.print();
    toast.success("Sending to printer...");
  };

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="fixed inset-0 bg-white z-500 flex flex-col overflow-y-auto">
      {/* 🛠️ NAVIGATION BAR (Hidden on Print) */}
      <nav className="print:hidden p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <button onClick={onClose} className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 hover:text-slate-900 transition-all">
          <ArrowLeft className="h-4 w-4" /> Back to Chart
        </button>
        <button 
          onClick={handlePrint}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-700 transition-all"
        >
          <Printer className="h-4 w-4" /> Print Discharge Papers
        </button>
      </nav>

      {/* 📄 THE ACTUAL DOCUMENT (Print Area) */}
      <main className="max-w-4xl mx-auto w-full p-12 space-y-10 print:p-0 print:text-black">
        
        {/* HOSPITAL LETTERHEAD */}
        <header className="flex justify-between items-start border-b-4 border-slate-900 pb-8">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">Nexus <span className="text-blue-600">Health</span></h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Emergency Medicine Division • Hackensack, NJ</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-black uppercase">Visit Summary</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{today}</p>
          </div>
        </header>

        {/* PATIENT IDENTITY STRIP */}
        <section className="grid grid-cols-2 gap-8 bg-slate-50 p-8 rounded-3xl border border-slate-100 print:bg-transparent print:border-none">
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Patient Name</p>
            <p className="text-xl font-black uppercase tracking-tight">{patient.name}</p>
            <p className="text-xs font-medium text-slate-600">{patient.gender} • DOB: {patient.dob}</p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Medical Record Number</p>
            <p className="text-xl font-black uppercase tracking-tight text-blue-600">{patient.mrn}</p>
            <p className="text-xs font-medium text-slate-600 italic">Account Status: Finalized</p>
          </div>
        </section>

        {/* CLINICAL SUMMARY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <section className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] border-b pb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Reason for Visit
            </h3>
            <p className="text-sm leading-relaxed text-slate-700">
              The patient presented to the Emergency Department with a chief complaint of <strong>{encounter.chiefComplaint}</strong>. 
              After evaluation and treatment, the patient was found stable for discharge home.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] border-b pb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" /> Follow-Up Care
            </h3>
            <ul className="text-sm space-y-2 text-slate-700 list-disc pl-4">
              <li>Follow up with your Primary Care Physician within 48-72 hours.</li>
              <li>Return to the ER immediately if symptoms worsen or new fever develops.</li>
              <li>Review all discharge medications with your local pharmacy.</li>
            </ul>
          </section>
        </div>

        {/* FINAL VITALS TABLE */}
        <section className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] border-b pb-2">Final Discharge Vitals</h3>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white print:bg-slate-100 print:text-black">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest">Blood Pressure</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest">Heart Rate</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest">SpO2</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest">Temperature</th>
              </tr>
            </thead>
            <tbody className="divide-y border-b">
              <tr>
                <td className="p-4 text-sm font-bold">{encounter.vitals.bp}</td>
                <td className="p-4 text-sm font-bold">{encounter.vitals.hr} BPM</td>
                <td className="p-4 text-sm font-bold">{encounter.vitals.spO2}%</td>
                <td className="p-4 text-sm font-bold">{encounter.vitals.temp}°F</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* FOOTER / LEGAL DISCLOSURE */}
        <footer className="pt-12 text-[9px] text-slate-400 leading-relaxed space-y-4">
          <p className="italic">
            Notice: This document contains Protected Health Information (PHI) and is protected under HIPAA regulations. 
            This summary is not a substitute for professional medical advice. Always consult your physician for changes in health status.
          </p>
          <div className="flex justify-between items-end border-t pt-8">
            <div className="space-y-1">
              <div className="h-12 w-48 border-b border-slate-300 italic text-slate-300 pt-4">Electronically Signed By</div>
              <p className="font-black uppercase tracking-widest">Attending Physician, Nexus Health ER</p>
            </div>
            <p className="font-bold uppercase tracking-widest">Document ID: {encounter._id.slice(0,8).toUpperCase()}</p>
          </div>
        </footer>
      </main>
    </div>
  );
}