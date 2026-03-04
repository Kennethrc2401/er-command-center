export const checkAllergyConflict = (patientAllergies: string[], medName: string) => {
  const normalizedMed = medName.toLowerCase().trim();
  
  // Check for direct matches or partial matches (e.g., "Penicillin" matches "Penicillin G")
  const conflict = patientAllergies.find(allergy => 
    normalizedMed.includes(allergy.toLowerCase().trim())
  );

  return conflict ? { hasConflict: true, allergen: conflict } : { hasConflict: false };
};