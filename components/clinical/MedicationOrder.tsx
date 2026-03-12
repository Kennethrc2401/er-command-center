"use client";

import { useState } from "react";
import { ShieldAlert, Pill, CheckCircle, Search } from "lucide-react";
import { MEDICATION_DATABASE, checkAllergyConflict } from "@/lib/hooks/medicationLogic";
import { toast } from "sonner";

interface MedicationOrderProps {
  patient: {
    allergies: string[];
  };
}

type MedicationEntry = (typeof MEDICATION_DATABASE)[number];

export default function MedicationOrder({ patient }: MedicationOrderProps) {
  const [search, setSearch] = useState("");
  const [selectedMed, setSelectedMed] = useState<MedicationEntry | null>(null);
  
  const filteredMeds = MEDICATION_DATABASE.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const conflict = selectedMed ? checkAllergyConflict(selectedMed.name, patient.allergies) : null;

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-6 shadow-sm">
      <div className="flex items-center gap-3">
        <Pill className="h-5 w-5 text-blue-500" />
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Medication Ordering</h3>
      </div>

      {/* 🔍 SEARCH BAR */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
        <input 
          placeholder="Search drug database..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-50 border-2 border-slate-100 p-4 pl-12 rounded-2xl font-bold text-slate-900 focus:border-blue-500 outline-none"
        />
        {search && !selectedMed && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
            {filteredMeds.map(m => (
              <button 
                key={m.name}
                onClick={() => { setSelectedMed(m); setSearch(""); }}
                className="w-full p-4 text-left hover:bg-slate-50 border-b last:border-0"
              >
                <p className="text-sm font-black uppercase">{m.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{m.class} • {m.dose}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 🚨 ALLERGY ALERT PANEL */}
      {selectedMed && (
        <div className={`p-6 rounded-[2rem] border-2 animate-in slide-in-from-top-2 ${
          conflict ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
        }`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${conflict ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
              {conflict ? <ShieldAlert className="h-6 w-6" /> : <CheckCircle className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-black uppercase text-slate-900">{selectedMed.name} {selectedMed.dose}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">Route: {selectedMed.route}</p>
              
              {conflict ? (
                <div className="mt-4 bg-white/60 p-3 rounded-xl border border-red-200">
                  <p className="text-[10px] font-black uppercase text-red-600 tracking-tight leading-none mb-1 underline">Clinical Safety Warning</p>
                  <p className="text-[11px] font-bold text-red-700">{conflict}</p>
                </div>
              ) : (
                <p className="mt-4 text-[10px] font-black uppercase text-emerald-600 tracking-widest">No known allergy conflicts detected.</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button 
              disabled={!!conflict}
              onClick={() => { toast.success("Order Sent to Pharmacy"); setSelectedMed(null); }}
              className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${
                conflict 
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              Confirm Order
            </button>
            <button 
              onClick={() => setSelectedMed(null)}
              className="px-6 py-4 border-2 border-slate-200 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}