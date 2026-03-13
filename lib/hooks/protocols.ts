export interface Protocol {
  id: string;
  title: string;
  category: "Cardiac" | "Respiratory" | "Neurological" | "General";
  steps: string[];
}

export const PROTOCOL_LIBRARY: Protocol[] = [
  {
    id: "stroke-alert",
    title: "Stroke Alert (Code Gray)",
    category: "Neurological",
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
    steps: [
      "Identify/treat underlying cause",
      "Maintain airway; assist breathing if needed",
      "Cardiac monitoring; BP and Oximetry",
      "If unstable: Synchronized Cardioversion"
    ]
  }
];