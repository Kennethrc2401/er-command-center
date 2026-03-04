"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Calendar, Stethoscope, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function PatientHistory({ patientId }: { patientId: Id<"patients"> }) {
  const history = useQuery(api.encounters.getByPatient, { patientId });

  if (history === undefined) return <div className="p-8 text-center animate-pulse text-slate-400">Loading clinical history...</div>;
  if (history.length === 0) return <div className="p-8 text-center text-slate-500 border rounded-xl border-dashed">No prior encounters found.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          Encounter History
        </h3>
        <span className="text-xs font-medium text-slate-400">{history.length} Total Visits</span>
      </div>

      <div className="grid gap-3">
        {history.map((encounter) => (
          <div 
            key={encounter._id} 
            className="group p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                  <Stethoscope className="h-4 w-4 text-slate-600 group-hover:text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 capitalize">{encounter.chiefComplaint}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {new Date(encounter._creationTime).toLocaleDateString()} • ESI Level {encounter.acuity}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  encounter.status === 'discharged' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'
                }`}>
                  {encounter.status}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}