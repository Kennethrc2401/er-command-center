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

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden h-full flex flex-col">
      <div className="p-6 bg-slate-900 text-white">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-400" /> Clinical Reference
        </h3>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input 
            placeholder="Search labs/vitals..." 
            className="bg-slate-800 border-none text-[10px] h-9 pl-9 text-white placeholder:text-slate-500 rounded-xl"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredLabs.map((lab) => (
          <div key={lab.name} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all">
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
      </div>
    </div>
  );
}