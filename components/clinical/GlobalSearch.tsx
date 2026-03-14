"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Search, Beaker, ArrowRight } from "lucide-react";

interface GlobalSearchProps {
  onQueryChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function GlobalSearch({
  onQueryChange,
  placeholder = "Search clinical records, MRNs, or lab orders...",
  className,
}: GlobalSearchProps = {}) {
  const [query, setQuery] = useState("");
  const results = useQuery(api.clinical.globalClinicalSearch, { searchTerm: query });

  const handleChange = (value: string) => {
    setQuery(value);
    onQueryChange?.(value);
  };

  return (
    <div className={`relative w-full max-w-2xl mx-auto ${className ?? ""}`}>
      <div className="group relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
        <input 
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white border-2 border-slate-100 p-5 pl-14 rounded-[2rem] font-bold text-slate-900 focus:border-blue-500 outline-none transition-all shadow-xl"
        />
        <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 text-slate-300 font-black text-[10px] uppercase">
          <kbd className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[9px] font-black text-slate-400">Ctrl</kbd>
          <span className="text-slate-300">+</span>
          <kbd className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[9px] font-black text-slate-400">/</kbd>
        </div>
      </div>

      {/* 📊 SEARCH RESULTS DROPDOWN */}
      {query.length > 1 && (
        <div className="absolute top-full left-0 right-0 mt-4 bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl z-1000 overflow-hidden p-2">
          
          {/* PATIENT RESULTS */}
          {results?.patients.length ? (
            <div className="p-4">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 ml-2">Patients</p>
              {results.patients.map((p) => (
                <button key={p._id} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-black">
                      {p.name[0]}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-slate-900">{p.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.mrn}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-200 group-hover:text-blue-500 transition-all" />
                </button>
              ))}
            </div>
          ) : null}

          {/* ORDER RESULTS */}
          {results?.orders.length ? (
            <div className="p-4 border-t border-slate-50">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 ml-2">Active Orders</p>
              {results.orders.map((o) => (
                <button key={o._id} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${o.priority === 'STAT' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Beaker className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-slate-900">{o.testName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{o.status} • {o.priority}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {!results?.patients.length && !results?.orders.length && (
            <div className="p-12 text-center">
              <p className="text-xs font-black uppercase text-slate-400 tracking-widest">No matching clinical records</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}