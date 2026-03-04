import { z } from "zod";

export const vitalsSchema = z.object({
  hr: z.coerce.number()
    .min(0, "Heart rate must be positive")
    .max(300, "Unrealistic heart rate"),
  bp: z.string()
    .regex(/^\d{2,3}\/\d{2,3}$/, "Format must be Sys/Dia (e.g., 120/80)"),
  temp: z.coerce.number()
    .min(25, "Value below limit of human viability") 
    .max(115, "Value above limit of human viability"),
  spO2: z.coerce.number()
    .min(0)
    .max(100, "Oxygen saturation cannot exceed 100%"),
});

// Explicitly export the type for use in components
export type VitalsFormData = z.infer<typeof vitalsSchema>;

/**
 * Realistic ESI Triage Logic
 * Level 1: Resuscitation | Level 2: Emergent | Level 3: Urgent | Level 4: Stable
 */
export const calculateAcuity = (vitals: Partial<VitalsFormData>, unit: "C" | "F") => {
  const { hr = 70, spO2 = 98, temp = 37 } = vitals;

  // Standardize temperature to Celsius for the logic check
  const tempInC = unit === "F" && temp ? (temp - 32) * 5 / 9 : temp;

  if (!vitals.hr && !vitals.temp && !vitals.spO2) {
    return { level: "-", label: "Awaiting Data", color: "bg-slate-100 text-slate-500" };
  }

  // LEVEL 1: RESUSCITATION
  if (spO2 < 88 || hr > 160 || hr < 40 || tempInC > 41 || tempInC < 32) {
    return { level: 1, label: "Resuscitation", color: "bg-red-600 text-white" };
  }

  // LEVEL 2: EMERGENT
  if (spO2 < 93 || hr > 120 || hr < 50 || tempInC > 39.5 || tempInC < 35) {
    return { level: 2, label: "Emergent", color: "bg-orange-500 text-white" };
  }

  // LEVEL 3: URGENT
  if (hr > 100 || tempInC > 38.3 || spO2 < 95) {
    return { level: 3, label: "Urgent", color: "bg-yellow-400 text-slate-900" };
  }

  return { level: 4, label: "Stable", color: "bg-emerald-500 text-white" };
};