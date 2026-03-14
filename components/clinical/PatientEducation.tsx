"use client";

import { QRCodeSVG } from "qrcode.react";
import { GET_INSTRUCTIONS } from "@/lib/helpers/education";
import { Smartphone, Share2, Printer } from "lucide-react";

interface PatientEducationProps {
  encounter: {
    _id: string;
    chiefComplaint: string;
  };
  patient?: unknown;
}

export default function PatientEducation({ encounter }: PatientEducationProps) {
  const info = GET_INSTRUCTIONS(encounter.chiefComplaint);
  
  // This would be the URL to your deployed patient-facing route
  const shareableUrl = `https://your-nexus-app.vercel.app/patient-portal/${encounter._id}`;

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-8">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-purple-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patient Education Portal</span>
        </div>
        <button className="print:hidden text-slate-300 hover:text-blue-600 transition-colors">
          <Printer className="h-4 w-4" />
        </button>
      </header>

      <div className="flex flex-col gap-6 items-stretch">
        {/* THE QR CODE */}
        <div className="self-center bg-slate-50 p-6 rounded-[2rem] border-2 border-dashed border-slate-200">
          <QRCodeSVG 
            value={shareableUrl} 
            size={160}
            bgColor={"#f8fafc"}
            fgColor={"#0f172a"}
            level={"H"}
            includeMargin={false}
          />
        </div>

        {/* INSTRUCTIONS PREVIEW */}
        <div className="flex-1 space-y-4">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">{info.title}</h3>
          <ul className="space-y-3">
            {info.instructions.map((step, i) => (
              <li key={i} className="flex gap-3 text-[11px] font-medium text-slate-500 leading-relaxed">
                <div className="h-4 w-4 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[8px] font-black shrink-0 mt-0.5">
                  {i + 1}
                </div>
                {step}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100 flex items-center gap-4">
        <div className="h-10 w-10 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-200">
          <Share2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-purple-900 leading-tight">Instant Mobile Access</p>
          <p className="text-[9px] font-medium text-purple-700 mt-1">
            Patient can scan this code to take these instructions and their discharge summary home on their smartphone.
          </p>
        </div>
      </div>
    </div>
  );
}