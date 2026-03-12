export const RED_FLAG_KEYWORDS = [
  "chest pain", 
  "shortness of breath", 
  "sob", 
  "stroke", 
  "facial droop", 
  "heavy bleeding", 
  "unconscious", 
  "seizure"
];

export const isHighRiskComplaint = (complaint: string) => {
  const normalized = complaint.toLowerCase();
  return RED_FLAG_KEYWORDS.some(keyword => normalized.includes(keyword));
};