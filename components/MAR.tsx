"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { checkAllergyConflict } from "@/lib/safety";
import { AlertCircle, CheckCircle2, Pill } from "lucide-react";

interface MARProps {
  encounterId: Id<"encounters">;
  patientAllergies: string[];
}

export default function MAR({ encounterId, patientAllergies }: MARProps) {
  const meds = useQuery(api.medications.getByEncounter, { encounterId });
  const administer = useMutation(api.medications.administer);

  // Filter meds into two buckets: Pending and Completed
  const pendingMeds = meds?.filter((m) => m.status === "ordered") ?? [];
  const completedMeds = meds?.filter((m) => m.status === "administered") ?? [];

  return (
    <Card className="shadow-lg border-slate-200">
      <CardHeader className="bg-slate-50/50 border-b">
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <Pill className="h-5 w-5 text-blue-600" />
          Medication Administration Record (MAR)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        
        {/* SECTION: PENDING MEDICATIONS */}
        <div className="p-4 border-b bg-white">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
            Active Orders
          </h3>
          <div className="space-y-3">
            {pendingMeds.length === 0 && (
              <p className="text-sm text-slate-500 italic">No active medication orders.</p>
            )}
            {pendingMeds.map((med) => {
              const { hasConflict, allergen } = checkAllergyConflict(patientAllergies, med.name);

              return (
                <div 
                  key={med._id} 
                  className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                    hasConflict ? "border-red-200 bg-red-50" : "border-slate-100 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex gap-4 items-start">
                    <div className={`p-2 rounded-full ${hasConflict ? "bg-red-100" : "bg-blue-100"}`}>
                      <Pill className={`h-4 w-4 ${hasConflict ? "text-red-600" : "text-blue-600"}`} />
                    </div>
                    <div>
                      <p className={`font-bold ${hasConflict ? "text-red-900" : "text-slate-900"}`}>
                        {med.name} {med.dosage}
                      </p>
                      <p className="text-xs text-slate-500">Route: {med.route} | Ordered by: {med.orderedBy}</p>
                      
                      {hasConflict && (
                        <div className="flex items-center gap-1 mt-2 text-red-600 font-bold text-[10px] animate-pulse">
                          <AlertCircle className="h-3 w-3" />
                          CONTRAINDICATED: Patient Allergic to {allergen}
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    disabled={hasConflict}
                    onClick={() => administer({ medicationId: med._id })}
                    className={hasConflict ? "bg-slate-200 text-slate-500" : "bg-emerald-600 hover:bg-emerald-700"}
                  >
                    {hasConflict ? "Blocked" : "Administer"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION: COMPLETED MEDICATIONS */}
        <div className="p-4 bg-slate-50/30">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
            Administered History
          </h3>
          <div className="space-y-2">
            {completedMeds.map((med) => (
              <div key={med._id} className="flex items-center justify-between p-3 rounded border bg-white opacity-80">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{med.name} {med.dosage}</p>
                    <p className="text-[10px] text-slate-400">
                      Given {new Date(med.adminTime!).toLocaleTimeString()} by {med.adminBy}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100">
                  Confirmed
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}