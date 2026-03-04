const TEMPLATES = {
  CHEST_PAIN: {
    label: "Chest Pain / ACS",
    text: "Patient presents with chest pain described as [Pressure/Sharp]. Onset: [Time]. Radiating to: [Back/Arm/Jaw]. Associated symptoms: [SOB/Nausea/Diaphoresis]. Initial EKG: [Pending/Completed]. Aspirin: [Given/Refused].",
  },
  RESPIRATORY: {
    label: "Resp Distress / SOB",
    text: "Increased work of breathing noted. Lung sounds: [Wheezing/Crackles/Clear]. O2 Sat: [%] on [Room Air/NC/NRM]. Patient [is/is not] using accessory muscles. Peak flow: [Value] if applicable.",
  },
  ABDOMINAL: {
    label: "Abdominal Pain",
    text: "Pain located in [RUQ/LUQ/RLQ/LLQ/Epigastric]. Described as [Crampy/Constant/Dull]. Last BM: [Time/Date]. Nausea/Vomiting: [Yes/No]. Guarding/Rebound: [None/Present].",
  }
};

export default TEMPLATES;