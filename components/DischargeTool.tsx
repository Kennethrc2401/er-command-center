"use client";

import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Home, AlertTriangle, Stethoscope } from "lucide-react";

export default function DischargeTool({ encounterId }: { encounterId: Id<"encounters"> }) {
  // Logic to pull diagnosis from notes and generate take-home plan
  return (
    <Card className="border-slate-200 bg-white overflow-hidden rounded-3xl" data-encounter-id={encounterId}>
      <CardHeader className="bg-slate-900 text-white p-6">
        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
          <Home className="h-4 w-4 text-emerald-400" /> Patient Discharge Instructions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
            <Stethoscope className="h-3 w-3" /> Your Diagnosis & Care Plan
          </h4>
          <p className="text-sm text-slate-700 leading-relaxed font-serif italic border-l-4 border-blue-500 pl-4 py-1">
            &quot;You were treated today for acute viral bronchitis. We recommend rest, increased fluid intake, and over-the-counter cough suppressants as discussed.&quot;
          </p>
        </div>

        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 space-y-3">
          <h4 className="text-[10px] font-black uppercase text-red-600 tracking-widest flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> When to return to the ER
          </h4>
          <ul className="text-xs text-red-700 space-y-2 font-bold">
            <li>• Shortness of breath that worsens at rest</li>
            <li>• Chest pain or pressure</li>
            <li>• Fever higher than 103°F</li>
            <li>• Inability to keep fluids down</li>
          </ul>
        </div>

        <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2">
          <Printer className="h-4 w-4" /> Print Instructions for Patient
        </Button>
      </CardContent>
    </Card>
  );
}