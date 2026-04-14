"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, ClipboardCheck, Copy, GitCompareArrows, Search, Stethoscope, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DiagnosisSuggestion, VitalsData, getDiagnosisSuggestions } from "@/lib/hooks/diagnosisLogic";

interface CaseSupportPanelProps {
  encounter: {
    chiefComplaint: string;
    vitals: VitalsData;
  };
  onSelectDiagnosis?: (orders: string[]) => void;
}

type WorkflowStatus = "Needs Review" | "In Progress" | "Escalated" | "Documented";

type ActionLogEntry = {
  id: string;
  at: number;
  message: string;
};

type ProtocolAction = {
  code: string;
  label: string;
  hint: string;
  symptoms: string[];
  orders: string[];
};

const COMMON_SYMPTOMS = [
  "Chest pain",
  "Chest pressure",
  "Shortness of breath",
  "Fever",
  "Headache",
  "Abdominal pain",
  "Dysuria",
  "Leg swelling",
  "Weakness",
  "Syncope",
  "Cough",
  "Nausea",
  "Vomiting",
  "Slurred speech",
  "Facial droop",
];

const PROTOCOL_ACTIONS: ProtocolAction[] = [
  {
    code: "I63.9",
    label: "Stroke Alert",
    hint: "stroke facial droop slurred speech arm weakness",
    symptoms: ["Stroke", "Facial droop", "Slurred speech", "Arm weakness"],
    orders: ["CT Head Non-Contrast", "Basic Metabolic Panel (BMP)", "CBC with Diff"],
  },
  {
    code: "A41.9",
    label: "Sepsis Bundle",
    hint: "fever chills infection hypotension",
    symptoms: ["Fever", "Cough", "Weakness"],
    orders: ["CBC with Diff", "Basic Metabolic Panel (BMP)", "Troponin I"],
  },
  {
    code: "I21.9",
    label: "Chest Pain",
    hint: "chest pain pressure tightness",
    symptoms: ["Chest pain", "Chest pressure"],
    orders: ["Troponin I", "Basic Metabolic Panel (BMP)", "Chest X-Ray 2-View"],
  },
  {
    code: "R06.02",
    label: "Respiratory",
    hint: "shortness of breath dyspnea hypoxia",
    symptoms: ["Shortness of breath", "Cough"],
    orders: ["Chest X-Ray 2-View", "Basic Metabolic Panel (BMP)"],
  },
];

const NEXT_STEP_GUIDANCE: Record<string, { title: string; steps: string[]; cautions: string[] }> = {
  "I21.9": {
    title: "ACS / MI Rule-Out",
    steps: [
      "Obtain a 12-lead ECG now and place the patient on cardiac monitoring.",
      "Start IV access and follow serial troponin protocol.",
      "Escalate to the provider or cardiology if pain persists or ECG is abnormal.",
      "Consider aspirin only if there is no contraindication and local protocol allows it.",
    ],
    cautions: ["Do not delay monitoring while waiting for labs.", "Treat chest pain with unstable vitals as high acuity."],
  },
  "I20.9": {
    title: "Stable Angina Pattern",
    steps: [
      "Obtain ECG and compare with prior studies if available.",
      "Trend troponin and reassess pain response after initial evaluation.",
      "Review cardiac risk factors and medication adherence.",
      "Escalate if symptoms worsen or new instability appears.",
    ],
    cautions: ["Stable symptoms can still represent ACS.", "Reassess if the story changes during the visit."],
  },
  "R06.02": {
    title: "Dyspnea Evaluation",
    steps: [
      "Assess airway, breathing, and oxygen requirement immediately.",
      "Check chest imaging and repeat oxygen saturation after intervention.",
      "Consider nebulizer therapy, ABG/VBG, or escalation based on exam.",
      "Broaden to heart failure, pneumonia, or pulmonary embolism if indicated.",
    ],
    cautions: ["A stable saturation does not rule out serious disease.", "Reassess work of breathing after each intervention."],
  },
  "J96.00": {
    title: "Acute Hypoxic Respiratory Failure",
    steps: [
      "Apply supplemental oxygen and escalate respiratory support if needed.",
      "Obtain chest imaging and determine the most likely cause of hypoxia.",
      "Consider critical care or rapid response involvement if the patient remains unstable.",
      "Trend vitals closely and document response to treatment.",
    ],
    cautions: ["Treat as high acuity until oxygenation improves.", "Do not rely on a single normal reading."],
  },
  "I26.99": {
    title: "Pulmonary Embolism Workup",
    steps: [
      "Assess pretest probability and review for DVT/pleuritic symptoms.",
      "Obtain the appropriate imaging pathway for PE suspicion.",
      "Monitor oxygenation and hemodynamics while workup is underway.",
      "Escalate urgently if the patient becomes hypotensive or severely hypoxic.",
    ],
    cautions: ["Do not miss deterioration while awaiting imaging.", "Use the local PE protocol and contraindication review."],
  },
  "I63.9": {
    title: "Stroke Alert Pathway",
    steps: [
      "Establish last-known-well timing and activate stroke workflow if appropriate.",
      "Check glucose immediately and obtain non-contrast head CT.",
      "Perform serial neuro checks and notify neurology early.",
      "Keep the patient NPO until swallow or formal clearance if indicated.",
    ],
    cautions: ["Time to imaging matters.", "Treat focal deficits as urgent until proven otherwise."],
  },
  "A41.9": {
    title: "Sepsis Bundle",
    steps: [
      "Start the sepsis pathway with cultures and lactate per protocol.",
      "Give IV fluids and consider broad-spectrum antibiotics promptly.",
      "Reassess perfusion, urine output, and mental status after treatment.",
      "Look for the likely source and document the working diagnosis.",
    ],
    cautions: ["Do not wait for every result before beginning the bundle.", "Recheck vitals frequently during resuscitation."],
  },
  "R50.9": {
    title: "Fever / Infection Workup",
    steps: [
      "Obtain focused infectious history and exam.",
      "Trend CBC, UA, and chest imaging if respiratory symptoms are present.",
      "Provide symptom control and hydration as needed.",
      "Escalate if fever is paired with instability or unclear source." ,
    ],
    cautions: ["Fevers can mask early sepsis.", "Consider source control if symptoms localize."],
  },
  "J06.9": {
    title: "Upper Respiratory Infection",
    steps: [
      "Confirm supportive-care needs and hydration status.",
      "Use chest imaging or labs if the patient appears more ill than expected.",
      "Review return precautions and warning signs.",
      "Reassess if cough becomes hypoxic or work of breathing increases.",
    ],
    cautions: ["URI symptoms can coexist with more serious pathology.", "Document when escalation is needed."],
  },
  "N39.0": {
    title: "UTI / Pyelonephritis Evaluation",
    steps: [
      "Obtain urinalysis and urine culture if indicated.",
      "Check renal function and consider flank pain/CVA tenderness.",
      "Start empiric therapy if the clinical picture supports infection.",
      "Escalate for fever, vomiting, or concern for pyelonephritis." ,
    ],
    cautions: ["Look for sepsis features in higher-risk patients.", "Match antibiotics to local protocol."],
  },
  "R10.9": {
    title: "Acute Abdominal Pain",
    steps: [
      "Perform a focused abdominal exam and note peritoneal signs.",
      "Order CBC/BMP and choose imaging based on location and severity.",
      "Keep the patient NPO if surgical pathology is a concern.",
      "Escalate if pain worsens, fever develops, or vomiting persists.",
    ],
    cautions: ["Abdominal pain can evolve quickly.", "Reassess if tenderness localizes."],
  },
  "E11.649": {
    title: "Hypoglycemia / Syncope Pathway",
    steps: [
      "Check glucose immediately and treat low glucose promptly.",
      "Repeat glucose after treatment and identify the likely trigger.",
      "Review medication use, intake, and recurrence risk.",
      "Escalate if altered mentation or syncope persists.",
    ],
    cautions: ["A normal mental status does not exclude recurrent hypoglycemia.", "Recheck glucose after intervention."],
  },
};

const RETURN_PRECAUTIONS: Record<string, string[]> = {
  "I21.9": [
    "Return immediately for worsening chest pain, shortness of breath, fainting, or diaphoresis.",
    "Return if pain spreads to the arm, jaw, back, or if nausea/vomiting begins.",
  ],
  "I20.9": [
    "Return for increasing chest discomfort, reduced exercise tolerance, or new shortness of breath.",
    "Return urgently if pain lasts longer than usual or changes character.",
  ],
  "R06.02": [
    "Return immediately for worsening breathlessness, blue lips, or inability to speak full sentences.",
    "Return if oxygen saturation falls or symptoms do not improve with treatment.",
  ],
  "J96.00": [
    "Call emergency services for worsening oxygenation, severe work of breathing, or confusion.",
    "Return if there is any deterioration after initial improvement.",
  ],
  "I26.99": [
    "Return immediately for chest pain, increasing shortness of breath, hemoptysis, or leg swelling that worsens.",
    "Return for syncope, hypotension, or new oxygen requirement.",
  ],
  "I63.9": [
    "Return immediately for any new weakness, facial droop, speech changes, or worsening confusion.",
    "Return for severe headache, repeated vomiting, or decline in neurologic status.",
  ],
  "A41.9": [
    "Return urgently for fever with shaking chills, confusion, low blood pressure, or worsening weakness.",
    "Return if urine output drops or symptoms progress despite treatment.",
  ],
  "R50.9": [
    "Return if fever persists more than expected, new pain develops, or the patient becomes lethargic.",
    "Return urgently for breathing problems, hypotension, or confusion.",
  ],
  "J06.9": [
    "Return for shortness of breath, fever that worsens, or inability to maintain hydration.",
    "Return if symptoms last longer than expected or the patient appears more ill.",
  ],
  "N39.0": [
    "Return for flank pain, fever, vomiting, or worsening urinary symptoms.",
    "Return urgently if confusion or weakness develops.",
  ],
  "R10.9": [
    "Return immediately for worsening abdominal pain, new guarding, persistent vomiting, or distension.",
    "Return for fever, blood in stool/emesis, or inability to tolerate oral intake.",
  ],
  "E11.649": [
    "Return for recurrent low glucose symptoms, fainting, or altered mental status.",
    "Return urgently if the patient cannot keep food or glucose down.",
  ],
};

const DEFAULT_GUIDANCE = {
  title: "Undifferentiated Presentation",
  steps: [
    "Broaden the history and exam to identify the dominant syndrome.",
    "Trend vitals and re-evaluate after any intervention.",
    "Use targeted labs or imaging based on the leading concern.",
    "Escalate if red flags emerge or the patient decompensates.",
  ],
  cautions: ["A single symptom set may not reveal the full diagnosis.", "Document evolution of the case over time."],
};

function getReturnPrecautions(code: string | null): string[] {
  if (code && RETURN_PRECAUTIONS[code]) {
    return RETURN_PRECAUTIONS[code];
  }

  return [
    "Return immediately for worsening symptoms, new red flags, or any sudden decline.",
    "Seek urgent evaluation if the presentation changes significantly.",
  ];
}

function buildSymptomQuery(baseText: string, symptoms: string[]) {
  return [baseText, ...symptoms].filter(Boolean).join(" ");
}

function getGuidance(suggestion: DiagnosisSuggestion) {
  return NEXT_STEP_GUIDANCE[suggestion.code] ?? DEFAULT_GUIDANCE;
}

export default function CaseSupportPanel({ encounter, onSelectDiagnosis }: CaseSupportPanelProps) {
  const [symptomText, setSymptomText] = useState(encounter.chiefComplaint);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(true);
  const [assignedTeam, setAssignedTeam] = useState("ED Team");
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>("Needs Review");
  const [completedStepIndices, setCompletedStepIndices] = useState<number[]>([]);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);

  const query = useMemo(() => buildSymptomQuery(symptomText, selectedSymptoms), [selectedSymptoms, symptomText]);
  const suggestions = useMemo(() => getDiagnosisSuggestions(query, encounter.vitals), [encounter.vitals, query]);

  const activeSuggestion = useMemo(
    () => suggestions.find((suggestion) => suggestion.code === selectedCode) ?? suggestions[0] ?? null,
    [selectedCode, suggestions]
  );

  const comparisonSuggestions = suggestions.slice(0, 2);

  const guidance = activeSuggestion ? getGuidance(activeSuggestion) : DEFAULT_GUIDANCE;
  const returnPrecautions = getReturnPrecautions(activeSuggestion?.code ?? null);
  const signalStrength = useMemo(() => {
    let score = 40;
    score += selectedSymptoms.length * 6;
    score += Math.min(20, symptomText.trim().split(/\s+/).filter(Boolean).length / 3);
    if (activeSuggestion?.priority === "High") score += 18;
    if (encounter.vitals.spO2 < 94) score += 10;
    if (encounter.vitals.hr > 110) score += 8;
    if (encounter.vitals.temp >= 100.4) score += 6;
    return Math.max(15, Math.min(95, Math.round(score)));
  }, [activeSuggestion?.priority, encounter.vitals.hr, encounter.vitals.spO2, encounter.vitals.temp, selectedSymptoms.length, symptomText]);

  const redFlags = (() => {
    const flags = new Set<string>();

    if (encounter.vitals.spO2 < 94) flags.add(`Oxygen saturation ${encounter.vitals.spO2}% is below the typical stability threshold.`);
    if (encounter.vitals.spO2 < 90) flags.add("Severe hypoxia may require immediate respiratory escalation.");
    if (encounter.vitals.hr > 120) flags.add(`Marked tachycardia at ${encounter.vitals.hr} bpm.`);
    if (encounter.vitals.temp >= 102) flags.add(`High fever at ${encounter.vitals.temp}°F.`);
    if (activeSuggestion?.priority === "High") flags.add(`Suggested case is high acuity: ${activeSuggestion.description}.`);
    guidance.cautions.forEach((item) => flags.add(item));

    return Array.from(flags).slice(0, 5);
  })();

  const handoffNote = [
    `Case Support Handoff (${new Date().toLocaleString()})`,
    `Chief complaint: ${symptomText || encounter.chiefComplaint || "Not provided"}`,
    `Selected symptoms: ${selectedSymptoms.length > 0 ? selectedSymptoms.join(", ") : "None selected"}`,
    `Vitals: HR ${encounter.vitals.hr}, BP ${encounter.vitals.bp}, SpO2 ${encounter.vitals.spO2}%, Temp ${encounter.vitals.temp}°F`,
    `Likely case: ${activeSuggestion ? `${activeSuggestion.code} - ${activeSuggestion.description}` : "Undifferentiated presentation"}`,
    `Suggested next steps: ${guidance.steps.join(" ")}`,
    `Cautions: ${redFlags.join(" ") || "None identified"}`,
  ].join("\n");

  const escalationBrief = [
    `Escalation Brief (${new Date().toLocaleString()})`,
    `Concern: ${activeSuggestion ? `${activeSuggestion.code} - ${activeSuggestion.description}` : "Undifferentiated presentation"}`,
    `Signal strength: ${signalStrength}%`,
    `Red flags: ${redFlags.join("; ") || "None"}`,
    `Immediate next steps: ${guidance.steps.slice(0, 2).join(" ")}`,
    `Escalate to provider now if instability or neurologic/respiratory decline appears.`,
  ].join("\n");

  const copyHandoffNote = async () => {
    try {
      await navigator.clipboard.writeText(handoffNote);
      setActionLog((current) => [
        { id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), message: "Copied handoff note" },
        ...current,
      ].slice(0, 20));
    } catch {
      // Ignore clipboard failures in environments without permission.
    }
  };

  const copyEscalationBrief = async () => {
    try {
      await navigator.clipboard.writeText(escalationBrief);
      setActionLog((current) => [
        { id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), message: "Copied escalation brief" },
        ...current,
      ].slice(0, 20));
    } catch {
      // Ignore clipboard failures in environments without permission.
    }
  };

  const chartNote = [
    `Chart Note (${new Date().toLocaleString()})`,
    `Chief complaint: ${symptomText || encounter.chiefComplaint || "Not provided"}`,
    `Symptoms selected: ${selectedSymptoms.length > 0 ? selectedSymptoms.join(", ") : "None selected"}`,
    `Vitals: HR ${encounter.vitals.hr}, BP ${encounter.vitals.bp}, SpO2 ${encounter.vitals.spO2}%, Temp ${encounter.vitals.temp}°F`,
    `Likely diagnosis: ${activeSuggestion ? `${activeSuggestion.code} - ${activeSuggestion.description}` : "Undifferentiated presentation"}`,
    `Recommended workup/orders: ${activeSuggestion?.suggestedOrders.length ? activeSuggestion.suggestedOrders.join(", ") : "Clinical reassessment and targeted testing"}`,
    `Next steps: ${guidance.steps.join(" ")}`,
    `Return precautions: ${returnPrecautions.join(" ")}`,
    `Assigned team: ${assignedTeam}`,
    `Workflow status: ${workflowStatus}`,
  ].join("\n");

  const copyChartNote = async () => {
    try {
      await navigator.clipboard.writeText(chartNote);
      setActionLog((current) => [
        { id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), message: "Exported chart note" },
        ...current,
      ].slice(0, 20));
    } catch {
      // Ignore clipboard failures in environments without permission.
    }
  };

  const applyProtocolAction = (action: ProtocolAction) => {
    setSelectedCode(action.code);
    setSelectedSymptoms((current) => Array.from(new Set([...current, ...action.symptoms])));
    setSymptomText((current) => `${current ? `${current} ` : ""}${action.hint}`.trim());
    setWorkflowStatus("Escalated");
    setCompletedStepIndices([]);
    onSelectDiagnosis?.(action.orders);
    setActionLog((current) => [
      { id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), message: `Applied protocol ${action.label}` },
      ...current,
    ].slice(0, 20));
  };

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((current) =>
      current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom]
    );
  };

  const selectSuggestion = (suggestion: DiagnosisSuggestion) => {
    setSelectedCode(suggestion.code);
    setCompletedStepIndices([]);
    onSelectDiagnosis?.(suggestion.suggestedOrders);
    setActionLog((current) => [
      { id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), message: `Selected case ${suggestion.code}` },
      ...current,
    ].slice(0, 20));
  };

  const copyReturnPrecautions = async () => {
    try {
      await navigator.clipboard.writeText(returnPrecautions.join("\n"));
      setActionLog((current) => [
        { id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), message: "Copied return precautions" },
        ...current,
      ].slice(0, 20));
    } catch {
      // Ignore clipboard failures in environments without permission.
    }
  };

  const toggleStepCompletion = (index: number) => {
    setCompletedStepIndices((current) =>
      current.includes(index) ? current.filter((value) => value !== index) : [...current, index]
    );
  };

  const completedSteps = completedStepIndices.length;
  const totalSteps = guidance.steps.length;
  const stepProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const teamPacket = [
    `Team Packet (${new Date().toLocaleString()})`,
    `Team: ${assignedTeam}`,
    `Workflow status: ${workflowStatus}`,
    `Working diagnosis: ${activeSuggestion ? `${activeSuggestion.code} - ${activeSuggestion.description}` : "Undifferentiated presentation"}`,
    `Signal strength: ${signalStrength}%`,
    `Checklist progress: ${completedSteps}/${totalSteps} (${stepProgress}%)`,
    `Immediate red flags: ${redFlags.join("; ") || "None"}`,
    `Top orders: ${activeSuggestion?.suggestedOrders.length ? activeSuggestion.suggestedOrders.join(", ") : "None selected"}`,
    `Return precautions: ${returnPrecautions.join(" ")}`,
  ].join("\n");

  const copyTeamPacket = async () => {
    try {
      await navigator.clipboard.writeText(teamPacket);
      setActionLog((current) => [
        { id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), message: "Copied team packet" },
        ...current,
      ].slice(0, 20));
    } catch {
      // Ignore clipboard failures in environments without permission.
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/60">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-blue-600" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Symptom Intake</p>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Select signs/symptoms or type a narrative presentation.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {COMMON_SYMPTOMS.map((symptom) => {
            const active = selectedSymptoms.includes(symptom);
            return (
              <Button
                key={symptom}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => toggleSymptom(symptom)}
                className="h-8 text-[10px] font-black uppercase"
              >
                {symptom}
              </Button>
            );
          })}
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Narrative symptoms / findings</Label>
          <textarea
            value={symptomText}
            onChange={(event) => setSymptomText(event.target.value.slice(0, 600))}
            rows={4}
            placeholder="Type the full presentation: symptoms, exam findings, and any context..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
          <Badge variant="secondary">HR {encounter.vitals.hr}</Badge>
          <Badge variant="secondary">BP {encounter.vitals.bp}</Badge>
          <Badge variant="secondary">SpO2 {encounter.vitals.spO2}%</Badge>
          <Badge variant="secondary">Temp {encounter.vitals.temp}°F</Badge>
          <Badge variant="secondary">Team {assignedTeam}</Badge>
          <Badge variant="secondary">Status {workflowStatus}</Badge>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Stethoscope className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Possible / Recommended Cases</span>
          <Badge variant="outline" className="ml-auto text-[10px] uppercase">
            {suggestions.length} match{suggestions.length === 1 ? "" : "es"}
          </Badge>
        </div>

        <div className="space-y-2">
          {suggestions.map((suggestion) => {
            const selected = suggestion.code === activeSuggestion?.code;
            return (
              <button
                key={suggestion.code}
                type="button"
                onClick={() => selectSuggestion(suggestion)}
                className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-blue-500 bg-blue-50 shadow-sm dark:bg-blue-950/20" : "border-slate-100 bg-white hover:border-blue-200 dark:border-slate-800 dark:bg-slate-950/60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-blue-600">{suggestion.code}</span>
                      <Badge variant={suggestion.priority === "High" ? "destructive" : "secondary"}>{suggestion.priority}</Badge>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{suggestion.description}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{suggestion.reason}</p>
                  </div>
                  <ChevronRight className={`mt-1 h-4 w-4 ${selected ? "text-blue-600" : "text-slate-300"}`} />
                </div>
                {suggestion.suggestedOrders.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {suggestion.suggestedOrders.map((order) => (
                      <Badge key={`${suggestion.code}-${order}`} variant="outline" className="text-[10px]">
                        {order}
                      </Badge>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Card className="border-slate-200 bg-slate-50/80 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
        <CardContent className="space-y-3 p-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Next Steps</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{guidance.title}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setCompareMode((current) => !current)} className="h-8 text-[10px] font-black uppercase">
                <GitCompareArrows className="mr-1 h-3.5 w-3.5" /> {compareMode ? "Hide Compare" : "Compare Top 2"}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Decision-support signal</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{signalStrength}% match strength</p>
            </div>
            <Badge variant={signalStrength >= 75 ? "default" : signalStrength >= 50 ? "secondary" : "outline"}>
              {signalStrength >= 75 ? "Strong" : signalStrength >= 50 ? "Moderate" : "Low"}
            </Badge>
          </div>
          <ol className="space-y-2">
            {guidance.steps.map((step, index) => (
              <li key={step} className="flex gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => toggleStepCompletion(index)}
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white ${completedStepIndices.includes(index) ? "bg-emerald-600" : "bg-blue-600"}`}
                >
                  {completedStepIndices.includes(index) ? "✓" : "•"}
                </button>
                <span className={completedStepIndices.includes(index) ? "line-through text-slate-400" : ""}>{step}</span>
              </li>
            ))}
          </ol>
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Care Plan Checklist</p>
              <Badge variant="outline">{completedSteps}/{totalSteps} done</Badge>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${stepProgress}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Progress: {stepProgress}%</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-800/60 dark:bg-rose-950/25">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-300">Red Flags</p>
            </div>
            <div className="mt-2 space-y-1">
              {redFlags.length === 0 ? (
                <p className="text-[11px] text-rose-900 dark:text-rose-100">No major escalation flags identified from the available inputs.</p>
              ) : (
                redFlags.map((flag) => (
                  <p key={flag} className="text-[11px] text-rose-900 dark:text-rose-100">
                    {flag}
                  </p>
                ))
              )}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Return Precautions</p>
              <Button type="button" size="sm" variant="outline" onClick={copyReturnPrecautions} className="h-8 text-[10px] font-black uppercase">
                Copy Precautions
              </Button>
            </div>
            <div className="mt-2 space-y-1">
              {returnPrecautions.map((item: string) => (
                <p key={item} className="text-[11px] text-slate-600 dark:text-slate-300">
                  {item}
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Cautions</p>
            </div>
            <div className="mt-2 space-y-1">
              {guidance.cautions.map((item) => (
                <p key={item} className="text-[11px] text-amber-900 dark:text-amber-100">
                  {item}
                </p>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Handoff Note</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={copyEscalationBrief} className="h-8 text-[10px] font-black uppercase">
                  Copy Escalation
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={copyHandoffNote} className="h-8 text-[10px] font-black uppercase">
                  Copy Note
                </Button>
              </div>
            </div>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-300">
              {handoffNote}
            </pre>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Chart Note</p>
              <Button type="button" size="sm" variant="outline" onClick={copyChartNote} className="h-8 text-[10px] font-black uppercase">
                <Copy className="mr-1 h-3.5 w-3.5" /> Export Note
              </Button>
            </div>
            <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-300">
              {chartNote}
            </pre>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Team Packet</p>
              <Button type="button" size="sm" variant="outline" onClick={copyTeamPacket} className="h-8 text-[10px] font-black uppercase">
                <ClipboardCheck className="mr-1 h-3.5 w-3.5" /> Copy Packet
              </Button>
            </div>
            <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-300">
              {teamPacket}
            </pre>
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Team Workflow</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={assignedTeam}
                onChange={(event) => setAssignedTeam(event.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
              >
                <option>ED Team</option>
                <option>Cardiology</option>
                <option>Neurology</option>
                <option>Internal Medicine</option>
                <option>ICU</option>
                <option>Surgery</option>
              </select>
              <select
                value={workflowStatus}
                onChange={(event) => setWorkflowStatus(event.target.value as WorkflowStatus)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
              >
                <option>Needs Review</option>
                <option>In Progress</option>
                <option>Escalated</option>
                <option>Documented</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {PROTOCOL_ACTIONS.map((action) => (
                <Button key={action.code} type="button" size="sm" variant="outline" onClick={() => applyProtocolAction(action)} className="h-8 text-[10px] font-black uppercase">
                  {action.label} / Apply Orders
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Action Timeline</p>
            {actionLog.length === 0 ? (
              <p className="text-[11px] text-slate-500">No actions recorded yet.</p>
            ) : (
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {actionLog.map((item) => (
                  <p key={item.id} className="text-[11px] text-slate-600 dark:text-slate-300">
                    {new Date(item.at).toLocaleTimeString()} - {item.message}
                  </p>
                ))}
              </div>
            )}
          </div>
          {activeSuggestion?.suggestedOrders.length ? (
            <Button
              type="button"
              className="w-full bg-blue-600 text-white hover:bg-blue-500"
              onClick={() => onSelectDiagnosis?.(activeSuggestion.suggestedOrders)}
            >
              Apply Suggested Orders
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {compareMode && comparisonSuggestions.length >= 2 && (
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950/60">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-blue-600" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Compare Top Cases</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {comparisonSuggestions.map((suggestion) => (
                <button
                  key={suggestion.code}
                  type="button"
                  onClick={() => selectSuggestion(suggestion)}
                  className={`rounded-2xl border p-4 text-left transition ${suggestion.code === activeSuggestion?.code ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-slate-200 bg-slate-50 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900/60"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-blue-600">{suggestion.code}</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{suggestion.description}</p>
                    </div>
                    <Badge variant={suggestion.priority === "High" ? "destructive" : "secondary"}>{suggestion.priority}</Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">{suggestion.reason}</p>
                  <div className="mt-3 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Orders</p>
                    <div className="flex flex-wrap gap-1">
                      {suggestion.suggestedOrders.map((order) => (
                        <Badge key={`${suggestion.code}-${order}`} variant="outline" className="text-[10px]">{order}</Badge>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
              <p className="font-black uppercase tracking-[0.2em] text-slate-500">Shared / Unique Orders</p>
              {(() => {
                const [first, second] = comparisonSuggestions;
                if (!first || !second) return null;
                const shared = first.suggestedOrders.filter((order) => second.suggestedOrders.includes(order));
                const uniqueFirst = first.suggestedOrders.filter((order) => !shared.includes(order));
                const uniqueSecond = second.suggestedOrders.filter((order) => !shared.includes(order));
                return (
                  <div className="mt-2 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Shared</p>
                      <p>{shared.length > 0 ? shared.join(", ") : "No overlap"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{first.code}</p>
                      <p>{uniqueFirst.length > 0 ? uniqueFirst.join(", ") : "No unique orders"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{second.code}</p>
                      <p>{uniqueSecond.length > 0 ? uniqueSecond.join(", ") : "No unique orders"}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}