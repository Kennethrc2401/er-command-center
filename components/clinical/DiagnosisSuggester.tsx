import { Lightbulb } from "lucide-react";
import { getDiagnosisSuggestions, VitalsData } from "@/lib/hooks/diagnosisLogic";

interface DiagnosisSuggesterProps {
  encounter: {
    chiefComplaint: string;
    vitals: VitalsData;
  };
}

export default function DiagnosisSuggester({ encounter }: DiagnosisSuggesterProps) {
  const suggestions = getDiagnosisSuggestions(encounter.chiefComplaint, encounter.vitals);

  if (suggestions.length === 0) return null;

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Lightbulb className="h-3 w-3 text-amber-500 fill-amber-500" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clinical Suggestions</span>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {suggestions.map((s) => (
          <button
            key={s.code}
            className="group flex flex-col items-start p-4 rounded-2xl border bg-white hover:border-blue-500 hover:shadow-md transition-all text-left"
          >
            <div className="flex justify-between w-full mb-1">
              <span className="font-mono font-black text-blue-600 text-xs">{s.code}</span>
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                s.priority === "High" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
              }`}>
                {s.priority} Priority
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-800 leading-tight">{s.description}</p>
            <p className="text-[9px] text-slate-400 mt-2 italic">{s.reason}</p>
          </button>
        ))}
      </div>
    </div>
  );
}