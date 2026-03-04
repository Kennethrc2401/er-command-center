"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSearch, Printer, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReportProps {
  orderId: string; // Add this to your props
  studyName: string;
  modality: string;
  report?: string;
  resultedAt: number;
}

export default function ViewImagingReport({ 
  orderId,
  studyName, 
  modality, 
  report, 
  resultedAt 
}: ReportProps) {
  
  // DERIVE the ID from the database record ID. 
  // This is pure, stable, and unique. No Math.random needed!
  const referenceId = orderId.slice(-6).toUpperCase();

  const formattedDate = new Date(resultedAt).toLocaleString([], {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 text-[10px] font-black text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5"
        >
          <FileSearch className="h-3.5 w-3.5" /> View Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-150 rounded-3xl overflow-hidden p-0 bg-white">
        <DialogHeader className="p-6 bg-slate-50 border-b">
          <div className="flex justify-between items-start text-left">
            <div className="space-y-1">
              <Badge className="bg-blue-100 text-blue-700 border-none text-[9px] font-black uppercase tracking-wider">
                Final Narrative: {modality}
              </Badge>
              <DialogTitle className="text-xl font-black text-slate-800 tracking-tight">
                {studyName}
              </DialogTitle>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-slate-200">
              <Printer className="h-3.5 w-3.5 text-slate-500" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-8">
          <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 mb-8">
            <p className="text-sm font-serif leading-relaxed text-slate-700 whitespace-pre-wrap italic">
              {report || "The preliminary findings have been recorded. Full transcription pending radiologist final review."}
            </p>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center text-white">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-black text-slate-800 uppercase leading-none mb-1">
                  Dr. Julian Vance, MD
                </p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  Board Certified Radiologist
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                Resulted: {formattedDate}
              </p>
              <p className="text-[8px] text-slate-300 mt-1 font-bold uppercase tracking-tighter">
                ACCESSION: RAD-{referenceId}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}