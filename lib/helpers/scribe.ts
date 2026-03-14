import { calculateNEWS2 } from "./news2";

export type ScribePatient = {
  name: string;
  gender: string;
  medicalHistory?: string[];
};

export type ScribeEncounter = {
  chiefComplaint: string;
  acuity: number;
  vitals: Parameters<typeof calculateNEWS2>[0];
};

export type ScribeOrder = {
  testName: string;
};

export function generateScribeNote(
  patient: ScribePatient,
  encounter: ScribeEncounter,
  orders: ScribeOrder[]
) {
  const news2 = calculateNEWS2(encounter.vitals);
  const timestamp = new Date().toLocaleString();

  return `
[PROGRESS NOTE - ${timestamp}]
[S] SUBJECTIVE: 
Patient presents with a chief complaint of ${encounter.chiefComplaint}. 
Relevant History: ${patient.medicalHistory?.join(", ") || "None recorded"}.

[O] OBJECTIVE: 
Vitals: HR ${encounter.vitals.hr}, BP ${encounter.vitals.bp}, O2 ${encounter.vitals.spO2}%, Temp ${encounter.vitals.temp}°F.
NEWS2 Score: ${news2.score} (${news2.level} RISK).
Active Orders: ${orders.length > 0 ? orders.map(o => o.testName).join(", ") : "None pending"}.

[A] ASSESSMENT: 
${patient.name} is a ${patient.gender} with ${encounter.chiefComplaint}. 
Clinical status is currently ${news2.level === 'CRITICAL' || news2.level === 'HIGH' ? 'UNSTABLE' : 'STABLE'}. 
Potential differential includes diagnoses suggested by clinical heuristics.

[P] PLAN: 
1. Monitor vitals Q${news2.score >= 5 ? '15m' : '1h'}.
2. Await results of ${orders.length > 0 ? orders.map(o => o.testName).join(", ") : "initial evaluation"}.
3. Maintain current ESI ${encounter.acuity} triage status.
  `.trim();
}