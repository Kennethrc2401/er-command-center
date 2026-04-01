"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useReactToPrint } from "react-to-print";

// UI Components
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Icons
import { 
  Printer, 
  LogOut, 
  CalendarDays, 
  PenTool,
  Eraser
} from "lucide-react";
import SignatureCanvas from "react-signature-canvas";

export default function DischargeSummary({ encounterId }: { encounterId: Id<"encounters"> }) {
  const [summary, setSummary] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  
  const printRef = useRef<HTMLDivElement>(null);
  const sigPad = useRef<SignatureCanvas>(null);

  // DATA QUERIES
  const encounter = useQuery(api.encounters.getById, encounterId ? { encounterId } : "skip");
  const patient = useQuery(api.patients.getById, encounter?.patientId ? { patientId: encounter.patientId } : "skip");
  const lastVitals = useQuery(api.vitals.getHistory, encounterId ? { encounterId } : "skip");
  const prescribedMeds = useQuery(api.medications.getByEncounter, encounterId ? { encounterId } : "skip");
  const finalizeDischarge = useMutation(api.encounters.dischargePatient);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Discharge_Summary_${patient?.name || "Patient"}`,
  });

  const clearSignature = () => {
    sigPad.current?.clear();
    setSignatureData(null);
  };

  const saveSignature = () => {
    if (sigPad.current?.isEmpty()) {
      toast.error("Please provide a signature first.");
      return;
    }
    setSignatureData(sigPad.current?.getTrimmedCanvas().toDataURL("image/png") || null);
    toast.success("Signature captured.");
  };

  const generateTemplate = () => {
    if (!encounter || !patient) return toast.error("Clinical records not fully loaded.");

    const latest = lastVitals?.[lastVitals.length - 1];
    const homeMeds = prescribedMeds && prescribedMeds.length > 0 
      ? prescribedMeds.filter(m => m.status !== "held").map((m) => `• ${m.name} ${m.dosage} (${m.route})`).join('\n')
      : "No new medications prescribed. Continue current home regimen.";

    const dateString = followUpDate 
      ? new Date(followUpDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : "[DATE NOT SPECIFIED]";

    const template = `------------------------------------------------------------
OFFICIAL PATIENT DISCHARGE INSTRUCTIONS
------------------------------------------------------------
FACILITY: Hackensack Meridian ER - Unit 4B
PATIENT: ${patient.name}
MRN: ${patient.mrn}
DATE: ${new Date().toLocaleDateString()}

REASON FOR VISIT: ${encounter.chiefComplaint}

CLINICAL STATUS AT DISCHARGE:
Heart Rate: ${latest?.hr || '--'} BPM | SpO2: ${latest?.spO2 || '--'}%

HOME MEDICATIONS & INSTRUCTIONS:
${homeMeds}

FOLLOW-UP CARE:
>>> SCHEDULED FOLLOW-UP: ${dateString} <<<

RED FLAGS: Return to ER for chest pain, shortness of breath, or high fever.
------------------------------------------------------------`;
    
    setSummary(template);
  };

  return (
    <div className="space-y-6">
      {/* SETTINGS & SIGNATURE CAPTURE (Hidden in Print) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 no-print">
        <Card className="border-emerald-200 bg-emerald-50/20">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-emerald-800 flex items-center gap-1.5 tracking-widest">
                <CalendarDays className="h-3 w-3" /> Follow-Up Date
              </label>
              <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="bg-white" />
            </div>
            <Button onClick={generateTemplate} className="w-full bg-emerald-600 hover:bg-emerald-700 font-black uppercase text-[10px] tracking-widest">
              Generate Template
            </Button>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/20">
          <CardContent className="pt-6 space-y-2">
            <label className="text-[10px] font-black uppercase text-blue-800 flex items-center gap-1.5 tracking-widest">
              <PenTool className="h-3 w-3" /> Patient Acknowledgment Signature
            </label>
            <div className="bg-white border-2 border-blue-100 rounded-xl overflow-hidden">
              <SignatureCanvas 
                ref={sigPad}
                penColor="black"
                canvasProps={{ className: "w-full h-24" }}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearSignature} className="flex-1 text-[10px] font-bold uppercase">
                <Eraser className="h-3 w-3 mr-2"/> Clear</Button>
              <Button size="sm" onClick={saveSignature} className="flex-1 bg-blue-600 text-[10px] font-bold uppercase tracking-widest">Confirm Sig</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* THE PRINTABLE DOCUMENT */}
      
      <Card className="border-slate-900 border-t-8 shadow-2xl relative print:shadow-none">
        <CardContent className="pt-10 p-12" ref={printRef}>
          <div className="hidden print:block border-b-2 border-black pb-4 mb-8">
            <h1 className="text-2xl font-black uppercase tracking-tighter">Hackensack Meridian Health</h1>
            <p className="text-xs font-bold uppercase text-slate-500 italic">Official Clinical Record</p>
          </div>

          <Textarea 
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="min-h-100 font-mono text-xs border-none leading-relaxed bg-transparent resize-none print:text-[11pt]"
          />

          {/* SIGNATURE DISPLAY ON THE DOCUMENT */}
          <div className="mt-12 border-t-2 border-slate-100 pt-8 flex justify-between items-end">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400">Electronic Validation</p>
              <p className="text-[9px] font-mono text-slate-400">UUID: {encounterId.slice(0,12)}</p>
            </div>
            
            <div className="text-center">
              {signatureData ? (
                <Image src={signatureData} alt="Patient Signature" width={192} height={64} unoptimized className="h-16 w-auto mx-auto mb-1" />
              ) : (
                <div className="h-16 w-48 border-b border-dashed border-slate-300 mb-1 flex items-center justify-center">
                  <span className="text-[9px] text-slate-300 uppercase font-black">Waiting for signature...</span>
                </div>
              )}
              <p className="text-[10px] font-black uppercase border-t border-slate-900 pt-1">Patient/Guardian Signature</p>
            </div>
          </div>
        </CardContent>

        {/* Action Footer (Hidden in Print) */}
        <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-4 border-t pt-6 border-slate-100 no-print">
          
          {/* UTILIZING THE ALERT CIRCLE HELPER */}
          <div className="flex items-start gap-3 max-w-100 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-600 tracking-tight">Clinical Verification Required</p>
              <p className="text-[9px] text-slate-500 leading-tight italic">
                By clicking &quot;Finalize,&quot; you certify that the Red Flags and follow-up instructions 
                were reviewed verbally with the patient and they expressed understanding.
              </p>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <Button 
              variant="outline" 
              onClick={() => handlePrint()} 
              disabled={!summary || !signatureData}
              className="flex-1 md:flex-none gap-2 font-black uppercase text-[10px] tracking-widest border-slate-300"
            >
              <Printer className="h-3.5 w-3.5" /> Print Signed PDF
            </Button>
            <Button 
              onClick={async () => {
                await finalizeDischarge({ encounterId, summary });
                toast.success("Record Finalized & Locked");
              }} 
              disabled={!summary || !signatureData}
              className="flex-1 md:flex-none bg-slate-900 hover:bg-black gap-2 font-black uppercase text-[10px] tracking-widest px-8 shadow-xl transition-all active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5 text-emerald-400" /> Finalize Encounter
            </Button>
          </div>
        </div>
      </Card>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          textarea { border: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

// Small helper for instructions
function AlertCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}