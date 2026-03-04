import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  patients: defineTable({
    name: v.string(),
    mrn: v.string(),
    dob: v.string(),
    gender: v.string(),
    allergies: v.array(v.string()),
    codeStatus: v.optional(v.union(
      v.literal("Full Code"), 
      v.literal("DNR/DNI"), 
      v.literal("DNR-Limited")
    )),
  })
    .index("by_mrn", ["mrn"])
    /** * Search Index: This resolves the "search_patients" error.
     * We allow searching by name and filtering by MRN.
     */
    .searchIndex("search_patients", {
      searchField: "name",
      filterFields: ["mrn"],
    }),
  encounters: defineTable({
    patientId: v.id("patients"),
    status: v.union(
      v.literal("triage"),
      v.literal("waiting"),
      v.literal("treating"),
      v.literal("observed"),
      v.literal("discharged")
    ),
    dischargeSummary: v.optional(v.string()),
    dischargedAt: v.optional(v.number()),
    location: v.optional(v.string()),
    acuity: v.number(),
    chiefComplaint: v.string(),
    vitals: v.object({
      hr: v.number(),
      bp: v.string(),
      temp: v.number(),
      spO2: v.number(),
      previousHr: v.optional(v.number())
    }),
    disposition: v.optional(v.string()),
    followUp: v.optional(v.string()),
    assignedProvider: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    // Add this to fix the getByPatient "Could not find public function" error
    .index("by_patient", ["patientId"]),

  medications: defineTable({
    patientId: v.id("patients"),
    encounterId: v.id("encounters"),
    name: v.string(), // e.g., "Aspirin, Heparin"
    dosage: v.string(), // e.g., "325 mg", "5000 units"
    route: v.string(), // e.g., "Oral", "IV"
    orderedBy: v.string(),
    status: v.union(v.literal("ordered"), v.literal("administered"), v.literal("held")),
    frequency: v.optional(v.number()), // minutes until next dose, e.g., 240 for q4h
    adminTime: v.optional(v.number()),
    adminBy: v.optional(v.string()),
  }).index("by_encounter", ["encounterId"]),

  clinicalNotes: defineTable({
    encounterId: v.id("encounters"),
    content: v.string(),
    type: v.union(
      v.literal("Progress Note"),
      v.literal("Consult"),
      v.literal("Procedure")
    ),
    authorName: v.string(),
    authorRole: v.string(),
    signedAt: v.number(),
  }).index("by_encounter", ["encounterId"]),

    notes: defineTable({
    encounterId: v.id("encounters"),
    author: v.string(), // e.g., "Sophia Ramirez, CCMA"
    category: v.union(v.literal("Triage"), v.literal("Nursing"), v.literal("Procedure")),
    content: v.string(),
    isTemplate: v.boolean(),
  }).index("by_encounter", ["encounterId"]),

labResults: defineTable({
  encounterId: v.id("encounters"),
  testName: v.string(),
  value: v.string(),
  unit: v.string(),
  range: v.string(),
  isAbnormal: v.boolean(),
  status: v.union(v.literal("pending"), v.literal("final")),
  
  // ADD THESE FIELDS:
  acknowledgedBy: v.optional(v.string()),
  acknowledgedAt: v.optional(v.number()),
}).index("by_encounter", ["encounterId"]),

  auditLogs: defineTable({
    userId: v.string(),
    action: v.string(),
    resourceId: v.string(),
    timestamp: v.number(),
  }),
  vitals: defineTable({
    encounterId: v.id("encounters"),
    hr: v.number(),
    bp: v.string(),
    spO2: v.number(),
    temp: v.number(),
    recordedAt: v.number(), // Timestamp for the X-axis
  }).index("by_encounter", ["encounterId"]),
   checklists: defineTable({
      encounterId: v.id("encounters"),
      item: v.string(),
      completed: v.boolean(),
      completedBy: v.optional(v.string()),
    }).index("by_encounter", ["encounterId"]),

    socialHistory: defineTable({
      patientId: v.id("patients"),
      smokingStatus: v.string(),
      livingSituation: v.string(),
      alcoholUse: v.string(),
      lastUpdated: v.number(),
    }).index("by_patient", ["patientId"]),
    labs: defineTable({
      encounterId: v.id("encounters"),
      testName: v.string(), // e.g., "Hemoglobin", "Potassium"
      category: v.string(), // e.g., "CBC", "BMP"
      value: v.number(),
      unit: v.string(),     // e.g., "g/dL", "mEq/L"
      rangeLow: v.number(),
      rangeHigh: v.number(),
      status: v.string(),   // "Final" or "Preliminary"
      resultedAt: v.number(),
    }).index("by_encounter", ["encounterId"]),
    imagingOrders: defineTable({
      encounterId: v.id("encounters"),
      studyName: v.string(), // e.g., "CT Head w/o Contrast"
      modality: v.string(),  // e.g., "CT", "X-Ray", "MRI", "US"
      reason: v.string(),    // e.g., "Rule out ICH"
      status: v.union(
        v.literal("Ordered"), 
        v.literal("In Progress"), 
        v.literal("Resulted")
      ),
      priority: v.string(),  // "STAT" or "Routine"
      report: v.optional(v.string()), // The radiologist's findings
      orderedAt: v.number(),
    }).index("by_encounter", ["encounterId"]),
    triageAssessments: defineTable({
      encounterId: v.id("encounters"),
      // NEURO
      gcsScore: v.number(), // 3-15
      pupils: v.string(),   // e.g., "PERRL", "Sluggish"
      mentalStatus: v.string(),
      // RESPIRATORY
      workOfBreathing: v.string(), // e.g., "Normal", "Labored", "Accessory Muscle Use"
      lungSounds: v.string(),
      // SKIN
      skinTemp: v.string(), // "Warm", "Cool", "Hot"
      skinCondition: v.string(), // "Dry", "Diaphoretic", "Clammy"
      // LOGISTICS
      triageNurse: v.string(),
      completedAt: v.number(),
    }).index("by_encounter", ["encounterId"]),
    discharges: defineTable({
      encounterId: v.id("encounters"),
      diagnosis: v.string(),
      instructions: v.string(),
      redFlags: v.array(v.string()),
      followUp: v.string(), // e.g., "Follow up with Cardiology in 2-3 days"
      isFinalized: v.boolean(),
      dischargedBy: v.string(),
      dischargedAt: v.number(),
    }).index("by_encounter", ["encounterId"]),
    educationLogs: defineTable({
      encounterId: v.id("encounters"),
      topic: v.string(), // e.g., "Wound Care", "Medication Safety"
      method: v.string(), // e.g., "Verbal", "Written", "Video"
      understanding: v.string(), // e.g., "Verbalized back", "Demonstrated"
      completedBy: v.string(),
      completedAt: v.number(),
    }).index("by_encounter", ["encounterId"]),
    appointments: defineTable({
      encounterId: v.id("encounters"),
      specialty: v.string(), // e.g., "Cardiology"
      provider: v.string(),  // e.g., "Dr. Chen"
      address: v.string(),   // e.g., "123 Medical Plaza, Hackensack"
      date: v.string(),      // e.g., "2026-03-05"
      time: v.string(),      // e.g., "14:30"
      instructions: v.optional(v.string()), // e.g., "Fast for 8 hours"
    }).index("by_encounter", ["encounterId"]),
});