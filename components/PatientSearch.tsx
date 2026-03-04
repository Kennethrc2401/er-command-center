"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input"; // Assuming shadcn
import { Card } from "@/components/ui/card";

export default function PatientSearch() {
  const [term, setTerm] = useState("");
  const router = useRouter();
  
  // Real-time search results as you type
  const results = useQuery(api.patients.search, { searchTerm: term });

  return (
    <div className="relative w-full max-w-md">
      <Input
        type="text"
        placeholder="Search Patient Name or MRN..."
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        className="h-12 text-lg shadow-sm"
      />

      {term.length > 0 && (
        <Card className="absolute top-14 w-full z-50 shadow-xl border-slate-200">
          <div className="p-2">
            {results?.length === 0 && (
              <p className="p-4 text-sm text-slate-500">No patients found.</p>
            )}
            
            {results?.map((patient) => (
              <button
                key={patient._id}
                onClick={() => router.push(`/patient/${patient._id}`)}
                className="w-full text-left p-3 hover:bg-slate-100 rounded flex justify-between items-center transition-colors"
              >
                <div>
                  <p className="font-bold text-slate-900">{patient.name}</p>
                  <p className="text-xs text-slate-500 font-mono">MRN: {patient.mrn}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">DOB: {patient.dob}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}