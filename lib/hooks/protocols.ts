export type ProtocolCategory =
  | "Cardiac"
  | "Respiratory"
  | "Neurological"
  | "General"
  | "Pediatrics";

export type ProtocolTag =
  | "Critical"
  | "Time-Sensitive"
  | "Consult"
  | "Airway"
  | "Respiratory"
  | "Neurological"
  | "Trauma"
  | "Infectious"
  | "Metabolic"
  | "Toxicology"
  | "Peds";

export interface Protocol {
  id: string;
  title: string;
  category: ProtocolCategory;
  tags: ProtocolTag[];
  steps: string[];
}

export const PROTOCOL_LIBRARY: Protocol[] = [
  {
    id: "stroke-alert",
    title: "Stroke Alert (Code Gray)",
    category: "Neurological",
    tags: ["Critical", "Time-Sensitive", "Consult"],
    steps: [
      "Last Known Well (LKW) time documentation",
      "Stat non-contrast Head CT",
      "Neurology consultation via Tele-Stroke",
      "Check Glucose and Coagulation studies",
      "Maintain BP < 185/110 if tPA candidate"
    ]
  },
  {
    id: "sepsis-bundle",
    title: "Sepsis 3-Hour Bundle",
    category: "General",
    tags: ["Critical", "Time-Sensitive", "Infectious"],
    steps: [
      "Measure lactate level",
      "Obtain blood cultures before antibiotics",
      "Administer broad-spectrum antibiotics",
      "Administer 30mL/kg crystalloid for hypotension"
    ]
  },
  {
    id: "acls-tachy",
    title: "Tachycardia with Pulse (ACLS)",
    category: "Cardiac",
    tags: ["Critical", "Time-Sensitive", "Consult"],
    steps: [
      "Identify/treat underlying cause",
      "Maintain airway; assist breathing if needed",
      "Cardiac monitoring; BP and Oximetry",
      "If unstable: Synchronized Cardioversion"
    ]
  },
  {
    id: "acls-brady",
    title: "Symptomatic Bradycardia (ACLS)",
    category: "Cardiac",
    tags: ["Critical", "Time-Sensitive", "Consult"],
    steps: [
      "Assess airway, breathing, and circulation",
      "Place patient on monitor, obtain 12-lead ECG, and establish IV access",
      "If persistent symptomatic bradycardia: Atropine 1 mg IV every 3-5 min (max 3 mg)",
      "If ineffective: begin transcutaneous pacing or start dopamine/epinephrine infusion",
      "Consult cardiology and prepare for transvenous pacing if unstable"
    ]
  },
  {
    id: "stemi-activation",
    title: "STEMI Activation Pathway",
    category: "Cardiac",
    tags: ["Critical", "Time-Sensitive", "Consult"],
    steps: [
      "Obtain 12-lead ECG within 10 minutes of arrival",
      "Activate cath lab immediately for STEMI criteria",
      "Administer aspirin unless contraindicated",
      "Start anticoagulation and anti-ischemic therapy per protocol",
      "Target door-to-balloon time under 90 minutes"
    ]
  },
  {
    id: "chest-pain-acs",
    title: "Chest Pain / Possible ACS",
    category: "Cardiac",
    tags: ["Time-Sensitive", "Consult"],
    steps: [
      "Place on continuous telemetry and pulse oximetry",
      "Obtain ECG and initial troponin, then repeat per delta protocol",
      "Administer aspirin and nitroglycerin if not hypotensive",
      "Risk-stratify with HEART score and clinical exam",
      "Consult cardiology for intermediate/high-risk features"
    ]
  },
  {
    id: "anaphylaxis",
    title: "Anaphylaxis Rapid Response",
    category: "Respiratory",
    tags: ["Critical", "Time-Sensitive", "Airway"],
    steps: [
      "Give IM epinephrine 0.3-0.5 mg immediately in lateral thigh",
      "Support airway and provide high-flow oxygen",
      "Start IV access and crystalloid bolus for hypotension",
      "Administer adjuncts: antihistamine, corticosteroid, bronchodilator",
      "Observe for biphasic reaction and prepare repeat epinephrine if needed"
    ]
  },
  {
    id: "asthma-exacerbation",
    title: "Acute Asthma Exacerbation",
    category: "Respiratory",
    tags: ["Time-Sensitive", "Airway"],
    steps: [
      "Assess severity and obtain peak flow if feasible",
      "Administer repeated SABA nebulizers with ipratropium for moderate/severe cases",
      "Start systemic corticosteroids early",
      "Escalate to magnesium sulfate for severe or refractory bronchospasm",
      "Reassess frequently and admit/ICU transfer if worsening fatigue or hypoxia"
    ]
  },
  {
    id: "copd-exacerbation",
    title: "Acute COPD Exacerbation",
    category: "Respiratory",
    tags: ["Time-Sensitive", "Airway"],
    steps: [
      "Titrate oxygen to target SpO2 88-92%",
      "Administer bronchodilators (SABA +/- anticholinergic)",
      "Begin systemic corticosteroids",
      "Obtain VBG/ABG if hypercapnia or respiratory fatigue suspected",
      "Initiate non-invasive ventilation when indicated"
    ]
  },
  {
    id: "status-epilepticus",
    title: "Status Epilepticus",
    category: "Neurological",
    tags: ["Critical", "Time-Sensitive", "Consult"],
    steps: [
      "Stabilize airway and check bedside glucose immediately",
      "Administer first-line benzodiazepine",
      "If ongoing seizure, load second-line agent (levetiracetam, valproate, or fosphenytoin)",
      "Escalate to ICU-level care and continuous EEG if refractory",
      "Identify/treat precipitating causes (infection, electrolytes, tox, trauma)"
    ]
  },
  {
    id: "head-injury",
    title: "Head Injury Observation Pathway",
    category: "Neurological",
    tags: ["Time-Sensitive", "Trauma", "Consult"],
    steps: [
      "Perform serial neurologic checks and GCS documentation",
      "Apply validated CT head decision criteria",
      "Reverse anticoagulation promptly when indicated",
      "Maintain head-of-bed elevation and avoid hypotension/hypoxia",
      "Escalate to neurosurgery for concerning imaging or decline"
    ]
  },
  {
    id: "hypoglycemia",
    title: "Severe Hypoglycemia",
    category: "General",
    tags: ["Time-Sensitive", "Metabolic"],
    steps: [
      "Confirm low glucose with point-of-care test",
      "If altered and no IV: give IM glucagon",
      "If IV available: administer dextrose bolus",
      "Recheck glucose every 15 minutes until stable",
      "Identify cause and ensure nutrition/medication adjustment before discharge"
    ]
  },
  {
    id: "dka-initial",
    title: "Diabetic Ketoacidosis (Initial Management)",
    category: "General",
    tags: ["Critical", "Metabolic", "Time-Sensitive"],
    steps: [
      "Begin isotonic fluid resuscitation",
      "Check BMP, ketones, anion gap, VBG, and serial glucose",
      "Replace potassium before/with insulin as indicated",
      "Start insulin infusion when potassium threshold is safe",
      "Continue until anion gap closes, then transition to subcutaneous insulin"
    ]
  },
  {
    id: "opioid-overdose",
    title: "Opioid Overdose / Respiratory Depression",
    category: "General",
    tags: ["Critical", "Airway", "Toxicology"],
    steps: [
      "Support airway and ventilation immediately",
      "Administer naloxone and repeat/titrate to adequate respirations",
      "Monitor end-tidal CO2 and oxygenation",
      "Evaluate for co-ingestions and recurrent sedation",
      "Provide harm-reduction counseling and linkage to MAT resources"
    ]
  },
  {
    id: "peds-asthma-exacerbation",
    title: "Pediatric Asthma Exacerbation",
    category: "Pediatrics",
    tags: ["Peds", "Airway", "Time-Sensitive"],
    steps: [
      "Assess severity (work of breathing, mental status, oxygen saturation)",
      "Administer weight-based albuterol +/- ipratropium",
      "Give systemic steroids early",
      "Escalate to magnesium sulfate for severe/refractory symptoms",
      "Reassess frequently and admit for persistent hypoxia or fatigue"
    ]
  },
  {
    id: "peds-bronchiolitis",
    title: "Pediatric Bronchiolitis",
    category: "Pediatrics",
    tags: ["Peds", "Respiratory", "Time-Sensitive"],
    steps: [
      "Assess hydration and respiratory distress severity",
      "Provide nasal suctioning and supportive care",
      "Start oxygen if saturation remains below institutional threshold",
      "Avoid routine bronchodilators unless clear documented response",
      "Admit if apnea risk, dehydration, or escalating work of breathing"
    ]
  },
  {
    id: "peds-croup",
    title: "Pediatric Croup",
    category: "Pediatrics",
    tags: ["Peds", "Airway", "Time-Sensitive"],
    steps: [
      "Minimize agitation and keep child with caregiver",
      "Administer dexamethasone",
      "For moderate/severe stridor at rest, give nebulized epinephrine",
      "Observe for recurrence after epinephrine",
      "Discharge only when stridor improves and hydration is adequate"
    ]
  },
  {
    id: "peds-febrile-seizure",
    title: "Pediatric Febrile Seizure",
    category: "Pediatrics",
    tags: ["Peds", "Neurological", "Time-Sensitive"],
    steps: [
      "Stabilize airway, breathing, and circulation",
      "Check bedside glucose and temperature",
      "Treat prolonged seizure with age/weight-appropriate benzodiazepine",
      "Screen for serious bacterial infection when clinically indicated",
      "Provide caregiver counseling and return precautions"
    ]
  },
  {
    id: "peds-sepsis",
    title: "Pediatric Sepsis Pathway",
    category: "Pediatrics",
    tags: ["Peds", "Critical", "Infectious", "Time-Sensitive"],
    steps: [
      "Recognize sepsis signs and activate pediatric sepsis alert",
      "Obtain cultures and key labs without delaying treatment",
      "Administer broad-spectrum antibiotics promptly",
      "Start weight-based fluid resuscitation with frequent reassessment",
      "Escalate to PICU-level support for persistent shock or organ dysfunction"
    ]
  },
];