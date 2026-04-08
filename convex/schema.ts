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
    // Specialist matching
    specialties: v.optional(v.array(v.string())), // e.g., ["Cardiology", "Trauma", "Pediatrics"]
    certifications: v.optional(v.array(v.string())), // e.g., ["PLS", "ACLS", "PEDIATRIC_CERT"]
    // Preference learning
    totalPatientsAssigned: v.optional(v.number()),
    lastPreferenceUpdateAt: v.optional(v.number()),
  })
  .index("by_email", ["email"])
  .index("by_username", ["username"])
  .index("by_role", ["role"])
  .index("by_specialty", ["specialties"]),
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
  breakGlassSessions: defineTable({
    userId: v.id("users"),
    reason: v.string(),
    startedAt: v.number(),
    expiresAt: v.number(),
    isActive: v.boolean(),
    revokedAt: v.optional(v.number()),
    revokedByUserId: v.optional(v.id("users")),
    revokeReason: v.optional(v.string()),
  })
  .index("by_user_active", ["userId", "isActive", "expiresAt"])
  .index("by_active_expiry", ["isActive", "expiresAt"])
  .index("by_startedAt", ["startedAt"]),
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

  posCharges: defineTable({
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    description: v.string(),
    amountCents: v.number(),
    paidCents: v.number(),
    status: v.union(v.literal("open"), v.literal("partial"), v.literal("paid"), v.literal("void")),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastPaymentMethod: v.optional(v.union(v.literal("card"), v.literal("cash"), v.literal("check"), v.literal("hsa"), v.literal("other"))),
    lastReference: v.optional(v.string()),
  })
    .index("by_encounter", ["encounterId"])
    .index("by_status", ["status"])
    .index("by_updated_at", ["updatedAt"]),

  posPayments: defineTable({
    chargeId: v.id("posCharges"),
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    amountCents: v.number(),
    method: v.union(v.literal("card"), v.literal("cash"), v.literal("check"), v.literal("hsa"), v.literal("other")),
    reference: v.optional(v.string()),
    collectedBy: v.string(),
    collectedAt: v.number(),
  })
    .index("by_charge", ["chargeId"])
    .index("by_encounter", ["encounterId"])
    .index("by_collected_at", ["collectedAt"]),

  posRefunds: defineTable({
    paymentId: v.id("posPayments"),
    chargeId: v.id("posCharges"),
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    amountCents: v.number(),
    reason: v.optional(v.string()),
    refundedBy: v.string(),
    refundedAt: v.number(),
  })
    .index("by_payment", ["paymentId"])
    .index("by_charge", ["chargeId"])
    .index("by_encounter", ["encounterId"])
    .index("by_refunded_at", ["refundedAt"]),

  posDrawerSessions: defineTable({
    openedBy: v.string(),
    openedAt: v.number(),
    openingFloatCents: v.number(),
    status: v.union(v.literal("open"), v.literal("closed")),
    closedBy: v.optional(v.string()),
    closedAt: v.optional(v.number()),
    expectedCashCents: v.optional(v.number()),
    actualCashCents: v.optional(v.number()),
    varianceCents: v.optional(v.number()),
    closeNote: v.optional(v.string()),
    varianceAcknowledged: v.optional(v.boolean()),
    varianceAcknowledgedBy: v.optional(v.string()),
    varianceAcknowledgedAt: v.optional(v.number()),
    varianceAcknowledgementNote: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_opened_at", ["openedAt"])
    .index("by_closed_at", ["closedAt"]),
  
  notifications: defineTable({
    // Keep null for backward compatibility with older notification rows.
    userId: v.optional(v.union(v.id("users"), v.null())), // null/undefined => global/broadcast
    title: v.string(),
    message: v.string(),
    type: v.union(v.literal("STAT_ORDER"), v.literal("CRITICAL_VITAL"), v.literal("CRITICAL_LAB"), v.literal("SYSTEM")),
    isRead: v.boolean(),
    timestamp: v.number(),
    patientId: v.optional(v.id("patients")),
    suppressionKey: v.optional(v.string()),
  })
  .index("by_timestamp", ["timestamp"])
  .index("by_suppression_key_timestamp", ["suppressionKey", "timestamp"]),

  notificationRoutingEvents: defineTable({
    role: v.union(v.literal("NURSE"), v.literal("DOCTOR"), v.literal("UNIT_COORDINATOR")),
    actorName: v.string(),
    actorRole: v.string(),
    message: v.string(),
    suppressionKey: v.string(),
    suppressionWindowMinutes: v.number(),
    skipped: v.boolean(),
    routedAt: v.number(),
    notificationId: v.optional(v.id("notifications")),
  })
    .index("by_timestamp", ["routedAt"])
    .index("by_role_timestamp", ["role", "routedAt"]),

  providerFairnessSignals: defineTable({
    providerName: v.string(),
    riskLevel: v.union(v.literal("low"), v.literal("moderate"), v.literal("high")),
    assignedCount: v.number(),
    highAcuityCount: v.number(),
    openAlertCount: v.number(),
    capturedAt: v.number(),
  })
    .index("by_provider_captured_at", ["providerName", "capturedAt"])
    .index("by_captured_at", ["capturedAt"]),
  
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
  insuranceClaims: defineTable({
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    insuranceId: v.optional(v.id("insurance")),
    status: v.union(
      v.literal("draft"),
      v.literal("scrub"),
      v.literal("submitted"),
      v.literal("accepted"),
      v.literal("denied"),
      v.literal("paid")
    ),
    totalChargeCents: v.number(),
    allowedAmountCents: v.optional(v.number()),
    payerControlNumber: v.optional(v.string()),
    denialReason: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
    respondedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  })
    .index("by_encounter", ["encounterId"])
    .index("by_patient", ["patientId"])
    .index("by_status", ["status"]),
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
    operationalAlertAcknowledgements: defineTable({
      encounterId: v.id("encounters"),
      patientId: v.optional(v.id("patients")),
      kind: v.union(v.literal("lab"), v.literal("imaging"), v.literal("consult")),
      recordId: v.string(),
      alertTitle: v.string(),
      acknowledgedBy: v.string(),
      acknowledgedRole: v.string(),
      note: v.optional(v.string()),
      acknowledgedAt: v.number(),
      source: v.union(v.literal("ops_panel"), v.literal("ops_suite"), v.literal("other")),
    })
      .index("by_encounter_ack_time", ["encounterId", "acknowledgedAt"])
      .index("by_kind_ack_time", ["kind", "acknowledgedAt"]),
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
    shiftHandoffs: defineTable({
      fromUserId: v.id("users"),
      fromUserName: v.string(),
      fromUserRole: v.string(),
      toUserId: v.optional(v.id("users")), // Optional for handoffs in progress
      toUserName: v.optional(v.string()),
      toUserRole: v.optional(v.string()),
      status: v.union(
        v.literal("initiated"),
        v.literal("accepted"),
        v.literal("partially_accepted"),
        v.literal("rejected"),
        v.literal("expired")
      ),
      patientCount: v.number(),
      patientEncounterIds: v.array(v.id("encounters")),
      initiatedAt: v.number(),
      acceptedAt: v.optional(v.number()),
      rejectedAt: v.optional(v.number()),
      rejectionReason: v.optional(v.string()),
      expiresAt: v.number(), // Handoff must be accepted/rejected within time limit
      completedAt: v.optional(v.number()),
      notes: v.optional(v.string()),
    })
      .index("by_from_user_status", ["fromUserId", "status"])
      .index("by_to_user_status", ["toUserId", "status"])
      .index("by_initiated_at", ["initiatedAt"])
      .index("by_expires_at", ["expiresAt", "status"]),
    handoffSessions: defineTable({
      handoffId: v.id("shiftHandoffs"),
      encounterId: v.id("encounters"),
      status: v.union(
        v.literal("pending"),
        v.literal("acknowledged"),
        v.literal("accepted"),
        v.literal("rejected"),
        v.literal("missed")
      ),
      patientName: v.string(),
      chiefComplaint: v.string(),
      acuity: v.number(),
      currentLocation: v.optional(v.string()),
      keyAlertsCount: v.number(),
      pendingActionsCount: v.number(),
      acknowledgedAt: v.optional(v.number()),
      acceptedAt: v.optional(v.number()),
      rejectionReason: v.optional(v.string()),
      signOutNotes: v.optional(v.string()),
      signInNotes: v.optional(v.string()),
    })
      .index("by_handoff", ["handoffId"])
      .index("by_encounter", ["encounterId"])
      .index("by_status", ["status"]),
    handoffAuditLogs: defineTable({
      handoffId: v.id("shiftHandoffs"),
      encounterId: v.optional(v.id("encounters")),
      action: v.union(
        v.literal("handoff_initiated"),
        v.literal("handoff_acknowledged"),
        v.literal("handoff_accepted"),
        v.literal("handoff_rejected"),
        v.literal("handoff_expired"),
        v.literal("encounter_acknowledged"),
        v.literal("encounter_accepted"),
        v.literal("encounter_rejected")
      ),
      actorUserId: v.id("users"),
      actorUserName: v.string(),
      actorUserRole: v.string(),
      details: v.optional(v.string()),
      timestamp: v.number(),
    })
      .index("by_handoff_timestamp", ["handoffId", "timestamp"])
      .index("by_actor_timestamp", ["actorUserId", "timestamp"]),

    sharedWatchlists: defineTable({
      unit: v.string(),
      encounterId: v.id("encounters"),
      note: v.optional(v.string()),
      pinnedBy: v.string(),
      pinnedAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_unit", ["unit"])
      .index("by_unit_encounter", ["unit", "encounterId"])
      .index("by_updated_at", ["updatedAt"]),

    // ============ STANDING ORDERS & PROTOCOLS ============
    standingOrders: defineTable({
      encounterId: v.id("encounters"),
      protocolId: v.optional(v.string()),
      orderType: v.union(
        v.literal("LAB"),
        v.literal("IMAGING"),
        v.literal("MEDICATION"),
        v.literal("PROCEDURE")
      ),
      orderName: v.string(),
      description: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("placed"),
        v.literal("completed"),
        v.literal("cancelled")
      ),
      trigger: v.union(
        v.literal("chief_complaint"),
        v.literal("diagnosis"),
        v.literal("vital_threshold"),
        v.literal("manual"),
        v.literal("protocol_activation")
      ),
      triggerValue: v.optional(v.string()),
      autoPlaced: v.boolean(), // true if placed by standing order automation
      placedBy: v.optional(v.string()),
      placedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_encounter", ["encounterId"])
      .index("by_status", ["status"])
      .index("by_protocol", ["protocolId"]),

    // ============ TRIAGE REASSESSMENT ============
    triageReassessments: defineTable({
      encounterId: v.id("encounters"),
      patientId: v.id("patients"),
      reassessmentPhase: v.number(), // 1 = initial, 2 = repeat, 3 = before disposition
      previousAcuity: v.number(),
      currentAcuity: v.number(),
      acuityChanged: v.boolean(),
      presentationChanges: v.optional(v.array(v.string())), // e.g., ["increased_pain", "new_tachycardia"]
      vitalChanges: v.optional(v.object({
        hrChanged: v.optional(v.boolean()),
        bpChanged: v.optional(v.boolean()),
        tempChanged: v.optional(v.boolean()),
        o2Changed: v.optional(v.boolean()),
      })),
      reassessedBy: v.string(),
      assessmentNotes: v.optional(v.string()),
      recommendedDisposition: v.optional(v.union(
        v.literal("discharge"),
        v.literal("admit"),
        v.literal("observation"),
        v.literal("transfer")
      )),
      reassessedAt: v.number(),
    })
      .index("by_encounter", ["encounterId"])
      .index("by_reassessment_phase", ["encounterId", "reassessmentPhase"]),

    // ============ PROVIDER PREFERENCES & LEARNING ============
    providerPreferences: defineTable({
      providerId: v.id("users"),
      prefCategory: v.union(
        v.literal("patient_type"),
        v.literal("chief_complaint"),
        v.literal("acuity_level"),
        v.literal("procedure"),
        v.literal("specialty"),
        v.literal("age_group")
      ),
      prefValue: v.string(), // e.g., "cardiac", "pediatric", "trauma"
      preference: v.number(), // -1 (avoid), 0 (neutral), 1 (prefer)
      matchCount: v.number(), // how many times this was matched
      successRate: v.number(), // 0-1, how often it worked well
      lastUpdatedAt: v.number(),
    })
      .index("by_provider", ["providerId"])
      .index("by_provider_category", ["providerId", "prefCategory"]),

    // ============ ASSIGNMENT HISTORY FOR LEARNING ============
    assignmentHistory: defineTable({
      encounterId: v.id("encounters"),
      providerId: v.id("users"),
      handoffFromProviderId: v.optional(v.id("users")),
      assignmentReason: v.string(), // e.g., "recommendation", "manual", "handoff"
      assignedAt: v.number(),
      assignmentDurationMs: v.optional(v.number()),
      outcomeScore: v.optional(v.number()), // 1-5 quality score for learning
      outcomeNotes: v.optional(v.string()),
      patientChiefComplaint: v.string(),
      patientAcuity: v.number(),
      finalDisposition: v.optional(v.string()),
    })
      .index("by_provider_date", ["providerId", "assignedAt"])
      .index("by_encounter", ["encounterId"]),

    // ============ REAL-TIME METRICS ============
    edMetrics: defineTable({
      singletonKey: v.literal("current"),
      timestamp: v.number(),
      activePatientCount: v.number(),
      waitingInTriageCount: v.number(),
      beddedCount: v.number(),
      dischargeReadyCount: v.number(),
      admitReadyCount: v.number(),
      avgTimeInTriageMinutes: v.number(),
      avgTimeFromArrivalToBedroomMinutes: v.number(),
      avgTimeFromArrivalToProviderMinutes: v.number(),
      avgLengthOfStayMinutes: v.optional(v.number()),
      bedsOccupied: v.number(),
      bedsTotalAvailable: v.number(),
      bedUtilizationPercent: v.number(),
      averageProviderLoad: v.number(),
      highAcuityPatientCount: v.number(),
      criticalAlertsOpen: v.number(),
      dischargesLastHour: v.number(),
      admitsLastHour: v.number(),
      lastUpdateMs: v.number(),
    })
      .index("by_singleton", ["singletonKey"]),

    // ============ BED AVAILABILITY PREDICTION ============
    bedAvailabilityPredictions: defineTable({
      bedLabel: v.string(),
      predictedAvailableAt: v.number(),
      predictionConfidence: v.number(), // 0-1
      currentOccupantEncounterId: v.optional(v.id("encounters")),
      currentOccupantAcuity: v.optional(v.number()),
      estimatedDischargeTimeMs: v.optional(v.number()),
      estimatedAdmitTimeMs: v.optional(v.number()),
      historyBasedAvgTurnaroundMs: v.optional(v.number()),
      lastUpdatedAt: v.number(),
    })
      .index("by_bed_label", ["bedLabel"])
      .index("by_predicted_available", ["predictedAvailableAt"]),

    // ============ HISTORICAL BED PATTERNS (for prediction ML) ============
    bedTurnoverHistory: defineTable({
      bedLabel: v.string(),
      previousEncounterId: v.id("encounters"),
      previousDischargeAt: v.number(),
      nextEncounterId: v.id("encounters"),
      nextAdmitAt: v.number(),
      turnoverTimeMs: v.number(), // time between discharge and next admission
      turnoverStatus: v.union(
        v.literal("clean"),
        v.literal("expedited_clean"),
        v.literal("deep_clean"),
        v.literal("maintenance"),
        v.literal("blocked")
      ),
      cleanedAt: v.optional(v.number()),
    })
      .index("by_bed_discharge", ["bedLabel", "previousDischargeAt"]),

    // ============ STUDY & ACADEMIC NOTES ============
    studyClassSessions: defineTable({
      userId: v.id("users"),
      subject: v.string(), // e.g., "Calculus II", "Quantum Mechanics", "Data Structures"
      className: v.string(), // e.g., "MATH-201", "CS-301"
      professor: v.optional(v.string()),
      startedAt: v.number(),
      endedAt: v.optional(v.number()),
      durationMinutes: v.optional(v.number()),
      status: v.union(v.literal("recording"), v.literal("completed"), v.literal("paused")),
    })
      .index("by_user", ["userId"])
      .index("by_subject", ["subject"])
      .index("by_date", ["startedAt"]),

    studyNotes: defineTable({
      sessionId: v.id("studyClassSessions"),
      userId: v.id("users"),
      rawTranscription: v.string(), // Raw speech-to-text output
      organizationStatus: v.union(v.literal("raw"), v.literal("organized"), v.literal("summarized")),
      topics: v.array(v.string()), // e.g., ["derivatives", "integrals", "chain-rule"]
      subject: v.string(),
      content: v.string(), // Organized/editored content
      summary: v.optional(v.string()), // AI-generated summary
      keyPoints: v.optional(v.array(v.string())), // Extracted key points
      definitions: v.optional(
        v.array(
          v.object({
            term: v.string(),
            definition: v.string(),
          })
        )
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
      recordingMarkers: v.optional(
        v.array(
          v.object({
            label: v.string(),
            elapsedSeconds: v.number(),
            createdAt: v.number(),
          })
        )
      ),
      transcriptStats: v.optional(
        v.object({
          totalSeconds: v.number(),
          pauseSeconds: v.number(),
          markerCount: v.number(),
        })
      ),
      exportedAt: v.optional(v.number()),
      exportFormat: v.optional(v.union(v.literal("markdown"), v.literal("pdf"), v.literal("txt"))),
    })
      .index("by_session", ["sessionId"])
      .index("by_user", ["userId"])
      .index("by_subject", ["subject"])
      .index("by_created", ["createdAt"]),

    studyNoteTopics: defineTable({
      noteId: v.id("studyNotes"),
      topic: v.string(),
      frequency: v.number(), // How many times mentioned
      context: v.optional(v.string()), // Brief context where it appeared
    })
      .index("by_note", ["noteId"])
      .index("by_topic", ["topic"]),

    studyToolsState: defineTable({
      userId: v.id("users"),
      subject: v.string(),
      masteryByTopic: v.record(
        v.string(),
        v.union(v.literal("NEW"), v.literal("LEARNING"), v.literal("CONFIDENT"))
      ),
      reviewCardState: v.record(
        v.string(),
        v.object({
          intervalDays: v.number(),
          dueAt: v.number(),
          lastReviewedAt: v.optional(v.number()),
        })
      ),
      completedActionItems: v.record(v.string(), v.boolean()),
      sourceLinksByNote: v.record(v.string(), v.array(v.string())),
      practiceTests: v.optional(
        v.array(
          v.object({
            id: v.string(),
            numQuestions: v.number(),
            timeLimit: v.number(),
            takenAt: v.number(),
            score: v.number(),
          })
        )
      ),
      weakTopicPerformance: v.optional(
        v.record(
          v.string(),
          v.object({
            correctCount: v.number(),
            totalCount: v.number(),
            lastReviewedAt: v.number(),
          })
        )
      ),
      sessionTimeByTopic: v.optional(
        v.record(
          v.string(),
          v.object({
            totalMinutes: v.number(),
            sessionCount: v.number(),
          })
        )
      ),
      mockExams: v.optional(
        v.array(
          v.object({
            id: v.string(),
            numQuestions: v.number(),
            timeLimit: v.number(),
            targetScore: v.number(),
            takenAt: v.optional(v.number()),
            score: v.optional(v.number()),
            createdAt: v.number(),
          })
        )
      ),
      studyStreak: v.optional(
        v.object({
          currentStreak: v.number(),
          longestStreak: v.number(),
          lastStudyDate: v.number(),
          totalStudyDays: v.number(),
        })
      ),
      performanceHistory: v.optional(
        v.array(
          v.object({
            date: v.number(),
            topic: v.string(),
            accuracy: v.number(),
            averageTimePerQuestion: v.number(),
          })
        )
      ),
      conceptMapLinks: v.optional(
        v.array(
          v.object({
            fromTopic: v.string(),
            toTopic: v.string(),
            relationshipType: v.string(),
          })
        )
      ),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_subject", ["userId", "subject"]),
  })