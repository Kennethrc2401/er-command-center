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
    <Card className="mx-auto w-full overflow-hidden rounded-[2rem] border-none bg-white shadow-2xl sm:rounded-[3rem] dark:bg-slate-900">
      <div className="flex flex-col gap-3 bg-slate-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-blue-400" />
          <h2 className="text-lg font-black uppercase tracking-widest sm:text-xl">Triage Master Class</h2>
        </div>
        <Badge variant="outline" className="w-fit border-slate-700 text-slate-400">
          Scenario {index + 1} / {TRIAGE_SCENARIOS.length}
        </Badge>
      </div>

      <CardContent className="space-y-6 p-5 sm:p-8 md:space-y-8 md:p-10">
        <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-950/60">
          <p className="text-base font-bold leading-relaxed italic text-slate-800 dark:text-slate-100 sm:text-lg">
            &quot;{scenario.presentation}&quot;
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="text-[10px] font-black uppercase text-slate-400">BP: {scenario.vitals.bp}</div>
          <div className="text-[10px] font-black uppercase text-slate-400">HR: {scenario.vitals.hr}</div>
          <div className="text-[10px] font-black uppercase text-slate-400">SpO2: {scenario.vitals.spO2}%</div>
          <div className="text-[10px] font-black uppercase text-slate-400">Temp: {scenario.vitals.temp}°F</div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Assign ESI Level</p>
          <div className="mx-auto grid max-w-md grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                disabled={showResult}
                onClick={() => handleSelect(level)}
                className={`h-12 w-full rounded-2xl text-lg font-black transition-all sm:h-14 sm:text-xl ${
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
          <div className={`rounded-[1.75rem] p-5 animate-in slide-in-from-bottom-4 sm:p-6 ${
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
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-[10px] font-black uppercase tracking-widest text-white"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Next Scenario
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}