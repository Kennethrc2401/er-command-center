export const GET_INSTRUCTIONS = (complaint: string) => {
  const c = complaint.toLowerCase();
  if (c.includes("chest pain")) return {
    title: "Post-Chest Pain Care",
    instructions: [
      "Follow up with Cardiology within 72 hours.",
      "Take Aspirin 81mg daily if prescribed.",
      "Return to ER for: Crushing pain, jaw pain, or severe shortness of breath."
    ]
  };
  if (c.includes("fever") || c.includes("infection")) return {
    title: "Infection Management",
    instructions: [
      "Complete the full course of antibiotics.",
      "Monitor temperature every 4 hours.",
      "Return to ER for: Confusion, rash, or inability to keep fluids down."
    ]
  };
  return {
    title: "General Discharge Care",
    instructions: [
      "Rest and increase fluid intake.",
      "Follow up with your Primary Care Provider.",
      "Return to ER if symptoms worsen significantly."
    ]
  };
};