"use client";

import { useForm, SubmitHandler, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { vitalsSchema, VitalsFormData, calculateAcuity } from "@/schemas/vitals";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { 
  Activity, 
  CheckCircle2, 
  Loader2, 
  ThermometerSun, 
  Heart, 
  Wind, 
  Gauge,
  AlertTriangle 
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  encounterId: Id<"encounters">; 
  onComplete?: () => void;
}

export default function VitalSignsForm({ encounterId, onComplete }: Props) {
  const recordVitals = useMutation(api.vitals.record);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unit, setUnit] = useState<"C" | "F">("F");

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<VitalsFormData>({
    resolver: zodResolver(vitalsSchema) as Resolver<VitalsFormData>,
    defaultValues: { bp: "", hr: undefined, temp: undefined, spO2: undefined }
  });

  const watched = watch();
  const acuity = calculateAcuity(watched, unit);

  // --- BP MASKING ---
  const handleBPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d/]/g, "");
    if (value.length === 3 && !value.includes("/")) {
      value = value + "/";
    }
    setValue("bp", value);
  };

  // --- CLINICAL ALERTS ---
  const sbp = parseInt(watched.bp?.split("/")[0]) || 0;
  const alerts = {
    hr: watched.hr ? (watched.hr > 100 || watched.hr < 60) : false,
    spO2: watched.spO2 ? (watched.spO2 < 94) : false,
    // Fever detection based on selected unit
    temp: watched.temp ? (unit === "F" ? watched.temp > 100.4 : watched.temp > 38) : false,
    bp: sbp > 160 || (sbp < 90 && sbp > 0)
  };

  const onSubmit: SubmitHandler<VitalsFormData> = async (data) => {
    setIsSubmitting(true);
    try {
      // NORMALIZE: Convert F to C for standardized database storage
      const normalizedTemp = unit === "F" 
        ? (data.temp - 32) * 5 / 9 
        : data.temp;
      
      await recordVitals({
        encounterId,
        hr: data.hr,
        bp: data.bp,
        spO2: data.spO2,
        temp: parseFloat(normalizedTemp.toFixed(1)),
      });

      toast.success("Clinical telemetry synced successfully.");
      reset();
      if (onComplete) onComplete();
    } catch (error) {
      toast.error("Telemetry sync failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Telemetry Entry</h3>
        </div>
        
        {/* UNIT TOGGLE */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button 
            type="button" 
            onClick={() => setUnit("C")} 
            className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${unit === 'C' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
          >°C</button>
          <button 
            type="button" 
            onClick={() => setUnit("F")} 
            className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${unit === 'F' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
          >°F</button>
        </div>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ACUITY STATUS */}
        <div className={`p-4 rounded-xl flex justify-between items-center transition-all duration-500 shadow-inner ${acuity.color}`}>
          <div>
            <span className="text-[10px] font-black uppercase opacity-70 tracking-widest">Triage Priority</span>
            <p className="font-bold text-sm leading-tight uppercase">{acuity.label}</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black italic tracking-tighter leading-none">ESI {acuity.level}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {/* Heart Rate */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5">
              <Heart className={`size-3 ${alerts.hr ? "text-red-500 animate-pulse" : "text-slate-400"}`} /> Heart Rate
            </label>
            <input
              {...register("hr", { valueAsNumber: true })}
              type="number"
              className={`w-full p-2.5 rounded-xl border font-bold text-sm outline-none focus:ring-2 transition-all ${
                alerts.hr ? "bg-red-50 border-red-300 focus:ring-red-500 text-red-900" : "bg-slate-50 border-slate-200 focus:ring-blue-500"
              }`}
            />
          </div>

          {/* Blood Pressure */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5">
              <Gauge className={`size-3 ${alerts.bp ? "text-red-500 animate-pulse" : "text-slate-400"}`} /> BP (mmHg)
            </label>
            <input
              {...register("bp")}
              placeholder="120/80"
              onChange={handleBPChange}
              className={`w-full p-2.5 rounded-xl border font-bold text-sm outline-none focus:ring-2 transition-all ${
                alerts.bp ? "bg-red-50 border-red-300 focus:ring-red-500 text-red-900" : "bg-slate-50 border-slate-200 focus:ring-blue-500"
              }`}
            />
          </div>

          {/* Temperature - WITH REAL-TIME CONVERSION PREVIEW */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase flex justify-between items-center">
              <span className="flex items-center gap-1.5"><ThermometerSun className={`size-3 ${alerts.temp ? "text-orange-500" : "text-slate-400"}`} /> Temp</span>
              <span className="opacity-50 tracking-tighter">°{unit}</span>
            </label>
            <input
              {...register("temp", { valueAsNumber: true })}
              type="number"
              step="0.1"
              placeholder={unit === "C" ? "37.0" : "98.6"}
              className={`w-full p-2.5 rounded-xl border font-bold text-sm outline-none focus:ring-2 transition-all ${
                alerts.temp ? "bg-orange-50 border-orange-300 focus:ring-orange-500 text-orange-900" : "bg-slate-50 border-slate-200 focus:ring-blue-500"
              }`}
            />
            {watched.temp && (
               <p className="text-[9px] text-slate-400 italic mt-1 pl-1 font-medium">
                 {unit === "F" 
                   ? `≈ ${((watched.temp - 32) * 5/9).toFixed(1)}°C` 
                   : `≈ ${((watched.temp * 9/5) + 32).toFixed(1)}°F`}
               </p>
            )}
          </div>

          {/* SpO2 */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5">
              <Wind className={`size-3 ${alerts.spO2 ? "text-sky-500 animate-pulse" : "text-slate-400"}`} /> SpO2 (%)
            </label>
            <input
              {...register("spO2", { valueAsNumber: true })}
              type="number"
              className={`w-full p-2.5 rounded-xl border font-bold text-sm outline-none focus:ring-2 transition-all ${
                alerts.spO2 ? "bg-red-50 border-red-300 focus:ring-red-500 text-red-900" : "bg-slate-50 border-slate-200 focus:ring-blue-500"
              }`}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {isSubmitting ? "Syncing Telemetry..." : "Commit Vitals Set"}
        </button>
      </form>
    </div>
  );
}