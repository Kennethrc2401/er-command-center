"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Home, Cigarette, Wine, ClipboardCheck, Plus } from "lucide-react";
import { toast } from "sonner";

export default function PatientCareSidebar({ 
  patientId, 
  encounterId 
}: { 
  patientId: Id<"patients">; 
  encounterId: Id<"encounters">; 
}) {
  const social = useQuery(api.socialHistory.getByPatient, { patientId });
  const tasks = useQuery(api.checklists.getByEncounter, { encounterId });
  const toggleTask = useMutation(api.checklists.toggle);

  const handleToggle = async (taskId: Id<"checklists">) => {
    try {
      await toggleTask({ taskId });
      toast.success("Care task updated");
    } catch (e) {
      toast.error("Failed to update task");
    }
  };

  return (
    <div className="space-y-6">
      {/* SOCIAL HISTORY SECTION */}
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b py-3">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Social Determinants
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-start gap-3">
            <Home className="h-4 w-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400">Living Situation</p>
              <p className="text-sm font-medium text-slate-700">{social?.livingSituation || "Not Documented"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Cigarette className="h-4 w-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400">Tobacco Use</p>
              <p className="text-sm font-medium text-slate-700">{social?.smokingStatus || "Unknown"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Wine className="h-4 w-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400">Alcohol Use</p>
              <p className="text-sm font-medium text-slate-700">{social?.alcoholUse || "Unknown"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CARE CHECKLIST SECTION */}
      <Card className="border-emerald-100 shadow-md bg-white overflow-hidden">
        <CardHeader className="bg-emerald-50/50 border-b py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" /> Care Checklist
          </CardTitle>
          <button className="text-emerald-600 hover:text-emerald-800 transition-colors">
            <Plus className="h-3 w-3" />
          </button>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {tasks?.map((task) => (
              <div key={task._id} className="flex items-center space-x-3 group">
                <Checkbox 
                  id={task._id} 
                  checked={task.completed} 
                  onCheckedChange={() => handleToggle(task._id)}
                  className="border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
                <label 
                  htmlFor={task._id}
                  className={`text-xs font-bold leading-none transition-colors cursor-pointer ${
                    task.completed ? "text-slate-400 line-through" : "text-slate-700"
                  }`}
                >
                  {task.item}
                </label>
              </div>
            ))}
            {(!tasks || tasks.length === 0) && (
              <p className="text-[10px] text-slate-400 italic text-center py-4">No tasks assigned for this encounter.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}