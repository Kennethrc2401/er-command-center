export interface DiagnosisSuggestion {
  code: string;
  description: string;
  reason: string;
  priority: "High" | "Medium";
}

export interface VitalsData {
  hr: number;
  bp: string;
  spO2: number;
  temp: number;
}

export function getDiagnosisSuggestions(complaint: string, vitals: VitalsData): DiagnosisSuggestion[] {
  const suggestions: DiagnosisSuggestion[] = [];
  const text = complaint.toLowerCase();

  // 🫀 Cardiac Logic
  if (text.includes("chest pain") || text.includes("pressure")) {
    if (vitals.hr > 100 || vitals.bp.includes("160/")) {
      suggestions.push({ 
        code: "I20.9", 
        description: "Angina Pectoris, Unspecified", 
        reason: "Suggested due to chest pain with elevated vitals." 
      , priority: "High" });
    } else {
      suggestions.push({ 
        code: "R07.9", 
        description: "Chest Pain, Unspecified", 
        reason: "Symptomatic coding for reported chest discomfort." 
      , priority: "Medium" });
    }
  }

  // 🫁 Respiratory Logic
  if (text.includes("shortness of breath") || text.includes("sob") || text.includes("difficulty breathing")) {
    suggestions.push({ 
      code: "R06.02", 
      description: "Shortness of Breath", 
      reason: "Direct match for respiratory distress complaint." 
    , priority: "High" });
    if (vitals.spO2 < 94) {
      suggestions.push({ 
        code: "J96.00", 
        description: "Acute Respiratory Failure", 
        reason: "Suggested due to hypoxia (SpO2 < 94%)." 
      , priority: "High" });
    }
  }

  // 🤒 Infection/Fever Logic
  if (vitals.temp >= 100.4 || text.includes("fever") || text.includes("chills")) {
    suggestions.push({ 
      code: "R50.9", 
      description: "Fever, Unspecified", 
      reason: "Clinical temperature recorded ≥ 100.4°F." 
    , priority: "Medium" });
    if (text.includes("cough")) {
      suggestions.push({ 
        code: "J06.9", 
        description: "Acute Upper Respiratory Infection", 
        reason: "Combination of fever and cough symptoms." 
      , priority: "Medium" });
    }
  }

  // 🧠 Neurological Logic
  if (text.includes("headache") || text.includes("migraine")) {
    suggestions.push({ 
      code: "R51.9", 
      description: "Headache, Unspecified", 
      reason: "Direct match for cephalalgia complaint." 
    , priority: "Medium" });
  }

//   🩸 Sepsis Logic (simplified)
  if (text.includes("sepsis") || text.includes("septic")) {
    suggestions.push({ 
      code: "A41.9", 
      description: "Sepsis, Unspecified", 
      reason: "Direct match for sepsis complaint." 
    , priority: "High" });
  }

//   🩺 General Symptom Logic
    if (suggestions.length === 0) {
    suggestions.push({ 
      code: "R69", 
      description: "Illness, Unspecified", 
      reason: "Fallback code for non-specific symptoms." 
    , priority: "Medium" });
  }
  
  return suggestions;
}

// This logic is intentionally simplified for demonstration purposes. In a real clinical application, the decision tree would be far more complex and would likely integrate with a medical knowledge base or use machine learning models for more accurate suggestions.