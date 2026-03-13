"use client";

import { useState } from "react";
import { BookOpen, Search, Pin, ChevronRight } from "lucide-react";
import { PROTOCOL_LIBRARY, Protocol } from "@/lib/hooks/protocols";

export default function ProtocolLibrary() {
  const [search, setSearch] = useState("");
  const [activeProtocol, setActiveProtocol] = useState<Protocol | null>(null);

  const filteredProtocols = PROTOCOL_LIBRARY.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm flex flex-col h-full max-h-[600px]">
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Standard Protocols</span>
        </div>
      </div>

      {/* 🔍 SEARCH */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
        <input 
          placeholder="Search SOPs (Sepsis, Stroke...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-50 border-2 border-slate-100 p-3 pl-10 rounded-2xl text-[11px] font-bold outline-none focus:border-blue-500 transition-all"
        />
      </div>

      {/* 📜 LIST OR DETAIL VIEW */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {!activeProtocol ? (
          filteredProtocols.map(p => (
            <button 
              key={p.id}
              onClick={() => setActiveProtocol(p)}
              className="w-full group flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all text-left"
            >
              <div>
                <p className="text-[10px] font-black uppercase text-blue-500 tracking-tighter mb-1">{p.category}</p>
                <p className="text-xs font-bold text-slate-800 tracking-tight">{p.title}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
            </button>
          ))
        ) : (
          <div className="space-y-4 animate-in slide-in-from-right-2">
            <button 
              onClick={() => setActiveProtocol(null)}
              className="text-[9px] font-black uppercase text-slate-400 hover:text-blue-600 transition-all"
            >
              ← Back to Library
            </button>
            <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
              <h4 className="text-xs font-black uppercase text-blue-900 mb-4 flex items-center gap-2">
                <Pin className="h-3 w-3" /> {activeProtocol.title}
              </h4>
              <ul className="space-y-3">
                {activeProtocol.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-[10px] font-medium text-blue-800/80 leading-relaxed">
                    <span className="h-4 w-4 flex-shrink-0 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px] font-black">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}