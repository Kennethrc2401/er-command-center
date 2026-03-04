"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, GraduationCap, Plus, BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function EducationTracker({ encounterId }: { encounterId: Id<"encounters"> }) {
  const logs = useQuery(api.education.getByEncounter, { encounterId });
  const logEducation = useMutation(api.education.log);

  const topics = [
    { title: "Wound Care & Dressing Changes", icon: "🩹" },
    { title: "Medication Side Effects & Schedule", icon: "💊" },
    { title: "Red Flag Signs of Infection", icon: "🌡️" },
    { title: "Follow-up Appointment Compliance", icon: "📅" }
  ];

  const handleLog = async (topic: string) => {
    await logEducation({
      encounterId,
      topic,
      method: "Verbal & Written",
      understanding: "Patient Verbalized Understanding",
      completedBy: "Sophia R, CCMA"
    });
    toast.success("Education milestone saved");
  };

  return (
    <Card className="border-slate-200 shadow-xl rounded-[2rem] overflow-hidden bg-white">
      <CardHeader className="bg-slate-900 text-white p-5">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-xl">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em]">
              Patient Education
            </CardTitle>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
              Discharge Teaching Modules
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* TOPICS LIST - Vertical for better text wrapping */}
        <div className="flex flex-col gap-3">
          {topics.map((item) => {
            const isDone = logs?.some(l => l.topic === item.title);
            return (
              <button
                key={item.title}
                disabled={isDone}
                onClick={() => handleLog(item.title)}
                className={`group flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all ${
                  isDone 
                  ? "border-emerald-100 bg-emerald-50/50 cursor-default" 
                  : "border-slate-100 hover:border-blue-500 hover:bg-slate-50 active:scale-[0.98]"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-xl grayscale group-hover:grayscale-0 transition-all">
                    {item.icon}
                  </span>
                  <span className={`text-[11px] font-black uppercase tracking-tight leading-tight max-w-45 ${
                    isDone ? "text-emerald-700" : "text-slate-600"
                  }`}>
                    {item.title}
                  </span>
                </div>
                
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors shrink-0">
                    <Plus className="h-3 w-3 text-slate-400 group-hover:text-blue-600" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* LOG HISTORY - Minimalist style */}
        {logs && logs.length > 0 && (
          <div className="pt-4 mt-2 border-t border-dashed border-slate-200">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Validated Records
            </h4>
            <div className="space-y-2">
              {logs.slice(-2).map((log) => (
                <div key={log._id} className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                  <BookOpen className="h-3 w-3 text-blue-400" />
                  <span className="truncate">{log.topic}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[8px] font-black uppercase text-slate-400">Verified</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}