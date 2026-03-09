"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Info } from "lucide-react";

// Updated Interface to accept both naming conventions
interface AppointmentProps {
  specialty: string;
  provider: string;
  date?: string;          // Made optional to support followUpDate
  followUpDate?: string;  // Added to match your Page.tsx data
  time: string;
  address: string;
  instructions?: string;
}

export default function FollowUpCard({ appt }: { appt: AppointmentProps }) {
  // Logic to determine which date string to use
  const rawDate = appt.followUpDate || appt.date || new Date().toISOString();
  
  const dateObj = new Date(rawDate);
  
  // Clinical Safety: Fallback for invalid date strings
  const isValidDate = !isNaN(dateObj.getTime());
  const day = isValidDate ? dateObj.toLocaleDateString('en-US', { day: '2-digit' }) : "--";
  const month = isValidDate ? dateObj.toLocaleDateString('en-US', { month: 'short' }) : "ERR";

  return (
    <Card className="border-blue-100 bg-white shadow-xl rounded-[2.5rem] overflow-hidden">
      <div className="bg-blue-600 p-4 text-center">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-100 italic">
          Scheduled Follow-Up
        </span>
      </div>
      
      <CardContent className="p-8 flex flex-col md:flex-row gap-8 items-center">
        {/* Date Icon */}
        <div className="flex flex-col items-center justify-center bg-slate-50 border-2 border-slate-100 rounded-[2rem] h-24 w-24 shrink-0 shadow-inner">
          <span className="text-[10px] font-black uppercase text-blue-600 tracking-tighter italic">{month}</span>
          <span className="text-4xl font-black text-slate-900 tracking-tighter">{day}</span>
        </div>

        {/* Details */}
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div>
            <Badge className="bg-blue-50 text-blue-700 border-none mb-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest italic">
              {appt.specialty}
            </Badge>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase italic">
              {appt.provider}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-600">{appt.time}</span>
            </div>
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-600 truncate max-w-[150px] italic">{appt.address}</span>
            </div>
          </div>

          {appt.instructions && (
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 flex items-start gap-3">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-amber-800 leading-tight uppercase tracking-tight">
                Note: {appt.instructions}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}