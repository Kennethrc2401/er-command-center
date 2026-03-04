"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, CheckCircle2, XCircle, RefreshCcw } from "lucide-react";
import { TRIAGE_SCENARIOS } from "@/lib/constants/scenarios";

export default function TriageQuiz() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const scenario = TRIAGE_SCENARIOS[index];

  const handleSelect = (level: number) => {
    setSelected(level);
    setShowResult(true);
  };

  const nextScenario = () => {
    setIndex((prev) => (prev + 1) % TRIAGE_SCENARIOS.length);
    setSelected(null);
    setShowResult(false);
  };

  return (
    <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden max-w-2xl mx-auto">
      <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-blue-400" />
          <h2 className="text-xl font-black uppercase tracking-widest">Triage Master Class</h2>
        </div>
        <Badge variant="outline" className="border-slate-700 text-slate-400">
          Scenario {index + 1} / {TRIAGE_SCENARIOS.length}
        </Badge>
      </div>

      <CardContent className="p-10 space-y-8">
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
          <p className="text-lg font-bold text-slate-800 leading-relaxed italic">
            &quot;{scenario.presentation}&quot;
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-[10px] font-black uppercase text-slate-400">BP: {scenario.vitals.bp}</div>
          <div className="text-[10px] font-black uppercase text-slate-400">HR: {scenario.vitals.hr}</div>
          <div className="text-[10px] font-black uppercase text-slate-400">SpO2: {scenario.vitals.spO2}%</div>
          <div className="text-[10px] font-black uppercase text-slate-400">Temp: {scenario.vitals.temp}°F</div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Assign ESI Level</p>
          <div className="flex justify-center gap-4">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                disabled={showResult}
                onClick={() => handleSelect(level)}
                className={`w-14 h-14 rounded-2xl font-black text-xl transition-all ${
                  selected === level 
                    ? (level === scenario.correctEsi ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white')
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {showResult && (
          <div className={`p-6 rounded-3xl animate-in slide-in-from-bottom-4 ${
            selected === scenario.correctEsi ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              {selected === scenario.correctEsi 
                ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                : <XCircle className="h-5 w-5 text-red-600" />
              }
              <span className={`text-sm font-black uppercase tracking-tight ${
                selected === scenario.correctEsi ? 'text-emerald-700' : 'text-red-700'
              }`}>
                {selected === scenario.correctEsi ? 'Correct Assessment' : `Incorrect: ESI ${scenario.correctEsi} Required`}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-600 leading-relaxed italic">
              {scenario.rationale}
            </p>
            <button 
              onClick={nextScenario}
              className="mt-4 w-full py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Next Scenario
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}