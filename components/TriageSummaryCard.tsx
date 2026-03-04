"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Activity, Clock, MapPin, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePresentationMode } from "@/lib/hooks/usePresentationMode";

interface TriageSummaryProps {
  criticalPatient?: {
    _id: string;
    patientId: string;
    patientName: string;
    acuity: number;
    chiefComplaint: string;
    location?: string;
    vitals: { hr: number; bp: string; spO2: number };
    _creationTime: number;
  };
}

export default function TriageSummaryCard({ criticalPatient }: TriageSummaryProps) {
  const [waitTime, setWaitTime] = useState(0);
  const { isDemoMode } = usePresentationMode();

  useEffect(() => {
    if (!criticalPatient) {
      return;
    }

    const calculateWaitTime = () => {
      setWaitTime(Math.floor((Date.now() - criticalPatient._creationTime) / 60000));
    };

    calculateWaitTime();
    const interval = setInterval(calculateWaitTime, 60000);

    return () => clearInterval(interval);
  }, [criticalPatient]);

  if (!criticalPatient) {
    return null;
  }

  const formatPatientName = (name: string) => {
      if (!isDemoMode) return name;
      
      const parts = name.trim().split(/\s+/);
      if (parts.length > 1) {
        // Returns "S. Ramirez"
        return `${parts[0][0]}. ${parts[1]}`;
      }
      // Fallback if there's only one name
      return `Patient-${name.length}${name.charCodeAt(0)}`; 
    };
    
  return (
    <Card className="border-none bg-slate-900 text-white shadow-2xl rounded-[2.5rem] overflow-hidden mb-8 relative">
      {/* Background Pulse Effect */}
      <div className="absolute top-0 right-0 p-8 opacity-10">
        <AlertCircle className="h-32 w-32 animate-pulse text-red-500" />
      </div>

      <CardContent className="p-8 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge className="bg-red-600 text-white border-none px-3 py-1 text-[10px] font-black uppercase animate-bounce tracking-widest">
                High Acuity Alert
              </Badge>
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <Clock className="h-3.5 w-3.5" /> Rooming Delay: {waitTime}m
              </div>
            </div>

            <div>
              <h2 className="text-4xl font-black tracking-tighter uppercase leading-none italic">
                {formatPatientName(criticalPatient.patientName)}
              </h2>
              <p className="text-blue-400 font-bold text-sm mt-2 flex items-center gap-2 uppercase tracking-tight">
                <Activity className="h-4 w-4" /> Chief Complaint: {criticalPatient.chiefComplaint}
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="bg-slate-800 px-4 py-2 rounded-2xl border border-slate-700">
                <p className="text-[8px] font-black text-slate-500 uppercase">Heart Rate</p>
                <p className={`text-lg font-black ${criticalPatient.vitals.hr > 120 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {criticalPatient.vitals.hr} <span className="text-[10px] text-slate-500">BPM</span>
                </p>
              </div>
              <div className="bg-slate-800 px-4 py-2 rounded-2xl border border-slate-700">
                <p className="text-[8px] font-black text-slate-500 uppercase">Oxygen</p>
                <p className={`text-lg font-black ${criticalPatient.vitals.spO2 < 92 ? 'text-red-500' : 'text-white'}`}>
                  {criticalPatient.vitals.spO2}% <span className="text-[10px] text-slate-500">SpO2</span>
                </p>
              </div>
              <div className="bg-slate-800 px-4 py-2 rounded-2xl border border-slate-700">
                <p className="text-[8px] font-black text-slate-500 uppercase">Location</p>
                <p className="text-lg font-black flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-500" />
                  {criticalPatient.location || "UNASSIGNED"}
                </p>
              </div>
            </div>
          </div>

          <Link href={`/patient/${criticalPatient.patientId}`} className="w-full md:w-auto">
            <button className="w-full md:w-auto px-8 py-6 bg-blue-600 hover:bg-white hover:text-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 group shadow-xl shadow-blue-900/20">
              Immediate Intervention <ArrowRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" />
            </button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}