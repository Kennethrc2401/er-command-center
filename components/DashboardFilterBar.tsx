"use client";

import { useState } from "react";
import { Search, ShieldAlert } from "lucide-react";

interface FilterBarProps {
  onFilterChange: (level: number | null) => void;
  onSearchChange: (query: string) => void; // Added this prop
}

export default function DashboardFilterBar({ onFilterChange, onSearchChange }: FilterBarProps) {
  const [activeTab, setActiveTab] = useState<number | null>(null);

  return (
    <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6 bg-slate-50 p-2 rounded-2xl border border-slate-200">
      <div className="flex items-center gap-1">
        <button 
          onClick={() => { setActiveTab(null); onFilterChange(null); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!activeTab ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
        >
          All
        </button>
        <button 
          onClick={() => { setActiveTab(1); onFilterChange(1); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 1 ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-red-600'}`}
        >
          <ShieldAlert className="h-3 w-3" />
          Critical
        </button>
        {[2, 3, 4, 5].map((level) => (
          <button 
            key={level}
            onClick={() => { setActiveTab(level); onFilterChange(level); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === level ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            L{level}
          </button>
        ))}
      </div>

      <div className="relative w-full md:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search Name or MRN..." 
          onChange={(e) => onSearchChange(e.target.value)} // Trigger the search update
          className="w-full pl-10 pr-4 py-2 rounded-xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 text-sm transition-all outline-none bg-white"
        />
      </div>
    </div>
  );
}