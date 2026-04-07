export function buildDifferentialDraft(input: {
  chiefComplaint: string;
  vitalsSummary: string;
  context: string;
}) {
  const complaint = input.chiefComplaint.trim().toLowerCase();
  const vitals = input.vitalsSummary.trim().toLowerCase();
  const context = input.context.trim();

  const candidates: string[] = [];
  const redFlags: string[] = [];
  const immediateActions: string[] = [];

  if (complaint.includes("chest") || complaint.includes("pressure")) {
    candidates.push("Acute coronary syndrome", "Pulmonary embolism", "Aortic pathology");
    redFlags.push("Ongoing chest pain", "Hemodynamic instability", "Hypoxia");
  }

  if (complaint.includes("shortness") || complaint.includes("sob") || complaint.includes("breath")) {
    candidates.push("Acute heart failure", "Pneumonia", "Pulmonary embolism");
    redFlags.push("Rapid oxygen desaturation", "Increased work of breathing");
  }

  if (complaint.includes("abdominal") || complaint.includes("abd pain")) {
    candidates.push("Appendicitis", "Bowel obstruction", "Biliary pathology");
    redFlags.push("Peritoneal signs", "Persistent vomiting", "Fever with tachycardia");
  }

  if (vitals.includes("spo2") && (vitals.includes("90") || vitals.includes("91") || vitals.includes("92"))) {
    redFlags.push("Borderline oxygenation trend");
    immediateActions.push("Repeat pulse oximetry and airway assessment");
  }

  if (vitals.includes("hr") && (vitals.includes("120") || vitals.includes("130") || vitals.includes("140"))) {
    redFlags.push("Tachycardic trend");
    immediateActions.push("Repeat full vital panel and reassess perfusion");
  }

  if (candidates.length === 0) {
    candidates.push("Undifferentiated acute presentation", "Infection/inflammatory process", "Metabolic etiology");
  }

  if (immediateActions.length === 0) {
    immediateActions.push("Trend vitals and pain score", "Escalate to provider for focused reassessment", "Confirm pending diagnostics");
  }

  const uniq = (items: string[]) => Array.from(new Set(items));

  return [
    `AI DIFFERENTIAL DRAFT (${new Date().toLocaleString()})`,
    `Chief Concern: ${input.chiefComplaint || "Not provided"}`,
    `Vitals Snapshot: ${input.vitalsSummary || "Not provided"}`,
    "",
    "Top Differential Candidates:",
    ...uniq(candidates).slice(0, 5).map((item, index) => `${index + 1}. ${item}`),
    "",
    "Red Flags:",
    ...uniq(redFlags).slice(0, 5).map((item) => `- ${item}`),
    "",
    "Immediate Actions:",
    ...uniq(immediateActions).slice(0, 5).map((item) => `- ${item}`),
    context ? "" : "",
    context ? `Additional Context: ${context}` : "",
    "",
    "Clinical review and final diagnosis required before sign-off.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildHandoffCompression(sourceText: string) {
  const clean = sourceText.trim().replace(/\s+/g, " ");
  if (!clean) {
    return "HANDOFF SUMMARY\n\nNo source text provided.";
  }

  const sentences = clean.split(/(?<=[.!?])\s+/).slice(0, 8);
  const first = sentences[0] ?? "Patient update pending.";
  const middle = sentences.slice(1, 4).join(" ");
  const final = sentences.slice(4).join(" ");

  return [
    `HANDOFF SUMMARY (${new Date().toLocaleString()})`,
    "",
    "Situation:",
    first,
    "",
    "Background:",
    middle || "Context needs confirmation.",
    "",
    "Assessment:",
    final || "Stability and trend review required.",
    "",
    "Recommendation:",
    "Confirm pending diagnostics, reassess in defined interval, and escalate if status worsens.",
  ].join("\n");
}

export function buildDenialRiskDraft(payload: {
  codingSummary: string;
  documentationSummary: string;
}) {
  const coding = payload.codingSummary.toLowerCase();
  const docs = payload.documentationSummary.toLowerCase();

  let score = 18;
  const risks: string[] = [];

  if (!coding.includes("medical necessity")) {
    score += 18;
    risks.push("Missing explicit medical necessity phrasing");
  }
  if (!docs.includes("time") && !docs.includes("timestamp")) {
    score += 14;
    risks.push("Timeline details may be insufficient");
  }
  if (!docs.includes("reassessment")) {
    score += 12;
    risks.push("Reassessment documentation appears thin");
  }
  if (!coding.includes("icd") && !coding.includes("dx")) {
    score += 16;
    risks.push("Diagnosis coding linkage is unclear");
  }

  const boundedScore = Math.max(0, Math.min(99, score));
  const band = boundedScore >= 70 ? "HIGH" : boundedScore >= 40 ? "MODERATE" : "LOW";

  const actions = [
    "Tie interventions to clinical severity and response.",
    "Confirm diagnosis-to-procedure linkage.",
    "Add timestamped reassessment and disposition rationale.",
  ];

  return {
    score: boundedScore,
    band,
    risks: risks.length > 0 ? risks : ["No major denial triggers detected by quick scan."],
    actions,
  };
}

export function buildOrderSetSuggestions(payload: {
  chiefComplaint: string;
  acuityLabel: string;
  knownRisks: string;
}) {
  const complaint = payload.chiefComplaint.toLowerCase();
  const suggestions: string[] = [];

  if (complaint.includes("chest")) {
    suggestions.push("12-lead ECG", "Serial troponin protocol", "Cardiac monitoring");
  }
  if (complaint.includes("sob") || complaint.includes("shortness") || complaint.includes("breath")) {
    suggestions.push("CXR", "Continuous pulse oximetry", "VBG/ABG as indicated");
  }
  if (complaint.includes("abdominal") || complaint.includes("abd")) {
    suggestions.push("CBC/CMP", "Lipase", "Abdominal imaging pathway");
  }
  if (suggestions.length === 0) {
    suggestions.push("Focused lab panel", "Targeted imaging based on exam", "Early reassessment order set");
  }

  const uniq = Array.from(new Set(suggestions));
  return [
    `ORDER SET COPILOT (${new Date().toLocaleString()})`,
    `Complaint: ${payload.chiefComplaint || "Not provided"}`,
    `Acuity: ${payload.acuityLabel || "Not provided"}`,
    payload.knownRisks ? `Risk Context: ${payload.knownRisks}` : "",
    "",
    "Recommended Starter Orders:",
    ...uniq.slice(0, 6).map((item, idx) => `${idx + 1}. ${item}`),
    "",
    "Safety Check:",
    "- Confirm contraindications/allergies before signing orders.",
    "- Adapt to provider exam and institutional protocol.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPatientEducationDraft(payload: {
  diagnosis: string;
  treatmentPlan: string;
  literacyLevel: "standard" | "simple";
}) {
  const simple = payload.literacyLevel === "simple";
  const diagnosis = payload.diagnosis.trim() || "your current condition";
  const treatment = payload.treatmentPlan.trim() || "the care plan discussed during your visit";

  if (simple) {
    return [
      `PATIENT EDUCATION DRAFT (${new Date().toLocaleString()})`,
      "",
      `Today we treated you for: ${diagnosis}.`,
      `Your plan is: ${treatment}.`,
      "",
      "What to do next:",
      "1. Take medicines exactly as told.",
      "2. Drink fluids and rest as advised.",
      "3. Follow up with your doctor in 24-72 hours.",
      "",
      "Go to the ER now if symptoms get worse, breathing gets harder, pain becomes severe, or you feel faint.",
    ].join("\n");
  }

  return [
    `PATIENT EDUCATION DRAFT (${new Date().toLocaleString()})`,
    "",
    `Diagnosis: ${diagnosis}`,
    `Treatment Plan: ${treatment}`,
    "",
    "Home Care Guidance:",
    "1. Continue prescribed medications and hydration strategy.",
    "2. Monitor symptom trajectory and document any changes.",
    "3. Arrange follow-up with PCP/specialist within recommended interval.",
    "",
    "Return Precautions:",
    "Seek urgent care for escalating pain, shortness of breath, persistent vomiting, syncope, or new neurologic changes.",
  ].join("\n");
}

export type AIToolTarget = "differential" | "handoff" | "denial";

export type AIToolsPrefillPayload = {
  version: 1;
  target: AIToolTarget;
  chiefComplaint?: string;
  vitalsSummary?: string;
  clinicalContext?: string;
  handoffSource?: string;
  codingSummary?: string;
  documentationSummary?: string;
};

export const AI_TOOLS_PREFILL_KEY = "ai-tools-prefill-v1";

export function saveAIToolsPrefill(payload: AIToolsPrefillPayload) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_TOOLS_PREFILL_KEY, JSON.stringify(payload));
}

export function readAIToolsPrefill(): AIToolsPrefillPayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AI_TOOLS_PREFILL_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AIToolsPrefillPayload>;
    if (parsed.version !== 1) return null;
    if (!parsed.target) return null;

    return {
      version: 1,
      target: parsed.target,
      chiefComplaint: parsed.chiefComplaint,
      vitalsSummary: parsed.vitalsSummary,
      clinicalContext: parsed.clinicalContext,
      handoffSource: parsed.handoffSource,
      codingSummary: parsed.codingSummary,
      documentationSummary: parsed.documentationSummary,
    };
  } catch {
    return null;
  }
}

export function clearAIToolsPrefill() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AI_TOOLS_PREFILL_KEY);
}
