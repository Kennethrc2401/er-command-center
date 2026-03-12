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
  ThermometerSun
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  encounterId: Id<"encounters">; 
  onComplete?: () => void;
}

type VitalType = "hr" | "spO2" | "bp" | "temp";

function VitalInput({
  label,
  value,
  onChange,
  type,
  suffix = ""
}: {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type: VitalType;
  suffix?: string;
}) {
  const getStatusColor = () => {
    const num = parseFloat(String(value ?? ""));
    if (Number.isNaN(num)) return "text-slate-900";

    if (type === "hr") {
      if (num > 140 || num < 40) return "text-red-600 animate-pulse";
      if (num > 100 || num < 60) return "text-amber-500";
    }
    if (type === "spO2") {
      if (num < 90) return "text-red-600 animate-pulse";
      if (num < 94) return "text-amber-500";
    }
    return "text-slate-900";
  };

  const statusColor = getStatusColor();
  const isCritical = statusColor.includes("red");

  return (
    <div
      className={`bg-slate-50 p-4 rounded-2xl border-2 transition-all ${
        isCritical ? "border-red-200 bg-red-50" : "border-slate-100"
      }`}
    >
      <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-tighter">{label}</p>
      <div className="flex items-baseline gap-1">
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`bg-transparent font-black text-xl w-full outline-none transition-colors ${statusColor}`}
        />
        <span className="text-[10px] font-bold text-slate-400">{suffix}</span>
      </div>
      {isCritical && (
        <p className="text-[8px] font-black text-red-500 uppercase mt-1 leading-none">
          Critical Value
        </p>
      )}
    </div>
  );
}

export default function VitalSignsForm({ encounterId, onComplete }: Props) {
  const recordVitals = useMutation(api.vitals.record);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unit, setUnit] = useState<"C" | "F">("F");

  const { handleSubmit, reset, watch, setValue } = useForm<VitalsFormData>({
    resolver: zodResolver(vitalsSchema) as Resolver<VitalsFormData>,
    defaultValues: { bp: "", hr: undefined, temp: undefined, spO2: undefined }
  });

  const watched = watch();
  const acuity = calculateAcuity(watched, unit);

  // --- BP MASKING ---
  const handleBPChange = (rawValue: string) => {
    let value = rawValue.replace(/[^\d/]/g, "");
    if (value.length === 3 && !value.includes("/")) {
      value = value + "/";
    }
    setValue("bp", value, { shouldValidate: true, shouldDirty: true });
  };

  const handleNumericChange = (field: "hr" | "temp" | "spO2") => (rawValue: string) => {
    const cleaned = field === "temp"
      ? rawValue.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
      : rawValue.replace(/[^\d]/g, "");

    if (cleaned === "") {
      setValue(field, undefined as never, { shouldValidate: true, shouldDirty: true });
      return;
    }

    const numeric = Number(cleaned);
    if (Number.isNaN(numeric)) {
      return;
    }

    setValue(field, numeric as never, { shouldValidate: true, shouldDirty: true });
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
    } catch {
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
          <VitalInput
            label="Heart Rate"
            value={watched.hr}
            onChange={handleNumericChange("hr")}
            type="hr"
            suffix="bpm"
          />

          <VitalInput
            label="Blood Pressure"
            value={watched.bp}
            onChange={handleBPChange}
            type="bp"
            suffix="mmHg"
          />

          <div className="space-y-1.5">
            <VitalInput
              label={`Temp (°${unit})`}
              value={watched.temp}
              onChange={handleNumericChange("temp")}
              type="temp"
              suffix={`°${unit}`}
            />
            {typeof watched.temp === "number" && (
              <p className="text-[9px] text-slate-400 italic mt-1 pl-1 font-medium flex items-center gap-1">
                <ThermometerSun className="size-3" />
                {unit === "F"
                  ? `≈ ${((watched.temp - 32) * 5 / 9).toFixed(1)}°C`
                  : `≈ ${((watched.temp * 9 / 5) + 32).toFixed(1)}°F`}
              </p>
            )}
          </div>

          <VitalInput
            label="SpO2"
            value={watched.spO2}
            onChange={handleNumericChange("spO2")}
            type="spO2"
            suffix="%"
          />
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