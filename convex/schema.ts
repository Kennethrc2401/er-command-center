import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  patients: defineTable({
    name: v.string(),
    mrn: v.string(),
    dob: v.string(),
    searchVector: v.string(), 
    gender: v.string(),
    allergies: v.array(v.string()),
    codeStatus: v.optional(v.union(
      v.literal("Full Code"), 
      v.literal("DNR/DNI"), 
      v.literal("DNR-Limited")
    )),
    isHighRisk: v.optional(v.boolean()),
    medicalHistory: v.optional(v.array(v.string())),
    socialHistory: v.optional(v.string()),
    familyHistory: v.optional(v.string()),
    // 🩺 Current Snapshot (The latest data)
    vitals: v.optional(
      v.object({
        hr: v.number(),
        bp: v.string(),
        temp: v.number(),
        spO2: v.number(),
        timestamp: v.optional(v.number()), // Time of last entry
      })
    ),
    // 📈 Historical Trend (The "Sparkline" Data)
    vitalsHistory: v.optional(
      v.array(
        v.object({
          hr: v.number(),
          bp: v.string(),
          temp: v.number(),
          spO2: v.number(),
          timestamp: v.number(), // Required for chronological graphing
        })
      )
    ),
  })
  .index("by_mrn", ["mrn"])
  .searchIndex("search_patients", {
    searchField: "searchVector",
  })
  .searchIndex("search_name", {
    searchField: "name",
  }),
  users: defineTable({
    name: v.string(),
    email: v.string(),
    username: v.optional(v.string()),
    role: v.union(
      v.literal("ADMIN"), 
      v.literal("DOCTOR"), 
      v.literal("NURSE"), 
      v.literal("CCMA")
    ),
    credentials: v.string(), // e.g., "MD, FACS" or "RN, BSN"
    department: v.string(),
    status: v.union(v.literal("ACTIVE"), v.literal("INACTIVE")),
    npiNumber: v.optional(v.string()), // Required for doctors
    passwordHash: v.optional(v.string()),
    officeKeyHash: v.optional(v.string()),
    credentialUpdatedAt: v.optional(v.number()),
    failedLoginAttempts: v.optional(v.number()),
    lastFailedLoginAt: v.optional(v.number()),
    lockedUntil: v.optional(v.number()),
  })
  .index("by_email", ["email"])
  .index("by_username", ["username"])
  .index("by_role", ["role"]),
  staffLoginThrottles: defineTable({
    key: v.string(),
    attemptCount: v.number(),
    windowStartedAt: v.number(),
    blockedUntil: v.optional(v.number()),
    updatedAt: v.number(),
  })
  .index("by_key", ["key"])
  .index("by_updatedAt", ["updatedAt"]),
  encounters: defineTable({
    patientId: v.id("patients"),
    patientName: v.optional(v.string()),
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
    estimatedDischargeTime: v.optional(v.number()),
    insurance: v.optional(
      v.object({
        provider: v.string(),
        policyNumber: v.string(),
        groupNumber: v.string(),
        status: v.string(), // "Verified", "Pending", "Denied"
        coPay: v.number(),
      })
    ),
    patientSignature: v.optional(v.string()),
    signatureTimestamp: v.optional(v.number()),
    consentToTreatSignedAt: v.optional(v.number()),
    hipaaAcknowledgedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
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
  
  notifications: defineTable({
    userId: v.optional(v.id("users")), // null if global/broadcast
    title: v.string(),
    message: v.string(),
    type: v.union(v.literal("STAT_ORDER"), v.literal("CRITICAL_VITAL"), v.literal("SYSTEM")),
    isRead: v.boolean(),
    timestamp: v.number(),
    patientId: v.optional(v.id("patients")),
  })
  .index("by_user", ["userId", "isRead"])
  .index("by_timestamp", ["timestamp"]),
  
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
  acknowledgedBy: v.optional(v.string()),
  acknowledgedAt: v.optional(v.number()),
}).index("by_encounter", ["encounterId"]),

  auditLogs: defineTable({
    userId: v.id("users"),
    userName: v.string(),
    action: v.string(), // e.g., "VIEW_CHART", "PLACE_ORDER", "DISCHARGE"
    patientId: v.optional(v.id("patients")),
    patientName: v.optional(v.string()),
    timestamp: v.number(),
    metadata: v.optional(v.string()), // Any extra context
  })
  .index("by_timestamp", ["timestamp"])
  .index("by_user", ["userId"])
  .index("by_patient", ["patientId"]),
  insurance: defineTable({
    patientId: v.id("patients"),
    provider: v.string(),
    policyNumber: v.string(),
    groupNumber: v.string(),
    status: v.union(
      v.literal("pending"), 
      v.literal("verified"), 
      v.literal("denied")
    ),
    planType: v.string(), // e.g., "PPO", "HMO", "Medicare"
    coPayAmount: v.number(),
    authorizationRequired: v.boolean(),
    authStatus: v.optional(v.union(v.literal("not_started"), v.literal("requested"), v.literal("approved"))),
    lastVerified: v.optional(v.number()),
  }).index("by_patient", ["patientId"]),
  vitals: defineTable({
    encounterId: v.id("encounters"),
    patientId: v.optional(v.id("patients")), // Adding this makes querying easier later
    hr: v.number(),
    bp: v.string(),
    spO2: v.number(),
    temp: v.number(),
    recordedAt: v.number(), // Timestamp for the X-axis
    }).index("by_encounter", ["encounterId"])
    .index("by_patient", ["patientId"]),
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
  orders: defineTable({
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    type: v.union(v.literal("LAB"), v.literal("IMAGING")),
    testName: v.string(),
    // Optional for legacy rows; newly created orders should always set this.
    searchVector: v.optional(v.string()),
    priority: v.union(v.literal("ROUTINE"), v.literal("STAT")),
    status: v.union(v.literal("PENDING"), v.literal("COMPLETED"), v.literal("CANCELLED")),
    orderedAt: v.number(),
  })
.index("by_encounter", ["encounterId"])
.index("by_patient", ["patientId"])
.searchIndex("search_orders", {
  searchField: "searchVector",
  filterFields: ["encounterId", "patientId"],
}),
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
    collections: defineTable({
      encounterId: v.id("encounters"),
      patientId: v.id("patients"),
      amount: v.number(),
      type: v.string(), // "co-pay", "self-pay", "deductible"
      status: v.string(), // "completed", "refunded"
      timestamp: v.number(),
    }).index("by_encounter", ["encounterId"]),
    faxes: defineTable({
      // Keep fax fields optional so legacy rows don't crash queries after schema changes.
      from: v.optional(v.string()),        // e.g., "North Jersey Imaging"
      faxNumber: v.optional(v.string()),   // e.g., "(201) 555-0199"
      pages: v.optional(v.number()),
      status: v.optional(v.string()),      // "received", "processed", "archived"
      documentUrl: v.optional(v.string()), // Link to the PDF/Image
      timestamp: v.optional(v.number()),
      subject: v.optional(v.string()),     // e.g., "STAT MRI Result: DOE, J"
      patientId: v.optional(v.id("patients")),
    }).index("by_faxNumber", ["faxNumber"])
      .index("by_status", ["status"]),
    teleConsults: defineTable({
      encounterId: v.id("encounters"),
      patientId: v.id("patients"),
      specialty: v.string(), // e.g., "Neurology", "Cardiology"
      status: v.union(v.literal("REQUESTED"), v.literal("ACTIVE"), v.literal("COMPLETED")),
      roomName: v.string(), // The unique video room ID
      requestedBy: v.id("users"),
      requestedAt: v.number(),
    })
    .index("by_encounter", ["encounterId"])
    .index("by_status", ["status"]),
  })