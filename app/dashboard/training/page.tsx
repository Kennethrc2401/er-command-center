"use client";

import TriageQuiz from "@/components/Training/TriageQuiz";
import ReferenceSidebar from "../../../components/Training/ReferenceSidebar";
import { Brain, GraduationCap, BookOpen, ChevronRight, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import EsiWizard from "@/components/Training/EsiWizard";
import SimulateShift from "@/components/Training/SimulateShift";

export default function TrainingPage() {
  return (
    <main className="min-h-screen bg-slate-50/50 p-4 md:p-10 pt-24">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Clinical Education Portal</span>
            </div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
              Staff <span className="text-purple-600">Training</span> Center
            </h1>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-tight">
              FDU Clinical Prep | Unit 4B | ESI Certification Module
            </p>
          </div>

          <div className="flex gap-4 bg-white p-2 rounded-3xl border border-slate-200 shadow-sm">
            <div className="px-6 py-3 text-center border-r border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Current Score</p>
              <p className="text-xl font-black text-slate-900">84%</p>
            </div>
            <div className="px-6 py-3 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Rank</p>
              <p className="text-xl font-black text-purple-600">Lead CCMA</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <SimulateShift />
          {/* LEFT: REFERENCE (CHEATSHEET) */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center gap-2 px-2">
              <BookOpen className="h-4 w-4 text-slate-400" />
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Lab References</span>
            </div>
            <ReferenceSidebar />
          </div>

          {/* MIDDLE: THE QUIZ */}
          <div className="lg:col-span-6 space-y-8">
             <TriageQuiz />
              <EsiWizard />
             
             {/* STUDY TIP CARD */}
             <div className="bg-purple-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-purple-200 relative overflow-hidden group">
                <GraduationCap className="absolute -right-4 -bottom-4 h-32 w-32 text-white/10 group-hover:scale-110 transition-transform" />
                <h4 className="text-lg font-black uppercase tracking-widest mb-2 italic">Pro-Tip for Triage</h4>
                <p className="text-sm font-medium leading-relaxed text-purple-100">
                  Always consider the &quot;Sixth Vital Sign&quot;—Pain. While ESI level 3 is common for abdominal pain, any patient who looks &quot;Toxic&quot; or is hemodynamically unstable should be immediately escalated to Level 2.
                </p>
             </div>
          </div>

          {/* RIGHT: PROGRESS & ALGORITHM QUICK-LINKS */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center gap-2 px-2">
              <Activity size={16} className="text-slate-400" />
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Quick Protocols</span>
            </div>
            <div className="space-y-3">
              {['ESI Algorithm', 'Stroke / NIHSS', 'STEMI / Cardiac', 'Sepsis Criteria'].map((item) => (
                <button key={item} className="w-full flex justify-between items-center p-5 bg-white border border-slate-200 rounded-2xl hover:border-purple-400 hover:shadow-lg transition-all group">
                  <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{item}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-purple-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}