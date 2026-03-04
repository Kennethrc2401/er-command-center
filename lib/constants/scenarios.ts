export interface TriageScenario {
  id: string;
  presentation: string;
  vitals: { hr: number; bp: string; spO2: number; temp: number };
  correctEsi: number;
  rationale: string;
}

export const TRIAGE_SCENARIOS: TriageScenario[] = [
  {
    id: "1",
    presentation: "62M, sudden onset 'worst headache of life', facial drooping noted, slurred speech.",
    vitals: { hr: 88, bp: "190/110", spO2: 97, temp: 98.6 },
    correctEsi: 2,
    rationale: "High risk for CVA (Stroke). Time-sensitive emergency, but not currently needing life-saving intervention (ESI 1)."
  },
  {
    id: "2",
    presentation: "22F, unresponsive in parking lot, pinpoint pupils, shallow respirations (6/min).",
    vitals: { hr: 52, bp: "90/60", spO2: 84, temp: 97.4 },
    correctEsi: 1,
    rationale: "Requires immediate life-saving intervention (Airway/Ventilation/Narcan). Immediate ESI 1."
  },
  {
    id: "3",
    presentation: "45F, localized right lower quadrant pain for 2 days. Nausea but no vomiting. Ambulating well.",
    vitals: { hr: 92, bp: "128/82", spO2: 99, temp: 100.2 },
    correctEsi: 3,
    rationale: "Needs multiple resources (Labs, Imaging, IV Fluids) but is hemodynamically stable."
  },
  {
    id: "4",
    presentation: "30M, fever, cough, and mild shortness of breath for 3 days. No chest pain or confusion.",
    vitals: { hr: 102, bp: "118/76", spO2: 95, temp: 101.5 },
    correctEsi: 4,
    rationale: "Requires one resource (COVID test) and is stable. ESI 4 appropriate."
  },
  {
    id: "5",
    presentation: "28F, sprained ankle while jogging, no other complaints.",
    vitals: { hr: 78, bp: "110/70", spO2: 98, temp: 98.7 },
    correctEsi: 5,
    rationale: "Requires no resources (just examination and possible bandaging). Stable and non-urgent."
  },
  {
    id: "6",
    presentation: "55M, chest pain radiating to left arm, diaphoresis, and nausea for 30 minutes.",
    vitals: { hr: 110, bp: "150/90", spO2: 94, temp: 98.9 },
    correctEsi: 2,
    rationale: "High risk for acute coronary syndrome. Needs immediate evaluation and likely multiple resources, but not currently in arrest (ESI 1)."
  },
  {
    id: "7",
    presentation: "40F, severe abdominal pain, vomiting, and signs of peritonitis on exam.",
    vitals: { hr: 120, bp: "100/60", spO2: 92, temp: 101.8 },
    correctEsi: 2,
    rationale: "High risk for sepsis or surgical abdomen. Needs immediate evaluation and likely multiple resources, but not currently in arrest (ESI 1)."
  },
  {
    id: "8",
    presentation: "18M, minor laceration to hand, no active bleeding, tetanus up to date.",
    vitals: { hr: 80, bp: "120/80", spO2: 99, temp: 98.6 },
    correctEsi: 5,
    rationale: "Requires no resources (just examination and possible bandaging). Stable and non-urgent."
  },
  {
    id: "9",
    presentation: "70F, confusion, fever, and productive cough for 2 days. History of COPD.",
    vitals: { hr: 105, bp: "130/85", spO2: 88, temp: 102.3 },
    correctEsi: 2,
    rationale: "High risk for pneumonia with hypoxia. Needs immediate evaluation and likely multiple resources, but not currently in arrest (ESI 1)."
  },
  {
    id: "10",
    presentation: "25F, mild headache and fatigue for 3 days, no other symptoms.",
    vitals: { hr: 78, bp: "115/75", spO2: 98, temp: 98.4 },
    correctEsi: 4,
    rationale: "Requires one resource (possibly labs or imaging) but is stable. ESI 4 appropriate."
  },
  {
    id: "11",
    presentation: "50M, severe back pain after lifting heavy object, no neurological deficits.",
    vitals: { hr: 90, bp: "125/80", spO2: 99, temp: 98.7 },
    correctEsi: 3,
    rationale: "Needs multiple resources (imaging, pain management) but is hemodynamically stable."
  },
  {
    id: "12",
    presentation: "60F, dizziness and syncope while standing, no chest pain or palpitations.",
    vitals: { hr: 60, bp: "85/55", spO2: 95, temp: 98.6 },
    correctEsi: 2,
    rationale: "High risk for orthostatic hypotension or arrhythmia. Needs immediate evaluation and likely multiple resources, but not currently in arrest (ESI 1)."
  },
  {
    id: "13",
    presentation: "35M, mild shortness of breath and wheezing after allergen exposure, no chest pain or confusion.",
    vitals: { hr: 95, bp: "120/80", spO2: 94, temp: 98.6 },
    correctEsi: 3,
    rationale: "Needs multiple resources (nebulizer treatment, possible steroids) but is hemodynamically stable."
  },
  {
    id: "14",
    presentation: "45F, severe headache and neck stiffness for 1 day, no fever or neurological deficits.",
    vitals: { hr: 85, bp: "130/85", spO2: 98, temp: 98.6 },
    correctEsi: 3,
    rationale: "Needs multiple resources (imaging, possible lumbar puncture) but is hemodynamically stable."
  },
  {
    id: "15",
    presentation: "20M, minor burn to hand from hot water, no other complaints.",
    vitals: { hr: 80, bp: "120/80", spO2: 99, temp: 98.6 },
    correctEsi: 5,
    rationale: "Requires no resources (just examination and possible dressing). Stable and non-urgent."
  },
  {
    id: "16",
    presentation: "65F, severe abdominal pain, vomiting, and signs of peritonitis on exam.",
    vitals: { hr: 130, bp: "90/60", spO2: 88, temp: 102.5 },
    correctEsi: 1,
    rationale: "Requires immediate life-saving intervention (Airway/Ventilation/IV Fluids). Immediate ESI 1."
  },
  {
    id: "17",
    presentation: "30M, severe asthma exacerbation with wheezing, use of accessory muscles, and inability to speak full sentences.",
    vitals: { hr: 120, bp: "140/90", spO2: 88, temp: 98.6 },
    correctEsi: 1,
    rationale: "Requires immediate life-saving intervention (Airway/Ventilation/Nebulizer). Immediate ESI 1."
  },
  {
    id: "18",
    presentation: "50F, severe chest pain radiating to back, diaphoresis, and nausea for 30 minutes.",
    vitals: { hr: 110, bp: "150/90", spO2: 94, temp: 98.9 },
    correctEsi: 2,
    rationale: "High risk for acute coronary syndrome or aortic dissection. Needs immediate evaluation and likely multiple resources, but not currently in arrest (ESI 1)."
  },
  {
    id: "19",
    presentation: "40F, severe abdominal pain, vomiting, and signs of peritonitis on exam.",
    vitals: { hr: 120, bp: "100/60", spO2: 92, temp: 101.8 },
    correctEsi: 2,
    rationale: "High risk for sepsis or surgical abdomen. Needs immediate evaluation and likely multiple resources, but not currently in arrest (ESI 1)."
  },
  {
    id: "20",
    presentation: "18M, minor laceration to hand, no active bleeding, tetanus up to date.",
    vitals: { hr: 80, bp: "120/80", spO2: 99, temp: 98.6 },
    correctEsi: 5,
    rationale: "Requires no resources (just examination and possible bandaging). Stable and non-urgent."
  }
];