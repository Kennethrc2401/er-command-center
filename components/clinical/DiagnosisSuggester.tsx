"use client";

import { useState } from "react";
import { Lightbulb, ChevronRight } from "lucide-react";
import { getDiagnosisSuggestions, VitalsData, DiagnosisSuggestion } from "@/lib/hooks/diagnosisLogic";

interface DiagnosisSuggesterProps {
  encounter: {
    chiefComplaint: string;
    vitals: VitalsData;
  };
  onSelectDiagnosis?: (orders: string[]) => void;
}

export default function DiagnosisSuggester({ encounter, onSelectDiagnosis }: DiagnosisSuggesterProps) {
  const suggestions = getDiagnosisSuggestions(encounter.chiefComplaint, encounter.vitals);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  if (suggestions.length === 0) return null;

  const handleSelect = (s: DiagnosisSuggestion) => {
    setSelectedCode(s.code);
    onSelectDiagnosis?.(s.suggestedOrders);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Lightbulb className="h-3 w-3 text-amber-500 fill-amber-500" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clinical Suggestions</span>
        {selectedCode && (
          <span className="ml-auto text-[8px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
            Orders highlighted ↓
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {suggestions.map((s) => {
          const isSelected = selectedCode === s.code;
          return (
            <button
              key={s.code}
              onClick={() => handleSelect(s)}
              className={`group flex flex-col items-start p-4 rounded-2xl border-2 transition-all text-left ${
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                  : "border-slate-100 bg-white hover:border-blue-300 hover:shadow-sm"
              }`}
            >
              <div className="flex justify-between w-full mb-1">
                <span className={`font-mono font-black text-xs ${isSelected ? "text-blue-700" : "text-blue-600"}`}>
                  {s.code}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                    s.priority === "High" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
                  }`}>
                    {s.priority}
                  </span>
                  {s.suggestedOrders.length > 0 && (
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-500">
                      {s.suggestedOrders.length} order{s.suggestedOrders.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
              <p className={`text-[11px] font-bold leading-tight ${isSelected ? "text-blue-900" : "text-slate-800"}`}>
                {s.description}
              </p>
              <p className="text-[9px] text-slate-400 mt-1.5 italic leading-relaxed">{s.reason}</p>
              {s.suggestedOrders.length > 0 && (
                <div className={`mt-2 flex items-center gap-1 text-[9px] font-black uppercase tracking-wide ${isSelected ? "text-blue-600" : "text-slate-400 group-hover:text-blue-500"} transition-colors`}>
                  <ChevronRight className="h-3 w-3" />
                  {isSelected ? "Orders highlighted in Order Entry below" : "Click to highlight suggested orders"}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
