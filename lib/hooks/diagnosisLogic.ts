export interface DiagnosisSuggestion {
  code: string;
  description: string;
  reason: string;
  priority: "High" | "Medium";
  suggestedOrders: string[];
}

export interface VitalsData {
  hr: number;
  bp: string;
  spO2: number;
  temp: number;
}

function parseSystolic(bp: string): number {
  const match = bp.match(/^(\d+)\s*\//);
  return match ? parseInt(match[1], 10) : 0;
}

function parseDiastolic(bp: string): number {
  const match = bp.match(/\/\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function getDiagnosisSuggestions(complaint: string, vitals: VitalsData): DiagnosisSuggestion[] {
  const suggestions: DiagnosisSuggestion[] = [];
  const text = complaint.toLowerCase();
  const sbp = parseSystolic(vitals.bp);
  const dbp = parseDiastolic(vitals.bp);

  // ─── CARDIAC ────────────────────────────────────────────────────────────────
  if (text.includes("chest pain") || text.includes("chest pressure") || text.includes("chest tightness")) {
    if (vitals.hr > 100 || sbp > 160) {
      suggestions.push({
        code: "I21.9",
        description: "Acute Myocardial Infarction (STEMI/NSTEMI Rule-Out)",
        reason: "Chest pain with tachycardia or hypertension — ACS protocol indicated.",
        priority: "High",
        suggestedOrders: ["Troponin I", "Basic Metabolic Panel (BMP)", "Chest X-Ray 2-View"],
      });
    } else {
      suggestions.push({
        code: "I20.9",
        description: "Angina Pectoris, Unspecified",
        reason: "Chest pain without haemodynamic instability.",
        priority: "High",
        suggestedOrders: ["Troponin I", "Chest X-Ray 2-View"],
      });
    }
  }

  // ─── HYPERTENSIVE CRISIS ────────────────────────────────────────────────────
  if (sbp >= 180 || dbp >= 120) {
    suggestions.push({
      code: "I16.1",
      description: "Hypertensive Emergency",
      reason: `BP ${vitals.bp} meets hypertensive emergency threshold (≥180/120).`,
      priority: "High",
      suggestedOrders: ["Basic Metabolic Panel (BMP)", "CT Head Non-Contrast"],
    });
  } else if (sbp >= 160) {
    suggestions.push({
      code: "I10",
      description: "Hypertensive Urgency",
      reason: `Elevated BP ${vitals.bp} without acute end-organ signs.`,
      priority: "Medium",
      suggestedOrders: ["Basic Metabolic Panel (BMP)"],
    });
  }

  // ─── RESPIRATORY ────────────────────────────────────────────────────────────
  if (text.includes("shortness of breath") || text.includes("sob") || text.includes("difficulty breathing") || text.includes("dyspnea")) {
    if (vitals.spO2 < 90) {
      suggestions.push({
        code: "J96.00",
        description: "Acute Respiratory Failure with Hypoxia",
        reason: `Critical hypoxia — SpO2 ${vitals.spO2}% (< 90%).`,
        priority: "High",
        suggestedOrders: ["Chest X-Ray 2-View", "Basic Metabolic Panel (BMP)"],
      });
    } else if (vitals.spO2 < 94) {
      suggestions.push({
        code: "R06.02",
        description: "Shortness of Breath with Hypoxia",
        reason: `SpO2 ${vitals.spO2}% below acceptable threshold.`,
        priority: "High",
        suggestedOrders: ["Chest X-Ray 2-View", "Basic Metabolic Panel (BMP)"],
      });
    } else {
      suggestions.push({
        code: "R06.02",
        description: "Shortness of Breath",
        reason: "Respiratory distress complaint with stable oxygen saturation.",
        priority: "Medium",
        suggestedOrders: ["Chest X-Ray 2-View"],
      });
    }
  }

  // ─── PE SUSPICION ───────────────────────────────────────────────────────────
  if ((text.includes("pleuritic") || text.includes("leg swelling") || text.includes("leg pain")) && vitals.hr > 100) {
    suggestions.push({
      code: "I26.99",
      description: "Pulmonary Embolism (Suspected)",
      reason: "Tachycardia with pleuritic/leg symptoms — Wells criteria elevated.",
      priority: "High",
      suggestedOrders: ["CT Head Non-Contrast", "Basic Metabolic Panel (BMP)"],
    });
  }

  // ─── STROKE / NEURO ─────────────────────────────────────────────────────────
  if (text.includes("stroke") || text.includes("facial droop") || text.includes("arm weakness") || text.includes("slurred speech") || text.includes("facial weakness")) {
    suggestions.push({
      code: "I63.9",
      description: "Cerebral Infarction / CVA Rule-Out",
      reason: "Focal neurological deficit — activate Stroke Alert protocol.",
      priority: "High",
      suggestedOrders: ["CT Head Non-Contrast", "Basic Metabolic Panel (BMP)", "CBC with Diff"],
    });
  }

  if (text.includes("headache") || text.includes("migraine")) {
    const isThunderclap = text.includes("worst") || text.includes("thunderclap") || text.includes("sudden");
    suggestions.push({
      code: isThunderclap ? "G43.909" : "R51.9",
      description: isThunderclap ? "Thunderclap Headache — Subarachnoid Hemorrhage Rule-Out" : "Headache, Unspecified",
      reason: isThunderclap
        ? "Sudden-onset severe headache requires urgent CT to rule out SAH."
        : "Direct match for cephalalgia chief complaint.",
      priority: isThunderclap ? "High" : "Medium",
      suggestedOrders: isThunderclap
        ? ["CT Head Non-Contrast", "Basic Metabolic Panel (BMP)"]
        : [],
    });
  }

  // ─── SEPSIS ─────────────────────────────────────────────────────────────────
  const sepsisVitals = vitals.hr > 90 || vitals.temp >= 100.4 || vitals.temp < 96.8;
  if (text.includes("sepsis") || text.includes("septic") || (sepsisVitals && (text.includes("infection") || text.includes("fever") || text.includes("chills")))) {
    suggestions.push({
      code: "A41.9",
      description: "Sepsis, Unspecified — 3-Hour Bundle",
      reason: `SIRS criteria met: HR ${vitals.hr}, Temp ${vitals.temp}°F. Initiate Sepsis Bundle.`,
      priority: "High",
      suggestedOrders: ["CBC with Diff", "Basic Metabolic Panel (BMP)", "Troponin I"],
    });
  }

  // ─── FEVER / INFECTION ──────────────────────────────────────────────────────
  if ((vitals.temp >= 100.4 || text.includes("fever")) && !suggestions.some(s => s.code === "A41.9")) {
    suggestions.push({
      code: "R50.9",
      description: "Fever, Unspecified",
      reason: `Temperature ${vitals.temp}°F meets febrile criteria (≥ 100.4°F).`,
      priority: "Medium",
      suggestedOrders: ["CBC with Diff", "Urinalysis"],
    });
    if (text.includes("cough") || text.includes("sputum")) {
      suggestions.push({
        code: "J06.9",
        description: "Acute Upper Respiratory Infection",
        reason: "Fever combined with productive cough.",
        priority: "Medium",
        suggestedOrders: ["CBC with Diff", "Chest X-Ray 2-View"],
      });
    }
  }

  // ─── UTI / GU ───────────────────────────────────────────────────────────────
  if (text.includes("dysuria") || text.includes("burning urination") || text.includes("frequency") || text.includes("flank pain")) {
    suggestions.push({
      code: "N39.0",
      description: "Urinary Tract Infection",
      reason: "GU symptoms consistent with UTI or pyelonephritis.",
      priority: "Medium",
      suggestedOrders: ["Urinalysis", "Basic Metabolic Panel (BMP)"],
    });
  }

  // ─── ABDOMINAL PAIN ─────────────────────────────────────────────────────────
  if (text.includes("abdominal pain") || text.includes("abd pain") || text.includes("stomach pain") || text.includes("nausea") || text.includes("vomiting")) {
    suggestions.push({
      code: "R10.9",
      description: "Acute Abdominal Pain",
      reason: "GI complaint — consider appendicitis, cholecystitis, obstruction.",
      priority: vitals.hr > 100 ? "High" : "Medium",
      suggestedOrders: ["CBC with Diff", "Basic Metabolic Panel (BMP)", "US Abdomen Complete"],
    });
  }

  // ─── HYPOGLYCEMIA ───────────────────────────────────────────────────────────
  if (text.includes("hypoglycemia") || text.includes("low blood sugar") || text.includes("dizzy") || text.includes("syncope") || text.includes("passed out")) {
    suggestions.push({
      code: "E11.649",
      description: "Hypoglycemia / Syncope Rule-Out",
      reason: "Altered consciousness or syncope — glucose check critical.",
      priority: "High",
      suggestedOrders: ["Basic Metabolic Panel (BMP)", "CBC with Diff"],
    });
  }

  // ─── FALLBACK ───────────────────────────────────────────────────────────────
  if (suggestions.length === 0) {
    suggestions.push({
      code: "R69",
      description: "Illness, Unspecified",
      reason: "No specific pattern matched — baseline workup recommended.",
      priority: "Medium",
      suggestedOrders: ["CBC with Diff", "Basic Metabolic Panel (BMP)"],
    });
  }

  // Deduplicate by code, high priority first
  const seen = new Set<string>();
  return suggestions
    .sort((a, b) => (a.priority === "High" ? -1 : 1) - (b.priority === "High" ? -1 : 1))
    .filter(s => { if (seen.has(s.code)) return false; seen.add(s.code); return true; });
}