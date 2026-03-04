"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scan, FileSearch, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export default function ImagingResults({ encounterId }: { encounterId: Id<"encounters"> }) {
  const studies = useQuery(api.imaging.getByEncounter, { encounterId });

  if (!studies) return (
    <div className="animate-pulse space-y-4">
      <div className="h-32 bg-slate-100 rounded-[2rem]" />
    </div>
  );

  return (
    <div className="space-y-6">
      {studies.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-[2.5rem] bg-slate-50/50 text-slate-400">
          <Scan className="h-10 w-10 mb-2 opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-widest">No Imaging Studies Found</p>
        </div>
      ) : (
        studies.map((study) => (
          <Card key={study._id} className="border-slate-200 shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className={`p-6 flex flex-row items-center justify-between border-b ${
              study.status === "Resulted" ? "bg-blue-600 text-white" : "bg-slate-50"
            }`}>
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-2xl ${study.status === "Resulted" ? "bg-white/20" : "bg-slate-200"}`}>
                  <Scan className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs font-black uppercase tracking-widest">
                      {study.studyName}
                    </CardTitle>
                    {study.priority === "STAT" && (
                      <Badge className="bg-red-500 text-white border-none text-[8px] font-black animate-pulse">
                        STAT
                      </Badge>
                    )}
                  </div>
                  <p className={`text-[10px] font-bold uppercase mt-1 ${
                    study.status === "Resulted" ? "text-blue-100" : "text-slate-500"
                  }`}>
                    Modality: {study.modality} • Reason: {study.reason}
                  </p>
                </div>
              </div>
              
              <Badge className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                study.status === "Resulted" ? "bg-emerald-500 text-white border-none" : "bg-amber-100 text-amber-700 border-amber-200"
              }`}>
                {study.status === "Resulted" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                {study.status}
              </Badge>
            </CardHeader>

            <CardContent className="p-8">
              {study.status !== "Resulted" ? (
                <div className="flex flex-col items-center py-6 text-center space-y-2">
                  <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-infinite-scroll w-1/2" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 italic">
                    {study.status === "Ordered" ? "Awaiting transport to Radiology..." : "Images captured. Awaiting Radiologist interpretation."}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 relative">
                    <div className="absolute -top-3 left-6 px-3 py-1 bg-white border border-slate-200 rounded-full">
                      <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
                        <FileSearch className="h-3 w-3" /> Final Radiologist Report
                      </h4>
                    </div>
                    <p className="text-sm font-black text-slate-900 leading-relaxed uppercase tracking-tight pt-2">
                      {study.report || "Final report text missing from record."}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">
                    <span>Ordered: {new Date(study.orderedAt).toLocaleString()}</span>
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Verified by Radiology Dept
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}