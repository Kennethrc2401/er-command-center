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
    phoneNumber: v.optional(v.string()),
    emailAddress: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    emergencyContactName: v.optional(v.string()),
    emergencyContactPhone: v.optional(v.string()),
    emergencyContactRelation: v.optional(v.string()),
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
      v.literal("CCMA"),
      v.literal("SURGEON"),
      v.literal("ANESTHESIOLOGIST"),
      v.literal("PHARMACIST"),
      v.literal("RESPIRATORY_THERAPIST"),
      v.literal("RAD_TECH"),
      v.literal("SCRUB_TECH"),
      v.literal("UNIT_COORDINATOR")
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
  staffPasskeys: defineTable({
    userId: v.id("users"),
    credentialId: v.string(),
    publicKey: v.string(),
    counter: v.number(),
    transports: v.optional(v.array(v.string())),
    deviceType: v.optional(v.string()),
    backedUp: v.optional(v.boolean()),
    name: v.optional(v.string()),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
  .index("by_user", ["userId"])
  .index("by_credential_id", ["credentialId"]),
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
    flowOwner: v.optional(v.string()),
    flowStage: v.optional(v.union(
      v.literal("triage"),
      v.literal("awaiting_bed"),
      v.literal("bedded"),
      v.literal("provider_assigned"),
      v.literal("workup_pending"),
      v.literal("consult_pending"),
      v.literal("discharge_ready"),
      v.literal("admit_ready"),
      v.literal("boarded")
    )),
    flowStageUpdatedAt: v.optional(v.number()),
    dispositionPlan: v.optional(v.union(
      v.literal("undecided"),
      v.literal("discharge"),
      v.literal("admit"),
      v.literal("observation"),
      v.literal("transfer")
    )),
    delayReason: v.optional(v.union(
      v.literal("none"),
      v.literal("awaiting_bed"),
      v.literal("awaiting_provider"),
      v.literal("awaiting_labs"),
      v.literal("awaiting_imaging"),
      v.literal("awaiting_consult"),
      v.literal("awaiting_transport"),
      v.literal("awaiting_inpatient_bed"),
      v.literal("awaiting_discharge_paperwork"),
      v.literal("insurance_hold"),
      v.literal("registration_hold"),
      v.literal("other")
    )),
    delayNote: v.optional(v.string()),
    bedAssignedAt: v.optional(v.number()),
    providerAssignedAt: v.optional(v.number()),
    dispositionDecisionAt: v.optional(v.number()),
    readyForDischargeAt: v.optional(v.number()),
    readyForAdmissionAt: v.optional(v.number()),
    admitAcceptedAt: v.optional(v.number()),
    inpatientBedRequestedAt: v.optional(v.number()),
    inpatientBedAssignedAt: v.optional(v.number()),
    assignedInpatientUnit: v.optional(v.string()),
    inpatientBedLabel: v.optional(v.string()),
    transportStatus: v.optional(v.union(
      v.literal("not_requested"),
      v.literal("requested"),
      v.literal("in_progress"),
      v.literal("completed")
    )),
    transportUpdatedAt: v.optional(v.number()),
    handoffCompletedAt: v.optional(v.number()),
    roomTurnoverStatus: v.optional(v.union(
      v.literal("not_started"),
      v.literal("cleaning"),
      v.literal("ready")
    )),
    roomTurnoverUpdatedAt: v.optional(v.number()),
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
    type: v.union(v.literal("STAT_ORDER"), v.literal("CRITICAL_VITAL"), v.literal("CRITICAL_LAB"), v.literal("SYSTEM")),
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
  criticalStatus: v.optional(v.union(
    v.literal("new"),
    v.literal("acknowledged"),
    v.literal("escalated"),
    v.literal("resolved")
  )),
  criticalRaisedAt: v.optional(v.number()),
  criticalEscalationDueAt: v.optional(v.number()),
  criticalEscalatedAt: v.optional(v.number()),
  criticalEscalationCount: v.optional(v.number()),
  criticalEscalatedRole: v.optional(v.union(
    v.literal("NURSE"),
    v.literal("DOCTOR"),
    v.literal("ADMIN")
  )),
  criticalAcknowledgementNote: v.optional(v.string()),
  criticalResolvedAt: v.optional(v.number()),
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
    taskKey: v.optional(v.string()),
      item: v.string(),
      completed: v.boolean(),
      completedBy: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    category: v.optional(v.union(v.literal("care"), v.literal("discharge"))),
    required: v.optional(v.boolean()),
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
      orderedBy: v.optional(v.string()),
      status: v.union(
        v.literal("Ordered"), 
        v.literal("In Progress"), 
        v.literal("Resulted")
      ),
      priority: v.string(),  // "STAT" or "Routine"
      report: v.optional(v.string()), // The radiologist's findings
      simulatedSeries: v.optional(
        v.object({
          modality: v.string(),
          region: v.string(),
          generatedAt: v.number(),
          slices: v.array(
            v.object({
              label: v.string(),
              imageDataUri: v.string(),
            })
          ),
        })
      ),
      orderedAt: v.number(),
      resultedAt: v.optional(v.number()),
      acknowledgedBy: v.optional(v.string()),
      acknowledgedAt: v.optional(v.number()),
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
      direction: v.optional(v.union(v.literal("inbound"), v.literal("outbound"))),
      recipientName: v.optional(v.string()),
      toFaxNumber: v.optional(v.string()),
      encounterId: v.optional(v.id("encounters")),
      sentBy: v.optional(v.string()),
      sentAt: v.optional(v.number()),
      coverMessage: v.optional(v.string()),
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
      acknowledgedBy: v.optional(v.string()),
      acknowledgedAt: v.optional(v.number()),
      callbackNote: v.optional(v.string()),
    })
    .index("by_encounter", ["encounterId"])
    .index("by_status", ["status"]),
    protocolActivations: defineTable({
      encounterId: v.id("encounters"),
      patientId: v.id("patients"),
      protocolId: v.string(),
      title: v.string(),
      activatedBy: v.string(),
      status: v.union(v.literal("active"), v.literal("completed")),
      notes: v.optional(v.string()),
      source: v.union(v.literal("patient_chart"), v.literal("training")),
      activatedAt: v.number(),
    })
      .index("by_encounter", ["encounterId"])
      .index("by_protocol", ["protocolId"])
      .index("by_activated_at", ["activatedAt"]),
    kioskIntakes: defineTable({
      patientId: v.id("patients"),
      encounterId: v.id("encounters"),
      patientName: v.string(),
      chiefComplaint: v.string(),
      symptomSummary: v.optional(v.string()),
      painScore: v.optional(v.number()),
      urgentFlags: v.array(v.string()),
      priority: v.union(v.literal("routine"), v.literal("urgent")),
      status: v.union(v.literal("new"), v.literal("acknowledged"), v.literal("roomed")),
      checkedInAt: v.number(),
      acknowledgedAt: v.optional(v.number()),
      acknowledgedBy: v.optional(v.string()),
    })
      .index("by_status", ["status"])
      .index("by_encounter", ["encounterId"]),
    chartDocuments: defineTable({
      encounterId: v.id("encounters"),
      patientId: v.id("patients"),
      category: v.union(
        v.literal("LAB_RESULT"),
        v.literal("EXTERNAL_RESULT"),
        v.literal("RADIOLOGY_IMAGE"),
        v.literal("LETTER"),
        v.literal("BILLING"),
        v.literal("MISC")
      ),
      fileName: v.string(),
      title: v.optional(v.string()),
      notes: v.optional(v.string()),
      contentType: v.string(),
      sizeBytes: v.number(),
      storageId: v.id("_storage"),
      uploadedBy: v.string(),
      uploadedByRole: v.union(
        v.literal("ADMIN"),
        v.literal("DOCTOR"),
        v.literal("NURSE"),
        v.literal("CCMA"),
        v.literal("SURGEON"),
        v.literal("ANESTHESIOLOGIST"),
        v.literal("PHARMACIST"),
        v.literal("RESPIRATORY_THERAPIST"),
        v.literal("RAD_TECH"),
        v.literal("SCRUB_TECH"),
        v.literal("UNIT_COORDINATOR"),
        v.literal("UNKNOWN")
      ),
      uploadedAt: v.number(),
      retentionPolicyDays: v.optional(v.number()),
      expiresAt: v.optional(v.number()),
      isArchived: v.optional(v.boolean()),
      archivedAt: v.optional(v.number()),
      archivedReason: v.optional(v.string()),
    })
      .index("by_encounter", ["encounterId"])
      .index("by_patient", ["patientId"])
      .index("by_encounter_category", ["encounterId", "category"]),
    chartDocumentAuditLogs: defineTable({
      encounterId: v.id("encounters"),
      patientId: v.id("patients"),
      documentId: v.optional(v.id("chartDocuments")),
      action: v.union(
        v.literal("UPLOAD"),
        v.literal("VIEW"),
        v.literal("DOWNLOAD"),
        v.literal("DELETE"),
        v.literal("RETENTION_ARCHIVE"),
        v.literal("HARD_DELETE"),
        v.literal("ACCESS_DENIED")
      ),
      actorName: v.string(),
      actorRole: v.union(
        v.literal("ADMIN"),
        v.literal("DOCTOR"),
        v.literal("NURSE"),
        v.literal("CCMA"),
        v.literal("SURGEON"),
        v.literal("ANESTHESIOLOGIST"),
        v.literal("PHARMACIST"),
        v.literal("RESPIRATORY_THERAPIST"),
        v.literal("RAD_TECH"),
        v.literal("SCRUB_TECH"),
        v.literal("UNIT_COORDINATOR"),
        v.literal("UNKNOWN")
      ),
      fileName: v.optional(v.string()),
      category: v.optional(v.union(
        v.literal("LAB_RESULT"),
        v.literal("EXTERNAL_RESULT"),
        v.literal("RADIOLOGY_IMAGE"),
        v.literal("LETTER"),
        v.literal("BILLING"),
        v.literal("MISC")
      )),
      note: v.optional(v.string()),
      timestamp: v.number(),
    })
      .index("by_encounter_timestamp", ["encounterId", "timestamp"])
      .index("by_document", ["documentId"]),
    chartDocumentSettings: defineTable({
      singletonKey: v.literal("default"),
      miscRetentionDays: v.number(),
      miscArchivePurgeGraceDays: v.number(),
      retentionDaysByCategory: v.optional(v.object({
        LAB_RESULT: v.number(),
        EXTERNAL_RESULT: v.number(),
        RADIOLOGY_IMAGE: v.number(),
        LETTER: v.number(),
        BILLING: v.number(),
        MISC: v.number(),
      })),
      purgeGraceDaysByCategory: v.optional(v.object({
        LAB_RESULT: v.number(),
        EXTERNAL_RESULT: v.number(),
        RADIOLOGY_IMAGE: v.number(),
        LETTER: v.number(),
        BILLING: v.number(),
        MISC: v.number(),
      })),
      sweepIntervalHours: v.number(),
      lastGlobalSweepAt: v.optional(v.number()),
      updatedAt: v.number(),
      updatedBy: v.optional(v.string()),
      updatedByRole: v.optional(v.union(
        v.literal("ADMIN"),
        v.literal("DOCTOR"),
        v.literal("NURSE"),
        v.literal("CCMA"),
        v.literal("SURGEON"),
        v.literal("ANESTHESIOLOGIST"),
        v.literal("PHARMACIST"),
        v.literal("RESPIRATORY_THERAPIST"),
        v.literal("RAD_TECH"),
        v.literal("SCRUB_TECH"),
        v.literal("UNIT_COORDINATOR"),
        v.literal("UNKNOWN")
      )),
    })
      .index("by_singleton_key", ["singletonKey"]),
    orCases: defineTable({
      patientName: v.string(),
      procedure: v.string(),
      surgeon: v.string(),
      anesthesia: v.string(),
      room: v.string(),
      scheduledStart: v.number(),
      scheduledEnd: v.number(),
      priority: v.union(
        v.literal("ELECTIVE"),
        v.literal("URGENT"),
        v.literal("EMERGENT")
      ),
      status: v.union(
        v.literal("SCHEDULED"),
        v.literal("IN_ROOM"),
        v.literal("IN_PROGRESS"),
        v.literal("COMPLETED"),
        v.literal("CANCELLED")
      ),
      notes: v.optional(v.string()),
      createdBy: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
      statusUpdatedBy: v.optional(v.string()),
      statusUpdatedAt: v.optional(v.number()),
      statusHistory: v.optional(
        v.array(
          v.object({
            status: v.union(
              v.literal("SCHEDULED"),
              v.literal("IN_ROOM"),
              v.literal("IN_PROGRESS"),
              v.literal("COMPLETED"),
              v.literal("CANCELLED")
            ),
            at: v.number(),
            by: v.optional(v.string()),
          })
        )
      ),
    })
      .index("by_scheduled_start", ["scheduledStart"])
      .index("by_room_start", ["room", "scheduledStart"])
      .index("by_surgeon_start", ["surgeon", "scheduledStart"]),
  })