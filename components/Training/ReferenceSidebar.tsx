"use client";

import { useState } from "react";
import { CLINICAL_REF } from "@/lib/constants/references";
import { Search, Info, AlertOctagon } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function ReferenceSidebar() {
  const [query, setQuery] = useState("");

  const filteredLabs = CLINICAL_REF.LABS.filter(l => 
    l.name.toLowerCase().includes(query.toLowerCase())
  );

  const filteredProcedureGuides = CLINICAL_REF.PROCEDURE_PREP_GUIDES.filter((procedure) => {
    const searchable = [
      procedure.name,
      procedure.setupGoal,
      procedure.scopeNote,
      ...procedure.supplies,
      ...procedure.prepSteps,
      ...procedure.setupChecklist,
    ].join(" ").toLowerCase();
    return searchable.includes(query.toLowerCase());
  });

  return (
    <div className="glass-panel aurora-panel flex h-full flex-col overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
      <div className="relative overflow-hidden p-6 text-white">
        <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-violet-950" />
        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl soft-float" />
        <div className="relative">
          <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em]">
            <Info className="h-4 w-4 text-blue-300" /> Clinical Reference
        </h3>
          <p className="mt-2 max-w-xs text-[10px] leading-relaxed text-slate-300">
            Search labs, vitals, and procedure prep by name, steps, supplies, or checklist items.
          </p>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search labs, vitals, procedures..."
              className="h-10 rounded-xl border-slate-700 bg-slate-900/80 pl-9 text-[10px] text-white placeholder:text-slate-500"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredLabs.map((lab) => (
          <div key={lab.name} className="rounded-2xl border border-slate-100 bg-white/90 p-4 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950/70">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{lab.name}</span>
              <div className="flex items-center gap-1 text-[8px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 uppercase tracking-widest">
                <AlertOctagon className="h-2.5 w-2.5" /> Critical
              </div>
            </div>
            
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Normal: {lab.range}</p>
            <p className="text-[10px] font-black text-red-600 mt-1 uppercase tracking-tighter italic">Panic: {lab.critical}</p>
            
            <div className="mt-3 pt-3 border-t border-slate-200/50">
              <p className="text-[9px] font-medium text-slate-400 leading-relaxed italic">&quot;{lab.note}&quot;</p>
            </div>
          </div>
        ))}

        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm dark:border-violet-500/30 dark:bg-violet-950/20">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">Procedure Prep Library</p>
          <p className="mt-1 text-[10px] leading-relaxed text-violet-900/80">
            Training reference only. Follow your facility protocol, provider orders, and role scope.
          </p>
        </div>

        {filteredProcedureGuides.map((procedure) => (
          <div
            key={procedure.name}
            className="rounded-2xl border border-violet-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg dark:border-violet-500/20 dark:bg-slate-950/70"
          >
            <p className="text-xs font-black uppercase tracking-tight text-violet-800">{procedure.name}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-violet-500">{procedure.unit}</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-600">{procedure.setupGoal}</p>
            <p className="mt-2 rounded-lg border border-violet-100 bg-violet-50 px-2 py-1 text-[9px] font-medium text-violet-800">
              {procedure.scopeNote}
            </p>

            <div className="mt-3 space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Supplies</p>
              <ul className="space-y-1">
                {procedure.supplies.map((item) => (
                  <li key={item} className="text-[10px] leading-relaxed text-slate-700">- {item}</li>
                ))}
              </ul>
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Prep Steps</p>
              <ul className="space-y-1">
                {procedure.prepSteps.map((item) => (
                  <li key={item} className="text-[10px] leading-relaxed text-slate-700">- {item}</li>
                ))}
              </ul>
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Room-Ready Checklist</p>
              <ul className="space-y-1">
                {procedure.setupChecklist.map((item) => (
                  <li key={item} className="text-[10px] leading-relaxed text-slate-700">- {item}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}

        {filteredProcedureGuides.length === 0 && (
          <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-[10px] text-violet-800 dark:border-violet-500/20 dark:bg-violet-950/20 dark:text-violet-200">
            No procedure prep references match your search.
          </div>
        )}
      </div>
    </div>
  );
}