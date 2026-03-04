"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Pill } from "lucide-react";

// Define the strict type based on your schema
interface Medication {
  name: string;
  dose: string;
  route: string;
  frequency: number; // in minutes
  lastAdministered: number; // timestamp
}

export default function MedTimer({ med }: { med: Medication }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTime = () => {
      const nextDose = med.lastAdministered + (med.frequency * 60000);
      const diff = nextDose - Date.now();
      setTimeLeft(diff > 0 ? diff : 0);
    };

    calculateTime();
    // Update every 30s to save on re-renders while keeping clinical accuracy
    const interval = setInterval(calculateTime, 30000); 
    return () => clearInterval(interval);
  }, [med.lastAdministered, med.frequency]);

  const totalMinutesLeft = Math.floor(timeLeft / 60000);
  const hours = Math.floor(totalMinutesLeft / 60);
  const mins = totalMinutesLeft % 60;
  
  const isDue = timeLeft <= 0;

  return (
    <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-500 ${
      isDue ? "bg-red-50 border-red-200 animate-pulse shadow-sm" : "bg-slate-50 border-slate-100"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${isDue ? "bg-red-100" : "bg-blue-100"}`}>
          <Pill className={`h-4 w-4 ${isDue ? "text-red-600" : "text-blue-600"}`} />
        </div>
        <div className="text-left">
          <p className="text-[11px] font-black uppercase text-slate-800 leading-none tracking-tight">
            {med.name}
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
            {med.dose} • {med.route}
          </p>
        </div>
      </div>

      <div className="text-right">
        {isDue ? (
          <Badge className="bg-red-600 text-white border-none text-[8px] font-black uppercase tracking-widest px-2">
            Due Now
          </Badge>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock className="h-3 w-3" />
            <span className="text-[10px] font-black tabular-nums">
              {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}