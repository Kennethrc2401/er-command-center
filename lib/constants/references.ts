export const CLINICAL_REF = {
  LABS: [
    { name: "WBC", range: "4.5 - 11.0 x10³/µL", critical: "< 2.5 or > 30.0", note: "Indicator of infection or stress." },
    { name: "Potassium (K+)", range: "3.5 - 5.0 mEq/L", critical: "< 2.5 or > 6.5", note: "High risk for cardiac arrhythmia." },
    { name: "Hemoglobin (Hgb)", range: "M: 13.8-17.2 | F: 12.1-15.1", critical: "< 7.0", note: "Transfusion threshold is usually 7.0." },
    { name: "Sodium (Na+)", range: "135 - 145 mEq/L", critical: "< 120 or > 160", note: "Neurological status risk." },
    { name: "Glucose", range: "70 - 99 mg/dL (fasting)", critical: "< 40 or > 400", note: "Risk of hypoglycemia or hyperglycemic crisis." },
    { name: "Creatinine", range: "0.6 - 1.2 mg/dL", critical: "> 4.0", note: "Indicates severe renal impairment." },
    { name: "Troponin", range: "< 0.04 ng/mL", critical: "> 0.40 ng/mL", note: "Highly specific for myocardial injury." },
    { name: "Lactate", range: "0.5 - 2.2 mmol/L", critical: "> 4.0", note: "Marker of tissue hypoperfusion and sepsis." },
    { name: "D-dimer", range: "< 500 ng/mL FEU", critical: "> 2000 ng/mL FEU", note: "Elevated in thrombotic events, but non-specific." },
    { name: "CRP", range: "< 10 mg/L", critical: "> 100 mg/L", note: "Marker of inflammation, elevated in severe infections." },
    { name: "ESR", range: "0 - 20 mm/hr", critical: "> 100 mm/hr", note: "Non-specific marker of inflammation, elevated in severe infections." },
    { name: "BNP", range: "< 100 pg/mL", critical: "> 500 pg/mL", note: "Elevated in heart failure, but non-specific." },
    { name: "ALT", range: "7 - 56 U/L", critical: "> 300 U/L", note: "Indicates severe liver injury." },
    { name: "AST", range: "10 - 40 U/L", critical: "> 300 U/L", note: "Indicates severe liver injury." },
    { name: "Alkaline Phosphatase", range: "44 - 147 U/L", critical: "> 500 U/L", note: "Elevated in biliary obstruction or severe liver disease." },
    { name: "Total Bilirubin", range: "0.1 - 1.2 mg/dL", critical: "> 5.0 mg/dL", note: "Indicates severe liver dysfunction or hemolysis." },
    { name: "Amylase", range: "23 - 85 U/L", critical: "> 300 U/L", note: "Elevated in acute pancreatitis." },
    { name: "Lipase", range: "0 - 160 U/L", critical: "> 300 U/L", note: "More specific than amylase for pancreatitis." },
    { name: "Procalcitonin", range: "< 0.1 ng/mL", critical: "> 2.0 ng/mL", note: "Marker of bacterial infection and sepsis." },
    { name: "INR", range: "0.8 - 1.2 (not on anticoagulants)", critical: "> 5.0", note: "High risk of bleeding." },
    { name: "PTT", range: "25 - 35 seconds", critical: "> 70 seconds", note: "High risk of bleeding." },
    { name: "Platelets", range: "150 - 450 x10³/µL", critical: "< 50 or > 1000", note: "Risk of bleeding or thrombosis." },
    { name: "Bun", range: "7 - 20 mg/dL", critical: "> 100 mg/dL", note: "Indicates severe renal impairment." },
    { name: "GFR", range: "> 90 mL/min/1.73m²", critical: "< 15 mL/min/1.73m²", note: "Indicates end-stage renal disease." },
    { name: "HbA1c", range: "< 5.7%", critical: "> 9.0%", note: "Indicates poor long-term glucose control." },
  ],
  VITALS: [
    { name: "BP", range: "120/80", critical: "> 180/120 (Crisis)", note: "Hypertensive Crisis requires immediate IV meds." },
    { name: "O2 Sat", range: "95% - 100%", critical: "< 90%", note: "Consider O2 for anything under 94% in ER." },
    { name: "HR", range: "60 - 100 bpm", critical: "< 50 or > 120 bpm", note: "Bradycardia or tachycardia may require intervention." },
    { name: "Temp", range: "97°F - 99°F", critical: "< 95°F or > 104°F", note: "Hypothermia or hyperthermia can be life-threatening." },
    { name: "Resp Rate", range: "12 - 20 breaths/min", critical: "< 8 or > 30 breaths/min", note: "Bradypnea or tachypnea may indicate respiratory distress." },
  ],
  GYN_PROCEDURES: [
    {
      name: "Pap Smear (Cervical Cytology)",
      setupGoal: "Prepare room, patient supplies, and specimen tools before provider exam.",
      scopeNote: "Specimen collection is provider-dependent per facility policy; support within your role scope.",
      supplies: [
        "Exam table with clean stirrups and drape",
        "Appropriate speculum sizes (small/medium/large)",
        "Water-based lubricant (minimal amount for cytology quality)",
        "Cervical broom/brush or spatula + endocervical brush per kit type",
        "Labeled cytology vial or prepared slide set",
        "PPE: gloves, eye protection, mask as indicated",
        "Light source and absorbent pads",
        "Biohazard container and specimen transport bag"
      ],
      prepSteps: [
        "Verify patient identity, indication, consent, and allergies.",
        "Confirm required order details and label specimen container before start.",
        "Pre-position all collection tools on clean field before patient is in position.",
        "Offer chaperone per policy and document availability/acceptance.",
        "Coach patient on sequence: positioning, speculum insertion, brief sampling, and after-care."
      ],
      setupChecklist: [
        "Speculum size options opened/ready",
        "Cytology kit complete and not expired",
        "Labels match patient identifiers",
        "Lab requisition and transport pathway prepared",
        "Chaperone workflow confirmed"
      ]
    },
    {
      name: "Pelvic Exam Assist Setup",
      setupGoal: "Standardized setup for routine gynecologic evaluation and cultures.",
      scopeNote: "Assist provider and maintain patient comfort, privacy, and documentation support.",
      supplies: [
        "Speculum and exam gloves",
        "Swab kits for STI/vaginitis testing when ordered",
        "pH/wet prep supplies per clinic workflow",
        "Drape, absorbent pads, warm blanket",
        "Specimen labels and test requisitions"
      ],
      prepSteps: [
        "Prepare private room and explain each exam phase before start.",
        "Ensure cultures and containers match ordered tests.",
        "Confirm comfort items and positioning aids are available.",
        "Track specimen sequence to avoid collection errors.",
        "Review post-exam instructions and expected follow-up timeline."
      ],
      setupChecklist: [
        "Room privacy and chaperone confirmed",
        "Culture kits opened only when provider ready",
        "Correct container per test type",
        "Specimens labeled at bedside",
        "After-care education reviewed"
      ]
    }
  ],
  PROCEDURE_PREP_GUIDES: [
    {
      name: "Pap Smear (Cervical Cytology)",
      unit: "Clinic",
      setupGoal: "Prepare room, patient supplies, and specimen tools before provider exam.",
      scopeNote: "Specimen collection is provider-dependent per facility policy; support within your role scope.",
      supplies: [
        "Exam table with clean stirrups and drape",
        "Appropriate speculum sizes (small/medium/large)",
        "Water-based lubricant (minimal amount for cytology quality)",
        "Cervical broom/brush or spatula + endocervical brush per kit type",
        "Labeled cytology vial or prepared slide set",
        "PPE: gloves, eye protection, mask as indicated",
        "Light source and absorbent pads",
        "Biohazard container and specimen transport bag"
      ],
      prepSteps: [
        "Verify patient identity, indication, consent, and allergies.",
        "Confirm required order details and label specimen container before start.",
        "Pre-position all collection tools on clean field before patient is in position.",
        "Offer chaperone per policy and document availability/acceptance.",
        "Coach patient on sequence: positioning, speculum insertion, brief sampling, and after-care."
      ],
      setupChecklist: [
        "Speculum size options opened/ready",
        "Cytology kit complete and not expired",
        "Labels match patient identifiers",
        "Lab requisition and transport pathway prepared",
        "Chaperone workflow confirmed"
      ]
    },
    {
      name: "Pelvic Exam Assist Setup",
      unit: "Clinic",
      setupGoal: "Standardized setup for routine gynecologic evaluation and cultures.",
      scopeNote: "Assist provider and maintain patient comfort, privacy, and documentation support.",
      supplies: [
        "Speculum and exam gloves",
        "Swab kits for STI/vaginitis testing when ordered",
        "pH/wet prep supplies per clinic workflow",
        "Drape, absorbent pads, warm blanket",
        "Specimen labels and test requisitions"
      ],
      prepSteps: [
        "Prepare private room and explain each exam phase before start.",
        "Ensure cultures and containers match ordered tests.",
        "Confirm comfort items and positioning aids are available.",
        "Track specimen sequence to avoid collection errors.",
        "Review post-exam instructions and expected follow-up timeline."
      ],
      setupChecklist: [
        "Room privacy and chaperone confirmed",
        "Culture kits opened only when provider ready",
        "Correct container per test type",
        "Specimens labeled at bedside",
        "After-care education reviewed"
      ]
    },
    {
      name: "IUD Insertion Assist",
      unit: "Clinic",
      setupGoal: "Prepare sterile instrument field and supplies for provider insertion.",
      scopeNote: "Insertion is provider-performed; confirm device type and lot documentation workflow.",
      supplies: [
        "Sterile speculum and tenaculum set per policy",
        "IUD kit and sterile uterine sound",
        "Antiseptic swabs and sterile gloves",
        "Scissors for string trim",
        "Pregnancy test result/verification per protocol",
        "Patient label and device lot documentation form"
      ],
      prepSteps: [
        "Confirm informed consent and pregnancy exclusion protocol completion.",
        "Verify exact device and expiration before opening.",
        "Set sterile field and keep backup instruments available.",
        "Prepare label/lot traceability documentation before insertion.",
        "Review post-procedure expectations and warning signs with patient."
      ],
      setupChecklist: [
        "Correct IUD and lot number verified",
        "Sterile field complete",
        "Backup device available if needed",
        "Post-care instruction sheet ready",
        "Follow-up timing documented"
      ]
    },
    {
      name: "Colposcopy With Biopsy Assist",
      unit: "Clinic",
      setupGoal: "Prepare biopsy and hemostasis tools for efficient and safe provider workflow.",
      scopeNote: "Biopsy decisions remain provider-directed; assist with specimens and comfort support.",
      supplies: [
        "Colposcopy light/accessory setup",
        "Speculum and biopsy forceps",
        "Acetic acid/Lugol's solution per protocol",
        "Biopsy specimen containers with labels",
        "Hemostasis supplies (for example, swabs/agents per policy)",
        "PPE and absorbent pads"
      ],
      prepSteps: [
        "Confirm indication and pathology labeling requirements.",
        "Arrange specimen containers in expected collection order.",
        "Set hemostasis materials within immediate reach.",
        "Coach patient regarding pressure/cramping expectations.",
        "Verify post-biopsy restrictions and bleeding guidance are available."
      ],
      setupChecklist: [
        "Specimens pre-labeled in correct order",
        "Hemostasis supplies available",
        "Chaperone/patient comfort plan confirmed",
        "Pathology requisition prepared",
        "After-care instructions printed"
      ]
    },
    {
      name: "Endometrial Biopsy Assist",
      unit: "Clinic",
      setupGoal: "Prepare sterile collection workflow and pathology handoff for endometrial sampling.",
      scopeNote: "Procedure and sampling are provider-performed; assist with setup, safety checks, and specimen handling.",
      supplies: [
        "Speculum and sterile gloves",
        "Uterine sound and biopsy pipelle/cannula kit",
        "Antiseptic prep supplies",
        "Labeled pathology container",
        "Absorbent pads and comfort items"
      ],
      prepSteps: [
        "Confirm indication and any required pre-procedure testing.",
        "Prepare labeled specimen container before procedure begins.",
        "Organize instrument sequence to reduce delay.",
        "Support patient positioning and comfort throughout.",
        "Review expected spotting and return precautions post-procedure."
      ],
      setupChecklist: [
        "Instrument sequence staged",
        "Specimen container and requisition ready",
        "Patient comfort supplies available",
        "Bleeding precaution instructions ready",
        "Follow-up plan documented"
      ]
    },
    {
      name: "Vaginal Delivery Room Setup",
      unit: "Labor & Delivery",
      setupGoal: "Prepare delivery suite for routine vaginal delivery and immediate newborn care.",
      scopeNote: "Follow labor-stage-specific protocols and provider direction.",
      supplies: [
        "Delivery table pack and sterile drapes",
        "Perineal repair tray supplies",
        "Suction and oxygen setup checked",
        "Neonatal warmer turned on and stocked",
        "Cord clamps/cutting tools",
        "Postpartum uterotonic medications per protocol"
      ],
      prepSteps: [
        "Complete maternal ID/allergy verification and labor status handoff.",
        "Warm and test neonatal equipment before active delivery phase.",
        "Open sterile packs when provider confirms timing.",
        "Prepare hemorrhage response supplies nearby.",
        "Set postpartum recovery essentials in room before delivery."
      ],
      setupChecklist: [
        "Warmer active and ready",
        "Delivery/repair packs available",
        "Uterotonics immediately accessible",
        "Hemorrhage backup supplies nearby",
        "Newborn ID bands ready"
      ]
    },
    {
      name: "Cesarean Section OR Prep",
      unit: "Labor & Delivery",
      setupGoal: "Prepare OR workflow, safety checks, and maternal-newborn support for C-section.",
      scopeNote: "OR flow and sterile setup follow institutional obstetric surgery protocol.",
      supplies: [
        "C-section instrument tray and sterile drapes",
        "Anesthesia and airway support check complete",
        "Neonatal warmer and resuscitation tools",
        "Sequential compression devices per protocol",
        "Blood availability confirmation per risk profile",
        "Counts documentation board ready"
      ],
      prepSteps: [
        "Complete pre-op verification and surgical timeout readiness.",
        "Confirm fetal monitoring transition plan to OR.",
        "Coordinate neonatal team presence when indicated.",
        "Set expected specimen and count documentation workflow.",
        "Prepare PACU/post-op handoff checklist before incision."
      ],
      setupChecklist: [
        "OR timeout components ready",
        "Neonatal support team aware",
        "Counts board/recording ready",
        "Blood readiness checked",
        "Post-op destination confirmed"
      ]
    },
    {
      name: "Postpartum Hemorrhage Response Setup",
      unit: "Labor & Delivery",
      setupGoal: "Stage rapid-response supplies for high-risk bleeding scenarios.",
      scopeNote: "Emergency treatment decisions are provider-led; staff readiness is critical.",
      supplies: [
        "PPH cart with uterotonics per protocol",
        "Large-bore IV access kits and fluid warmers",
        "Quantitative blood loss tools",
        "Transfusion tubing and blood request workflow",
        "Bakri/balloon tamponade supplies if used onsite",
        "Rapid lab draw kits"
      ],
      prepSteps: [
        "Identify high-risk patients and stage hemorrhage resources early.",
        "Assign response roles before emergency escalation.",
        "Confirm transfusion activation pathway and contacts.",
        "Pre-stage lab labels for stat CBC/coagulation workflows.",
        "Rehearse closed-loop communication points with team."
      ],
      setupChecklist: [
        "PPH cart checked",
        "Role assignments discussed",
        "Transfusion pathway confirmed",
        "QBL tools present",
        "Escalation contacts visible"
      ]
    },
    {
      name: "Fetal Non-Stress Test (NST) Setup",
      unit: "Labor & Delivery",
      setupGoal: "Prepare monitoring environment for accurate fetal assessment.",
      scopeNote: "Interpretation and escalation remain provider-directed per fetal monitoring policy.",
      supplies: [
        "Fetal monitor with functioning transducers",
        "Gel and belts/positioning straps",
        "Maternal positioning supports",
        "Event marker button if used",
        "Printer/charting supplies"
      ],
      prepSteps: [
        "Verify patient and gestational context before hookup.",
        "Optimize maternal positioning for signal quality.",
        "Label tracing with correct patient identifiers.",
        "Educate patient on test duration and movement cues.",
        "Escalate persistent non-reassuring patterns per protocol."
      ],
      setupChecklist: [
        "Signal quality verified",
        "Tracing correctly labeled",
        "Maternal comfort optimized",
        "Provider notification threshold clear",
        "Documentation complete"
      ]
    },
    {
      name: "Neonatal Stabilization Warmer Setup",
      unit: "Labor & Delivery",
      setupGoal: "Prepare immediate newborn support area before delivery.",
      scopeNote: "Use neonatal response protocols and team role assignments.",
      supplies: [
        "Pre-warmed radiant warmer",
        "Neonatal bag-mask and suction setup",
        "Pulse oximeter with neonatal probe",
        "Towels, hat, and thermoregulation supplies",
        "Umbilical clamp and ID bands"
      ],
      prepSteps: [
        "Power on and verify warmer temperature before delivery.",
        "Check suction and ventilation equipment functionality.",
        "Set out dry linens and thermal supports.",
        "Confirm neonatal documentation and ID process.",
        "Review resuscitation trigger criteria with team."
      ],
      setupChecklist: [
        "Warmer verified",
        "Ventilation/suction checked",
        "Thermal supplies ready",
        "ID workflow prepared",
        "Escalation pathway known"
      ]
    },
    {
      name: "Foley Catheter Insertion Assist",
      unit: "Hospital",
      setupGoal: "Support sterile urinary catheter insertion and secure drainage setup.",
      scopeNote: "Insertion responsibility follows role scope and local policy.",
      supplies: [
        "Sterile catheter kit (correct catheter size)",
        "Securement device and drainage bag",
        "Perineal prep supplies",
        "Sterile gloves and drape",
        "Label/time documentation"
      ],
      prepSteps: [
        "Verify indication and allergy status.",
        "Select correct catheter type and size before opening kit.",
        "Maintain sterile field throughout insertion process.",
        "Secure tubing to reduce traction injury.",
        "Document indication, output baseline, and insertion time."
      ],
      setupChecklist: [
        "Indication confirmed",
        "Correct catheter selected",
        "Sterile field maintained",
        "Securement placed",
        "Documentation complete"
      ]
    },
    {
      name: "Laceration Repair Tray Setup",
      unit: "Hospital",
      setupGoal: "Stage wound irrigation and closure supplies before provider repair.",
      scopeNote: "Local anesthetic and closure technique are provider-directed.",
      supplies: [
        "Sterile suture tray and instruments",
        "Irrigation supplies and sterile saline",
        "Local anesthetic setup per order",
        "Sutures/adhesive strips based on expected repair",
        "Dressing supplies and sharps container"
      ],
      prepSteps: [
        "Confirm wound location, contamination risk, and tetanus status workflow.",
        "Set irrigation and repair tools in sequence.",
        "Prepare dressing supplies for immediate post-repair coverage.",
        "Anticipate additional closure materials for deep/complex wounds.",
        "Provide discharge wound-care instructions per protocol."
      ],
      setupChecklist: [
        "Irrigation setup complete",
        "Closure materials available",
        "Anesthetic supplies ready",
        "Dressing materials staged",
        "Discharge care sheet prepared"
      ]
    },
    {
      name: "Peripheral IV Start and Blood Draw Setup",
      unit: "Hospital",
      setupGoal: "Prepare safe venous access and specimen collection workflow.",
      scopeNote: "Follow specimen labeling-at-bedside and line-maintenance standards.",
      supplies: [
        "Tourniquet, antiseptic prep, and IV catheters",
        "Vacutainer tubes in ordered sequence",
        "Flushes, extension tubing, and dressing",
        "Specimen labels and transport bags",
        "Sharps container and gauze"
      ],
      prepSteps: [
        "Verify patient identity and ordered labs before sticks.",
        "Stage tubes by draw order and label plan.",
        "Secure line and check patency after placement.",
        "Label all specimens at bedside immediately.",
        "Document site, gauge, attempts, and tolerance."
      ],
      setupChecklist: [
        "Orders and draw tubes matched",
        "IV supplies staged",
        "Line secured and flushed",
        "Bedside labeling completed",
        "Transport handoff complete"
      ]
    },
    {
      name: "Sterile Wound Dressing Change Setup",
      unit: "Hospital",
      setupGoal: "Prepare aseptic dressing change supplies and pain-support workflow.",
      scopeNote: "Wound assessment/escalation follows wound-care and provider protocols.",
      supplies: [
        "Sterile gloves and dressing kit",
        "Cleansing solution per order",
        "Primary and secondary dressing materials",
        "Tape/securement and disposal supplies",
        "Pain-management timing plan"
      ],
      prepSteps: [
        "Review wound orders and pre-medication timing when indicated.",
        "Set out sterile materials before old dressing removal.",
        "Measure/describe wound findings per documentation standard.",
        "Apply ordered dressing layers and secure properly.",
        "Educate patient on signs requiring urgent reassessment."
      ],
      setupChecklist: [
        "Orders reviewed",
        "Sterile supplies staged",
        "Pain support timed",
        "Wound measurements documented",
        "Follow-up monitoring plan clear"
      ]
    }
  ],
  DRUG_DICTIONARY: [
    {
      name: "Epinephrine",
      class: "Adrenergic agonist",
      indications: "Anaphylaxis, cardiac arrest, severe asthma with impending airway compromise.",
      adultDose: "Anaphylaxis IM: 0.3-0.5 mg of 1 mg/mL every 5-15 min as needed. Cardiac arrest IV/IO: 1 mg of 0.1 mg/mL every 3-5 min.",
      monitoring: "Continuous cardiac monitoring, blood pressure, respiratory status, symptom response.",
      cautions: "Use caution with severe coronary disease; dosing concentration errors are high-risk.",
    },
    {
      name: "Naloxone",
      class: "Opioid antagonist",
      indications: "Suspected opioid overdose with respiratory depression.",
      adultDose: "0.04-0.4 mg IV/IM/IN titrated to respiratory effort; may repeat every 2-3 min.",
      monitoring: "Respiratory rate, oxygen saturation, mental status, recurrence of sedation.",
      cautions: "May precipitate acute withdrawal; observe for renarcotization.",
    },
    {
      name: "Nitroglycerin",
      class: "Nitrate vasodilator",
      indications: "Chest pain suggestive of ischemia, hypertensive pulmonary edema.",
      adultDose: "SL: 0.3-0.4 mg every 5 min up to 3 doses if blood pressure tolerates.",
      monitoring: "Blood pressure, chest pain response, headache, dizziness.",
      cautions: "Contraindicated with PDE-5 inhibitors and significant hypotension.",
    },
    {
      name: "Aspirin",
      class: "Antiplatelet",
      indications: "Suspected acute coronary syndrome unless contraindicated.",
      adultDose: "162-325 mg chewable once.",
      monitoring: "Bleeding risk, allergy history, GI symptoms.",
      cautions: "Avoid in true aspirin allergy or active major bleeding.",
    },
    {
      name: "Amiodarone",
      class: "Class III antiarrhythmic",
      indications: "Refractory ventricular fibrillation/pulseless VT, stable wide-complex tachycardia per protocol.",
      adultDose: "Cardiac arrest: 300 mg IV/IO bolus, then 150 mg once if needed.",
      monitoring: "Cardiac rhythm, blood pressure, QT interval when feasible.",
      cautions: "Can cause hypotension and bradycardia; use protocol-specific infusion guidance.",
    },
    {
      name: "Adenosine",
      class: "AV nodal blocker",
      indications: "Stable narrow-complex SVT.",
      adultDose: "6 mg rapid IV push, then 12 mg if needed.",
      monitoring: "Continuous ECG, rhythm conversion, symptoms during transient pause.",
      cautions: "Transient flushing/chest discomfort expected; avoid in irregular wide-complex tachycardia.",
    },
    {
      name: "Magnesium Sulfate",
      class: "Electrolyte / antiarrhythmic adjunct",
      indications: "Torsades de pointes, severe hypomagnesemia, selected severe asthma cases.",
      adultDose: "Torsades: 1-2 g IV/IO diluted over 5-20 min.",
      monitoring: "Cardiac rhythm, reflexes and respiratory status with repeated dosing.",
      cautions: "Rapid administration may cause hypotension or flushing.",
    },
    {
      name: "Ceftriaxone",
      class: "Third-generation cephalosporin",
      indications: "Empiric coverage in sepsis pathways and serious bacterial infections per protocol.",
      adultDose: "1-2 g IV every 24 hours, indication dependent.",
      monitoring: "Allergy history, infection response markers, culture data.",
      cautions: "Assess beta-lactam allergy history; adjust regimen for source-directed care.",
    },
    {
      name: "Vancomycin",
      class: "Glycopeptide antibiotic",
      indications: "Serious gram-positive infection coverage, including MRSA risk.",
      adultDose: "Weight-based dosing per pharmacy protocol (commonly 15-20 mg/kg).",
      monitoring: "Renal function, infusion reactions, therapeutic level strategy per facility.",
      cautions: "Infuse per protocol to reduce infusion reaction risk; monitor nephrotoxicity.",
    },
    {
      name: "Insulin Regular",
      class: "Short-acting insulin",
      indications: "Hyperglycemic emergency pathways including DKA/HHS per protocol.",
      adultDose: "Protocol-driven IV infusion after initial resuscitation and potassium review.",
      monitoring: "Hourly glucose, potassium, anion gap, mental status and fluid status.",
      cautions: "Do not start insulin infusion without potassium safety checks per protocol.",
    },
    {
      name: "Dextrose (D10/D50)",
      class: "Carbohydrate replacement",
      indications: "Symptomatic hypoglycemia.",
      adultDose: "D10: 100-250 mL IV titrated; D50: 25 g IV when appropriate by protocol.",
      monitoring: "Repeat glucose checks and mental status response.",
      cautions: "Ensure secure IV access to avoid extravasation with concentrated formulations.",
    },
    {
      name: "Heparin (Unfractionated)",
      class: "Anticoagulant",
      indications: "Selected ACS, PE/DVT pathways, and protocol-driven anticoagulation needs.",
      adultDose: "Bolus and infusion per protocol and indication-specific nomogram.",
      monitoring: "aPTT/anti-Xa strategy, bleeding signs, platelet trends.",
      cautions: "Evaluate bleeding risk and contraindications before initiation.",
    }
  ]
};