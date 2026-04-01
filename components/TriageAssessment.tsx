"use client";

import * as React from "react"; // Explicit React import for type safety
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, Wind, Thermometer, CheckCircle2, Save, 
  Lock, UserCircle, Calendar, Edit3 
} from "lucide-react";
import { toast } from "sonner";

export default function TriageAssessment({ encounterId }: { encounterId: Id<"encounters"> }) {
  const existing = useQuery(api.triage.getByEncounter, { encounterId });
  const submitTriage = useMutation(api.triage.submit);

  const [gcs, setGcs] = useState(15);
  const [resps, setResps] = useState("Normal");
  const [skin, setSkin] = useState("Warm/Dry");
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    try {
      await submitTriage({
        encounterId,
        gcsScore: gcs,
        pupils: "PERRL",
        mentalStatus: gcs === 15 ? "Alert/Oriented" : "Altered",
        workOfBreathing: resps,
        lungSounds: "Clear",
        skinTemp: skin.split("/")[0],
        skinCondition: skin.split("/")[1],
        triageNurse: "Sophia R, RN",
      });
      toast.success("Triage Assessment Finalized");
      setIsEditing(false);
    } catch {
      toast.error("Failed to save assessment");
    }
  };

  // --- READ-ONLY VIEW (FINALIZED) ---
  if (existing && !isEditing) {
    return (
      <Card className="border-emerald-100 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-emerald-50/50 border-b py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700 flex items-center gap-2">
            <Lock className="h-3.5 w-3.5" /> Finalized Triage Record
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-[9px] font-black uppercase text-slate-400 hover:text-blue-600"
            onClick={() => setIsEditing(true)}
          >
            <Edit3 className="h-3 w-3 mr-1" /> Add Addendum
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            <div className="p-6 space-y-2">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Neuro / GCS</span>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-slate-800">{existing.gcsScore}</span>
                <Badge variant="default" className={existing.gcsScore <= 8 ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}>
                  {existing.gcsScore === 15 ? "Intact" : "Altered"}
                </Badge>
              </div>
            </div>
            <div className="p-6 space-y-2">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Respiratory</span>
              <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">{existing.workOfBreathing}</p>
              <p className="text-[10px] text-slate-400 font-medium tracking-tight">Lungs: {existing.lungSounds}</p>
            </div>
            <div className="p-6 space-y-2">
              <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest text-left">Skin / Temp</span>
              <p className="text-sm font-bold text-slate-700 uppercase tracking-tight text-left">
                {existing.skinTemp} / {existing.skinCondition}
              </p>
            </div>
          </div>
          
          <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <UserCircle className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[10px] font-black text-slate-600 uppercase">{existing.triageNurse}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  {new Date(existing.completedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- EDITABLE VIEW ---
  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-slate-50/50 border-b py-4">
        <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Primary Triage Survey
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-purple-600" />
            <Label className="text-[10px] font-black uppercase text-slate-400">Neurological (GCS)</Label>
          </div>
          <div className="px-2">
            <div className="flex justify-between mb-6">
              <span className="text-2xl font-black text-slate-800">{gcs}</span>
              <Badge variant="outline" className={gcs <= 8 ? "bg-red-50 text-red-700 border-red-100" : "bg-emerald-50 text-emerald-700"}>
                {gcs <= 8 ? "Severe (Intubate)" : gcs <= 12 ? "Moderate" : "Mild/Normal"}
              </Badge>
            </div>
            <Slider 
              value={[gcs]} 
              onValueChange={(val: number[]) => setGcs(val[0])} 
              max={15} min={3} step={1} 
              className="py-4 cursor-pointer"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-blue-600" />
            <Label className="text-[10px] font-black uppercase text-slate-400">Respiratory Effort</Label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["Normal", "Labored", "Tachypneic"].map((opt) => (
              <Button 
                key={opt}
                variant={resps === opt ? "default" : "outline"}
                className="text-[10px] font-black uppercase h-9"
                onClick={() => setResps(opt)}
              >
                {opt}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-orange-500" />
            <Label className="text-[10px] font-black uppercase text-slate-400">Skin Condition</Label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {["Warm/Dry", "Cool/Clammy", "Hot/Dry", "Cold/Mottled"].map((opt) => (
              <Button 
                key={opt}
                variant={skin === opt ? "default" : "outline"}
                className="text-[10px] font-black uppercase h-9"
                onClick={() => setSkin(opt)}
              >
                {opt}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {isEditing && (
            <Button 
              variant="outline"
              className="flex-1 text-[10px] font-black uppercase h-12 rounded-xl"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
          )}
          <Button 
            onClick={handleSave}
            className="flex-[2] bg-slate-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-[0.2em] h-12 rounded-xl gap-2"
          >
            <Save className="h-4 w-4" /> {isEditing ? "Update Assessment" : "Finalize Assessment"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}