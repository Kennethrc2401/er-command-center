export function calculateNEWS2(vitals: { 
  hr: number; 
  spO2: number; 
  temp: number; 
  bp: string; // "120/80"
}) {
  let score = 0;
  const sysBP = parseInt(vitals.bp.split('/')[0]);

  // 1. SpO2 (Oxygen Saturation)
  if (vitals.spO2 <= 91) score += 3;
  else if (vitals.spO2 <= 93) score += 2;
  else if (vitals.spO2 <= 95) score += 1;

  // 2. Temperature (Celsius conversion for logic: 38°C ≈ 100.4°F)
  if (vitals.temp <= 95) score += 3; // Hypothermia
  else if (vitals.temp >= 102.2) score += 3;
  else if (vitals.temp >= 100.4 || vitals.temp <= 96.8) score += 1;

  // 3. Heart Rate
  if (vitals.hr <= 40 || vitals.hr >= 131) score += 3;
  else if (vitals.hr >= 111 || vitals.hr <= 50) score += 2;
  else if (vitals.hr >= 91) score += 1;

  // 4. Systolic BP
  if (sysBP <= 90 || sysBP >= 220) score += 3;
  else if (sysBP <= 100) score += 2;
  else if (sysBP <= 110) score += 1;

  return {
    score,
    level: score >= 7 ? "CRITICAL" : score >= 5 ? "HIGH" : score >= 3 ? "MEDIUM" : "LOW",
    color: score >= 5 ? "text-red-600" : score >= 3 ? "text-amber-600" : "text-emerald-600"
  };
}