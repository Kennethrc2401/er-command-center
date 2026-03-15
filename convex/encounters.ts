import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { normalizePatientContactFields } from "./patientNormalization";
import type { Doc } from "./_generated/dataModel";

/**
 * Shared Vitals Validator to ensure strict data integrity.
 */
const vitalsValidator = v.object({
  hr: v.number(),
  bp: v.string(),
  temp: v.number(),
  spO2: v.number(),
});

const TOTAL_BEDS = 20;
const BED_LOCATION_PATTERN = /^bed\s+(\d+)$/i;
const THROUGHPUT_SHIFT_WINDOW_MS = 12 * 60 * 60 * 1000;
const transportStatusValidator = v.optional(v.union(
  v.literal("not_requested"),
  v.literal("requested"),
  v.literal("in_progress"),
  v.literal("completed")
));
const roomTurnoverStatusValidator = v.optional(v.union(
  v.literal("not_started"),
  v.literal("cleaning"),
  v.literal("ready")
));

const throughputStageValidator = v.union(
  v.literal("triage"),
  v.literal("awaiting_bed"),
  v.literal("bedded"),
  v.literal("provider_assigned"),
  v.literal("workup_pending"),
  v.literal("consult_pending"),
  v.literal("discharge_ready"),
  v.literal("admit_ready"),
  v.literal("boarded")
);

const dispositionPlanValidator = v.union(
  v.literal("undecided"),
  v.literal("discharge"),
  v.literal("admit"),
  v.literal("observation"),
  v.literal("transfer")
);

const delayReasonValidator = v.union(
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
);

type ThroughputStage =
  | "triage"
  | "awaiting_bed"
  | "bedded"
  | "provider_assigned"
  | "workup_pending"
  | "consult_pending"
  | "discharge_ready"
  | "admit_ready"
  | "boarded";

type DelayReason =
  | "none"
  | "awaiting_bed"
  | "awaiting_provider"
  | "awaiting_labs"
  | "awaiting_imaging"
  | "awaiting_consult"
  | "awaiting_transport"
  | "awaiting_inpatient_bed"
  | "awaiting_discharge_paperwork"
  | "insurance_hold"
  | "registration_hold"
  | "other";

type ThroughputColumnKey = "frontDoor" | "workup" | "disposition" | "blocked";

const DEFAULT_DELAY_REASON: DelayReason = "none";

function normalizeBedLocation(location?: string): string | null {
  if (!location) return null;
  const trimmed = location.trim();
  if (!trimmed) return null;

  const match = BED_LOCATION_PATTERN.exec(trimmed);
  if (!match) return null;

  const bedNumber = Number(match[1]);
  if (!Number.isInteger(bedNumber) || bedNumber < 1 || bedNumber > TOTAL_BEDS) {
    return null;
  }

  return `Bed ${bedNumber}`;
}

function averageMinutes(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const total = samples.reduce((sum, value) => sum + value, 0);
  return Math.round(total / samples.length);
}

function deriveThroughputStage(
  encounter: Doc<"encounters">,
  options: {
    pendingLabCount: number;
    pendingImagingCount: number;
    hasActiveConsult: boolean;
  }
): ThroughputStage {
  if (encounter.flowStage) {
    return encounter.flowStage;
  }

  const hasBed = Boolean(normalizeBedLocation(encounter.location));
  const hasAssignedProvider = Boolean(encounter.assignedProvider?.trim());
  const activeDisposition = encounter.dispositionPlan ?? "undecided";
  const hasPendingWorkup = options.pendingLabCount > 0 || options.pendingImagingCount > 0;

  if (encounter.status === "triage") return "triage";
  if (!hasBed) return "awaiting_bed";
  if (encounter.status === "observed") return activeDisposition === "discharge" ? "discharge_ready" : "boarded";
  if (activeDisposition === "admit" && encounter.readyForAdmissionAt) return "admit_ready";
  if (activeDisposition === "discharge" && encounter.readyForDischargeAt) return "discharge_ready";
  if (!hasAssignedProvider) return "bedded";
  if (options.hasActiveConsult) return "consult_pending";
  if (hasPendingWorkup) return "workup_pending";
  return "provider_assigned";
}

function getThroughputColumnKey(stage: ThroughputStage, delayReason: DelayReason): ThroughputColumnKey {
  if (stage === "boarded" || delayReason !== DEFAULT_DELAY_REASON) return "blocked";
  if (stage === "triage" || stage === "awaiting_bed") return "frontDoor";
  if (stage === "discharge_ready" || stage === "admit_ready") return "disposition";
  return "workup";
}

async function getEncounterOperationalState(
  ctx: QueryCtx | MutationCtx,
  encounter: Doc<"encounters">
) {
  const [patient, labResults, imagingOrders, consults] = await Promise.all([
    ctx.db.get(encounter.patientId),
    ctx.db
      .query("labResults")
      .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
      .collect(),
    ctx.db
      .query("imagingOrders")
      .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
      .collect(),
    ctx.db
      .query("teleConsults")
      .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
      .collect(),
  ]);

  const pendingLabCount = labResults.filter((lab) => lab.status === "pending").length;
  const criticalLabCount = labResults.filter((lab) => lab.isAbnormal && !lab.acknowledgedAt).length;
  const pendingImagingCount = imagingOrders.filter((order) => order.status !== "Resulted").length;
  const hasActiveConsult = consults.some((consult) => consult.status === "REQUESTED" || consult.status === "ACTIVE");
  const stage = deriveThroughputStage(encounter, {
    pendingLabCount,
    pendingImagingCount,
    hasActiveConsult,
  });
  const delayReason = encounter.delayReason ?? DEFAULT_DELAY_REASON;
  const columnKey = getThroughputColumnKey(stage, delayReason);

  return {
    patient,
    pendingLabCount,
    pendingImagingCount,
    criticalLabCount,
    hasActiveConsult,
    stage,
    delayReason,
    columnKey,
  };
}

/**
 * Registers a new patient and starts an encounter simultaneously.
 */
export const admitPatient = mutation({
  args: {
    name: v.string(),
    mrn: v.string(),
    dob: v.string(),
    gender: v.optional(v.string()), 
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
    chiefComplaint: v.string(),
    acuity: v.number(),
    vitals: vitalsValidator,
  },
  handler: async (ctx, args) => {
    const normalizedContact = normalizePatientContactFields({
      phoneNumber: args.phoneNumber,
      emailAddress: args.emailAddress,
      preferredLanguage: args.preferredLanguage,
      addressLine1: args.addressLine1,
      addressLine2: args.addressLine2,
      city: args.city,
      state: args.state,
      postalCode: args.postalCode,
      emergencyContactName: args.emergencyContactName,
      emergencyContactPhone: args.emergencyContactPhone,
      emergencyContactRelation: args.emergencyContactRelation,
    });

    // 1. Create the Patient Record
    const patientId = await ctx.db.insert("patients", {
      name: args.name,
      mrn: args.mrn,
      dob: args.dob,
      gender: args.gender ?? "Not Specified", 
      allergies: [], // Initializing with empty array
      codeStatus: "Full Code", // Default code status
      searchVector: `${args.name} ${args.mrn}`, // Combine name and MRN for full-text search
      ...normalizedContact,
    });

    // 2. Create the ER Encounter
    const encounterId = await ctx.db.insert("encounters", {
      patientId,
      patientName: args.name,
      status: "waiting",
      acuity: args.acuity,
      chiefComplaint: args.chiefComplaint,
      vitals: args.vitals,
    });

    // 3. AUTO-GENERATE CLINICAL CHECKLIST
    // These tasks populate the sidebar we just created
    const standardTasks = [
      "Verify Patient Identity (2 Identifiers)",
      "Confirm NKDA / Allergy Status",
      "Establish IV Access / Saline Lock",
      "Obtain Primary Vitals Set",
      "Initiate Fall Risk Assessment",
      "Review Discharge Barriers"
    ];

    for (const item of standardTasks) {
      await ctx.db.insert("checklists", {
        encounterId,
        item,
        completed: false,
        // completedBy is left undefined until Sophia R, RN checks it
      });
    }

    return { patientId, encounterId };
  },
});
/**
 * Creates an encounter for a patient already in the system.
 */
export const createEncounter = mutation({
  args: {
    patientId: v.id("patients"),
    chiefComplaint: v.string(),
    patientName: v.string(),
    acuity: v.number(),
    vitals: vitalsValidator,
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("encounters", {
      patientId: args.patientId,
      chiefComplaint: args.chiefComplaint,
      patientName: args.patientName,
      acuity: args.acuity,
      vitals: args.vitals,
      status: "triage",
    });
    
    const identity = await ctx.auth.getUserIdentity();
    if (identity?.email) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email!.toLowerCase()))
        .unique();
      if (user) {
        await ctx.db.insert("auditLogs", {
          userId: user._id,
          userName: user.name,
          action: "CREATE_ENCOUNTER",
          patientId: args.patientId,
          timestamp: Date.now(),
        });
      }
    }
    return id;
  },
});

/**
 * Fetches current ER load categorized by ESI level for the dashboard.
 */
export const getTriageStats = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("encounters")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "discharged"))
      .collect();

    return {
      level1: active.filter((e) => e.acuity === 1).length,
      level2: active.filter((e) => e.acuity === 2).length,
      level3: active.filter((e) => e.acuity === 3).length,
      level45: active.filter((e) => e.acuity >= 4).length,
      total: active.length,
    };
  },
});

/**
 * Returns all active encounters with joined Patient data, sorted by acuity.
 */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const encounters = await ctx.db
      .query("encounters")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "discharged"))
      .collect();

    const encountersWithNames = await Promise.all(
      encounters.map(async (encounter) => {
        // 1. Fetch the patient
        const patient = await ctx.db.get(encounter.patientId);
        
        // 2. DEFENSIVE CHECK: If patient is null, provide "Unknown" fallbacks
        // This prevents the "Cannot read property 'name' of null" error
        return {
          ...encounter,
          patientName: patient?.name ?? "Unknown Patient",
          mrn: patient?.mrn ?? "N/A",
          gender: patient?.gender ?? "U",
          location: encounter.location ?? "Waiting",
        };
      })
    );

    return encountersWithNames.sort((a, b) => {
      if (a.acuity !== b.acuity) {
        return a.acuity - b.acuity;
      }
      return a._creationTime - b._creationTime;
    });
  },
});

/**
 * Finalizes care and archives the encounter.
 */
export const dischargePatient = mutation({
  args: {
    encounterId: v.id("encounters"),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    return await ctx.db.patch(args.encounterId, {
      status: "discharged",
      dischargeSummary: args.summary,
      dispositionPlan: encounter.dispositionPlan ?? "discharge",
      dischargedAt: Date.now(),
    });
  },
});

/**
 * Updates vitals for an active encounter.
 */
export const updateVitals = mutation({
  args: {
    encounterId: v.id("encounters"),
    vitals: vitalsValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.encounterId, {
      vitals: args.vitals,
    });
  },
});

export const saveSignature = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientSignature: v.string(),
    signatureTimestamp: v.optional(v.number()),
    consentToTreat: v.optional(v.boolean()),
    hipaaAcknowledged: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const signatureTimestamp = args.signatureTimestamp ?? Date.now();

    await ctx.db.patch(args.encounterId, {
      patientSignature: args.patientSignature,
      signatureTimestamp,
      ...(args.consentToTreat ? { consentToTreatSignedAt: signatureTimestamp } : {}),
      ...(args.hipaaAcknowledged ? { hipaaAcknowledgedAt: signatureTimestamp } : {}),
    });
  },
});

/**
 * General ER statistics for the Command Center.
 * This resolves the "Could not find public function" error.
 */
export const getERStats = query({
  handler: async (ctx) => {
    const [active, insuranceRows] = await Promise.all([
      ctx.db
        .query("encounters")
        .withIndex("by_status")
        .filter((q) => q.neq(q.field("status"), "discharged"))
        .collect(),
      ctx.db.query("insurance").collect(),
    ]);

    // 🩺 THE "REALITY" FILTER:
    // A patient occupies a bed IF they have a status of 'in_treatment'/'admitted'
    // AND they actually have something written in their 'bedId' or 'location' field.
    const patientsInBeds = active.filter(
      (p) => 
        (p.status === "treating" || p.status === "waiting") && 
        p.location && p.location.trim() !== "" 
    );

    const physicalOccupancy = patientsInBeds.length;
    const TOTAL_CAPACITY = 20;
    
    // Result: 20 - 4 = 16
    const availableBeds = Math.max(0, TOTAL_CAPACITY - physicalOccupancy);

    // DEBUG: Check your terminal/console to see exactly what's being counted
    console.log(`Beds Occupied: ${physicalOccupancy} | Available: ${availableBeds}`);
    return {
      totalPatients: active.length,
      highAcuity: active.filter((p) => (p.acuity ?? 5) <= 2).length,
      availableBeds, 
      boardingPatients: active.filter((p) => p.status === "observed").length,
      pendingInsurance: insuranceRows.filter((row) => row.status === "pending").length,
      status: physicalOccupancy >= TOTAL_CAPACITY ? "DIVERSION_RISK" : "NORMAL",
      dailyRevenue: 0, 
      collectionCount: 0,
    };
  },
});

export const getThroughputBoard = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const activeEncounters = await ctx.db
      .query("encounters")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "discharged"))
      .collect();

    const board = await Promise.all(
      activeEncounters.map(async (encounter) => {
        const state = await getEncounterOperationalState(ctx, encounter);

        return {
          _id: encounter._id,
          patientId: encounter.patientId,
          patientName: state.patient?.name ?? encounter.patientName ?? "Unknown Patient",
          mrn: state.patient?.mrn ?? "N/A",
          acuity: encounter.acuity,
          chiefComplaint: encounter.chiefComplaint,
          status: encounter.status,
          location: normalizeBedLocation(encounter.location) ?? encounter.location ?? "Waiting",
          assignedProvider: encounter.assignedProvider ?? "",
          flowOwner: encounter.flowOwner ?? "",
          flowStage: state.stage,
          flowStageUpdatedAt: encounter.flowStageUpdatedAt ?? encounter._creationTime,
          dispositionPlan: encounter.dispositionPlan ?? "undecided",
          delayReason: state.delayReason,
          delayNote: encounter.delayNote ?? "",
          estimatedDischargeTime: encounter.estimatedDischargeTime,
          pendingLabCount: state.pendingLabCount,
          pendingImagingCount: state.pendingImagingCount,
          criticalLabCount: state.criticalLabCount,
          hasActiveConsult: state.hasActiveConsult,
          ageMinutes: Math.max(0, Math.floor((now - encounter._creationTime) / 60000)),
          stageAgeMinutes: Math.max(
            0,
            Math.floor((now - (encounter.flowStageUpdatedAt ?? encounter._creationTime)) / 60000)
          ),
          columnKey: state.columnKey,
          isBlocked: state.columnKey === "blocked",
        };
      })
    );

    return board.sort((left, right) => {
      if (left.columnKey !== right.columnKey) {
        return left.columnKey.localeCompare(right.columnKey);
      }
      if (left.acuity !== right.acuity) {
        return left.acuity - right.acuity;
      }
      return right.ageMinutes - left.ageMinutes;
    });
  },
});

export const getThroughputMetrics = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allEncounters = await ctx.db.query("encounters").collect();
    const relevantEncounters = allEncounters.filter(
      (encounter) =>
        encounter.status !== "discharged" ||
        (encounter.dischargedAt ?? 0) >= now - THROUGHPUT_SHIFT_WINDOW_MS
    );
    const activeEncounters = relevantEncounters.filter((encounter) => encounter.status !== "discharged");

    const activeStates = await Promise.all(
      activeEncounters.map(async (encounter) => ({
        encounter,
        ...(await getEncounterOperationalState(ctx, encounter)),
      }))
    );

    const blockedCount = activeStates.filter(
      ({ stage, delayReason }) => stage === "boarded" || delayReason !== DEFAULT_DELAY_REASON
    ).length;
    const readyDischargeCount = activeStates.filter(({ stage }) => stage === "discharge_ready").length;
    const readyAdmissionCount = activeStates.filter(
      ({ stage }) => stage === "admit_ready" || stage === "boarded"
    ).length;

    const columnCounts = activeStates.reduce<Record<ThroughputColumnKey, number>>(
      (counts, state) => {
        counts[state.columnKey] += 1;
        return counts;
      },
      {
        frontDoor: 0,
        workup: 0,
        disposition: 0,
        blocked: 0,
      }
    );

    const blockerCounts = activeStates.reduce<Record<DelayReason, number>>(
      (counts, state) => {
        counts[state.delayReason] += 1;
        return counts;
      },
      {
        none: 0,
        awaiting_bed: 0,
        awaiting_provider: 0,
        awaiting_labs: 0,
        awaiting_imaging: 0,
        awaiting_consult: 0,
        awaiting_transport: 0,
        awaiting_inpatient_bed: 0,
        awaiting_discharge_paperwork: 0,
        insurance_hold: 0,
        registration_hold: 0,
        other: 0,
      }
    );

    const doorToBedSamples = relevantEncounters
      .filter((encounter) => encounter.bedAssignedAt)
      .map((encounter) => Math.max(0, Math.round(((encounter.bedAssignedAt ?? 0) - encounter._creationTime) / 60000)));

    const providerToDecisionSamples = relevantEncounters
      .filter((encounter) => encounter.providerAssignedAt && encounter.dispositionDecisionAt)
      .map((encounter) =>
        Math.max(
          0,
          Math.round(((encounter.dispositionDecisionAt ?? 0) - (encounter.providerAssignedAt ?? 0)) / 60000)
        )
      );

    const dischargeLagSamples = relevantEncounters
      .filter((encounter) => encounter.readyForDischargeAt && encounter.dischargedAt)
      .map((encounter) =>
        Math.max(
          0,
          Math.round(((encounter.dischargedAt ?? 0) - (encounter.readyForDischargeAt ?? 0)) / 60000)
        )
      );

    const boardingSamples = relevantEncounters
      .filter((encounter) => encounter.readyForAdmissionAt)
      .map((encounter) =>
        Math.max(
          0,
          Math.round((((encounter.dischargedAt ?? now) - (encounter.readyForAdmissionAt ?? 0)) / 60000))
        )
      );

    return {
      activeCount: activeEncounters.length,
      blockedCount,
      readyDischargeCount,
      readyAdmissionCount,
      columnCounts,
      blockerCounts: Object.entries(blockerCounts)
        .filter(([reason, count]) => reason !== DEFAULT_DELAY_REASON && count > 0)
        .sort((left, right) => right[1] - left[1])
        .map(([reason, count]) => ({ reason, count })),
      avgDoorToBedMinutes: averageMinutes(doorToBedSamples),
      avgProviderToDecisionMinutes: averageMinutes(providerToDecisionSamples),
      avgDischargeLagMinutes: averageMinutes(dischargeLagSamples),
      avgBoardingMinutes: averageMinutes(boardingSamples),
      windowHours: THROUGHPUT_SHIFT_WINDOW_MS / (60 * 60 * 1000),
    };
  },
});

export const getComplaintStats = query({
  args: {},
  handler: async (ctx) => {
    const encounters = await ctx.db.query("encounters").collect();
    
    // 📊 Aggregate and Count
    const counts: Record<string, number> = {};
    encounters.forEach((e) => {
      const complaint = e.chiefComplaint || "Unspecified";
      counts[complaint] = (counts[complaint] || 0) + 1;
    });

    // 🏆 Sort and format for the chart
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5
  },
});

export const getByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("encounters")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId)) // Ensure you have this index in schema!
      .order("desc")
      .collect();
  },
});

export const getPatientTimeline = query({
  args: { encounterId: v.id("encounters"), patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const vitals = await ctx.db
      .query("vitals")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const faxes = await ctx.db
      .query("faxes")
      .filter((q) => q.eq(q.field("patientId"), args.patientId))
      .collect();

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const clinicalNotes = await ctx.db
      .query("clinicalNotes")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const quickNotes = await ctx.db
      .query("notes")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const documentAuditLogs = await ctx.db
      .query("chartDocumentAuditLogs")
      .withIndex("by_encounter_timestamp", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    // 1. Map to a unified structure
    const rawEvents = [
      ...vitals.map((v) => ({
        type: "VITALS",
        time: v.recordedAt,
        title: "Vitals Recorded",
        description: `HR: ${v.hr}, BP: ${v.bp}, O2: ${v.spO2}%`,
        priority: v.spO2 <= 92 || v.hr >= 120 ? "critical" : "normal",
      })),
      ...faxes.map((f) => ({
        type: "DOCUMENT",
        time: f.timestamp,
        title: "Clinical Document Linked",
        description: `${f.from ?? "External Source"}: ${f.subject ?? "Document received"}`,
        priority: "normal",
      })),
      ...orders.map((o) => ({
        type: "ORDER",
        time: o.orderedAt,
        title: `${o.type === "LAB" ? "Lab" : "Imaging"} Order Placed`,
        description: `${o.testName} — ${o.priority}${o.status !== "PENDING" ? ` (${o.status})` : ""}`,
        priority: o.priority === "STAT" ? "attention" : "normal",
      })),
      ...clinicalNotes.map((note) => ({
        type: "NOTE",
        time: note.signedAt,
        title: `${note.type} Signed`,
        description: `${note.authorName} documented ${note.type.toLowerCase()} details.`,
        actor: note.authorName,
        priority: "normal",
      })),
      ...quickNotes.map((note) => ({
        type: "NOTE",
        time: note._creationTime,
        title: `${note.category} Note Logged`,
        description: `${note.author}: ${note.content.slice(0, 120)}${note.content.length > 120 ? "..." : ""}`,
        actor: note.author,
        priority: note.isTemplate ? "attention" : "normal",
      })),
      ...documentAuditLogs.map((log) => ({
        type: "AUDIT",
        time: log.timestamp,
        title: `Document ${log.action}`,
        description: `${log.actorName} (${log.actorRole})${log.fileName ? ` • ${log.fileName}` : ""}${log.note ? ` • ${log.note}` : ""}`,
        actor: log.actorName,
        priority: log.action === "ACCESS_DENIED" || log.action === "DELETE" || log.action === "HARD_DELETE" ? "critical" : "attention",
      })),
    ];

    // 2. Filter out any potential undefined timestamps and sort
    // We use a non-null assertion or check to satisfy the TS compiler
    return rawEvents
      .filter((event) => event.time !== undefined)
      .sort((a, b) => (b.time as number) - (a.time as number));
  },
});

export const updateStatus = mutation({
  args: {
    encounterId: v.id("encounters"),
    nextStatus: v.union(
      v.literal("triage"),
      v.literal("waiting"),
      v.literal("treating"),
      v.literal("observed"), // <-- ADD THIS LINE
      v.literal("discharged")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.encounterId, { 
      status: args.nextStatus,
      // If discharging, log the time automatically for analytics
      ...(args.nextStatus === "discharged" ? { dischargedAt: Date.now() } : {})
    });
  },
});

export const updateEncounterFlow = mutation({
  args: {
    encounterId: v.id("encounters"),
    flowStage: v.optional(throughputStageValidator),
    flowOwner: v.optional(v.string()),
    assignedProvider: v.optional(v.string()),
    dispositionPlan: v.optional(dispositionPlanValidator),
    delayReason: v.optional(delayReasonValidator),
    delayNote: v.optional(v.string()),
    estimatedDischargeTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const now = Date.now();
    const patch: Partial<Doc<"encounters">> = {};

    if (args.flowOwner !== undefined) {
      patch.flowOwner = args.flowOwner.trim() || undefined;
    }

    if (args.assignedProvider !== undefined) {
      const nextProvider = args.assignedProvider.trim();
      patch.assignedProvider = nextProvider || undefined;

      if (nextProvider && nextProvider !== encounter.assignedProvider) {
        patch.providerAssignedAt = now;
      }
    }

    if (args.dispositionPlan !== undefined) {
      patch.dispositionPlan = args.dispositionPlan;

      if (args.dispositionPlan !== (encounter.dispositionPlan ?? "undecided") && args.dispositionPlan !== "undecided") {
        patch.dispositionDecisionAt = now;
      }
    }

    if (args.delayReason !== undefined) {
      patch.delayReason = args.delayReason;
      if (args.delayReason === DEFAULT_DELAY_REASON) {
        patch.delayNote = undefined;
      }
    }

    if (args.delayNote !== undefined && (args.delayReason ?? encounter.delayReason ?? DEFAULT_DELAY_REASON) !== DEFAULT_DELAY_REASON) {
      patch.delayNote = args.delayNote.trim() || undefined;
    }

    if (args.estimatedDischargeTime !== undefined) {
      patch.estimatedDischargeTime = args.estimatedDischargeTime;
    }

    if (args.flowStage !== undefined) {
      patch.flowStage = args.flowStage;
      patch.flowStageUpdatedAt = now;

      if (args.flowStage === "awaiting_bed" || args.flowStage === "triage") {
        patch.status = args.flowStage === "triage" ? "triage" : "waiting";
      }

      if (
        args.flowStage === "bedded" ||
        args.flowStage === "provider_assigned" ||
        args.flowStage === "workup_pending" ||
        args.flowStage === "consult_pending" ||
        args.flowStage === "discharge_ready"
      ) {
        patch.status = "treating";
      }

      if (args.flowStage === "admit_ready" || args.flowStage === "boarded") {
        patch.status = "observed";
      }

      if (args.flowStage === "provider_assigned" && !encounter.providerAssignedAt) {
        patch.providerAssignedAt = now;
      }

      if (args.flowStage === "discharge_ready" && !encounter.readyForDischargeAt) {
        patch.readyForDischargeAt = now;
      }

      if ((args.flowStage === "admit_ready" || args.flowStage === "boarded") && !encounter.readyForAdmissionAt) {
        patch.readyForAdmissionAt = now;
      }
    }

    await ctx.db.patch(args.encounterId, patch);

    return { updatedAt: now };
  },
});

export const assignBed = mutation({
  args: {
    encounterId: v.id("encounters"),
    location: v.string(),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const nextLocation = args.location.trim();
    const requestedBed = normalizeBedLocation(nextLocation);

    if (requestedBed) {
      const activeEncounters = await ctx.db
        .query("encounters")
        .withIndex("by_status")
        .filter((q) => q.neq(q.field("status"), "discharged"))
        .collect();

      const occupiedByOther = activeEncounters.find(
        (encounter) =>
          encounter._id !== args.encounterId &&
          normalizeBedLocation(encounter.location) === requestedBed
      );

      if (occupiedByOther) {
        throw new Error(`${requestedBed} is already occupied.`);
      }
    }

    await ctx.db.patch(args.encounterId, { 
      location: requestedBed ?? nextLocation,
      ...(requestedBed && !encounter.bedAssignedAt ? { bedAssignedAt: Date.now() } : {}),
      ...(requestedBed ? { flowStage: "bedded", flowStageUpdatedAt: Date.now() } : { flowStage: "awaiting_bed", flowStageUpdatedAt: Date.now() }),
      ...(nextLocation ? { status: "treating" } : {}),
    });
  },
});

export const clearAllBeds = mutation({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("encounters")
      .filter((q) => q.neq(q.field("status"), "discharged"))
      .collect();

    for (const encounter of active) {
      await ctx.db.patch(encounter._id, { location: "" });
    }
  },
});

export const getById = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) return null;
    return encounter;
  },
});

export const getShiftMetrics = query({
  handler: async (ctx) => {
    const allEncounters = await ctx.db.query("encounters").collect();
    const now = Date.now();
    const shiftStart = now - (12 * 60 * 60 * 1000); 

    const active = allEncounters.filter(e => e.status !== "discharged");
    const dischargedInShift = allEncounters.filter(
      (e) =>
        e.status === "discharged" &&
        // Backfill-safe: some historical rows may not have dischargedAt.
        (e.dischargedAt ?? e._creationTime) > shiftStart
    );

    // 1. ACUITY DISTRIBUTION (ESI MIX)
    const acuityColors: Record<number, string> = {
      1: "#dc2626", // Red - Immediate
      2: "#ea580c", // Orange - Emergent
      3: "#eab308", // Yellow - Urgent
      4: "#2563eb", // Blue - Less Urgent
      5: "#64748b", // Grey - Non-Urgent
    };

    const acuityDist = [1, 2, 3, 4, 5].map(level => ({
      name: `ESI ${level}`,
      value: active.filter(e => e.acuity === level).length,
      fill: acuityColors[level]
    })).filter(item => item.value > 0);

    // 2. HIGH RISK VITALS TICKER LOGIC
    // Flags patients with physiologically unstable vitals
    const highRiskPatients = await Promise.all(
      active.filter(e => 
        (e.vitals.hr > 120) || 
        (e.vitals.spO2 < 92 && e.vitals.spO2 > 0) || 
        (e.vitals.temp > 103)
      ).map(async (e) => {
        // We fetch the patient document to get the name
        const patient = await ctx.db.get(e.patientId);
        return {
          name: patient?.name || "Unknown Patient", // This is what the frontend expects as 'name'
          issue: e.vitals.hr > 120 ? "Tachycardia" : e.vitals.spO2 < 92 ? "Hypoxia" : "High Fever",
          location: e.location || "Triage"
        };
      })
    );

    // 3. LENGTH OF STAY (LOS) & TREND
    const losSamplesMs = [
      ...dischargedInShift.map((e) => (e.dischargedAt ?? now) - e._creationTime),
      ...active.map((e) => now - e._creationTime),
    ].filter((ms) => ms > 0);

    const totalLOS = losSamplesMs.reduce((acc, ms) => acc + ms, 0);

    const avgLOS = losSamplesMs.length > 0
      ? Math.floor(totalLOS / losSamplesMs.length / 60000)
      : 0;

    const losTrend = [
      { value: Math.max(0, avgLOS - 15) },
      { value: Math.max(0, avgLOS + 10) },
      { value: Math.max(0, avgLOS - 5) },
      { value: avgLOS + 12 },
      { value: avgLOS }
    ];

    // 4. TIME TO PROVIDER (TTP)
    // Measures time from creation to reaching 'treating' status
    const treatedEncounters = allEncounters.filter(e => 
      e.status === "treating" || e.status === "discharged"
    );

    const totalTTP = treatedEncounters.reduce((acc, e) => {
      // In a real app, you'd use a specific 'treatedAt' timestamp
      return acc + ((e.dischargedAt || now) - e._creationTime);
    }, 0);

    const avgTTP = treatedEncounters.length > 0 
      ? Math.floor(totalTTP / treatedEncounters.length / 60000) 
      : 0;

    // 5. STAFFING RATIO
    // Assume 4 clinicians are currently on the shift
    const staffCount = 4;
    const staffRatio = parseFloat((active.length / staffCount).toFixed(1));

    // 6. BOTTLENECK LOGIC
    const statusCounts: Record<string, number> = {};
    active.forEach(e => {
      statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
    });
    const bottleneck = Object.entries(statusCounts).reduce((a, b) => 
      (a[1] > b[1] ? a : b), ["None", 0]
    );

    return {
      acuityDist,
      highRiskPatients,
      activeCount: active.length,
      dischargedCount: dischargedInShift.length,
      avgLOS,
      losTrend,
      avgTTP,
      ttpTarget: 30, // 30 minute clinical goal
      staffRatio,
      criticalCount: active.filter(e => e.acuity === 1).length,
      bottleneckStatus: bottleneck[0],
      bottleneckCount: bottleneck[1]
    };
  },
});

export const getTimeline = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const vitals = await ctx.db.query("vitals").withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId)).collect();
    const labs = await ctx.db.query("labResults").withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId)).collect();
    const imaging = await ctx.db.query("imagingOrders").withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId)).collect();

    // Map all into a common 'event' format
    const events = [
      ...vitals.map(v => ({ time: v._creationTime, type: "VITALS", detail: `BP: ${v.bp}, HR: ${v.hr}` })),
      ...labs.filter(l => l.status === "final").map(l => ({ time: l._creationTime, type: "LABS", detail: `${l.testName} resulted: ${l.value} ${l.unit}` })),
      ...imaging.filter(i => i.status === "Resulted").map(i => ({ time: i.orderedAt, type: "IMAGING", detail: `${i.studyName} Resulted` })),
    ];

    return events.sort((a, b) => b.time - a.time); // Newest first
  },
});

export const seedMockPatient = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. First, create a mock patient record to get a valid Id<"patients">
    const patientId = await ctx.db.insert("patients", {
      name: "John Doe",
      mrn: "12345678",
      dob: "1980-01-01",
      gender: "M",
      allergies: ["NKDA"],
      codeStatus: "Full Code",
      searchVector: "John Doe 12345678",
    });

    // 2. Now use that real ID for the encounter
    const encounterId = await ctx.db.insert("encounters", {
      patientId: patientId, // This is now correctly typed as Id<"patients">
      chiefComplaint: "Chest Pain",
      acuity: 1,
      vitals: { hr: 110, bp: "150/90", spO2: 95, temp: 98.6 },
      status: "waiting",
      location: "",
      patientName: "John Doe",
    });

    return encounterId;
  },
});

export const getEncounterDetails = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) return null;

    const insurance = await ctx.db
      .query("insurance")
      .withIndex("by_patient", (q) => q.eq("patientId", encounter.patientId))
      .first();

    return {
      ...encounter,
      insurance, // Now the UI gets both in one object
    };
  },
});

export const getEncounterWithInsurance = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) return null;

    // "Join" the insurance table using the patientId
    const insurance = await ctx.db
      .query("insurance")
      .withIndex("by_patient", (q) => q.eq("patientId", encounter.patientId))
      .first();

    return {
      ...encounter,
      insurance: insurance ?? null, // Now 'insurance' exists on this object
    };
  },
});

export const getByPatientWithInsurance = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    // 1. Get all encounters for this specific patient
    const encounters = await ctx.db
      .query("encounters")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect();

    // 2. Map through them and attach the insurance record
    // Since insurance is tied to the patientId, we can fetch it once
    const insurance = await ctx.db
      .query("insurance")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .first();

    // 3. Return the merged objects
    return encounters.map((encounter) => ({
      ...encounter,
      insurance: insurance ?? null,
    }));
  },
});

export const runCOBDiscovery = mutation({
  args: { patientId: v.id("patients") },
  handler: async () => {
    // This simulates searching a state database for secondary coverage
    const hasSecondary = Math.random() > 0.7; // 30% chance they have secondary
    
    if (hasSecondary) {
      // In a real app, you'd create a second insurance record here
      return { found: true, provider: "NJ FamilyCare (Medicaid)" };
    }
    return { found: false };
  }
});

export const triageHandoff = mutation({
  args: {
    encounterId: v.id("encounters"),
    acuity: v.number(),
    location: v.string(),
    vitals: v.object({
      hr: v.number(),
      bp: v.string(),
      spO2: v.number(),
      temp: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.encounterId, {
      acuity: args.acuity,
      location: args.location,
      vitals: args.vitals,
      status: "treating", // Move from 'waiting' to 'treating'
    });
  },
});

export const updateAcuity = mutation({
  args: { id: v.id("encounters"), acuity: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { acuity: args.acuity });
  },
});

export const updateBoardingWorkflow = mutation({
  args: {
    encounterId: v.id("encounters"),
    assignedInpatientUnit: v.optional(v.string()),
    inpatientBedLabel: v.optional(v.string()),
    transportStatus: transportStatusValidator,
    roomTurnoverStatus: roomTurnoverStatusValidator,
    markAdmitAccepted: v.optional(v.boolean()),
    markInpatientBedRequested: v.optional(v.boolean()),
    markInpatientBedAssigned: v.optional(v.boolean()),
    markHandoffCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const now = Date.now();
    const patch: Partial<Doc<"encounters">> = {};

    if (args.assignedInpatientUnit !== undefined) {
      patch.assignedInpatientUnit = args.assignedInpatientUnit.trim() || undefined;
    }

    if (args.inpatientBedLabel !== undefined) {
      patch.inpatientBedLabel = args.inpatientBedLabel.trim() || undefined;
    }

    if (args.transportStatus !== undefined) {
      patch.transportStatus = args.transportStatus;
      patch.transportUpdatedAt = now;
    }

    if (args.roomTurnoverStatus !== undefined) {
      patch.roomTurnoverStatus = args.roomTurnoverStatus;
      patch.roomTurnoverUpdatedAt = now;
    }

    if (args.markAdmitAccepted && !encounter.admitAcceptedAt) {
      patch.admitAcceptedAt = now;
      patch.dispositionPlan = encounter.dispositionPlan ?? "admit";
      patch.flowStage = "admit_ready";
      patch.flowStageUpdatedAt = now;
    }

    if (args.markInpatientBedRequested && !encounter.inpatientBedRequestedAt) {
      patch.inpatientBedRequestedAt = now;
      patch.delayReason = "awaiting_inpatient_bed";
    }

    if (args.markInpatientBedAssigned) {
      patch.inpatientBedAssignedAt = now;
      patch.delayReason = encounter.transportStatus === "completed" ? "none" : "awaiting_transport";
      patch.flowStage = "boarded";
      patch.flowStageUpdatedAt = now;
    }

    if (args.markHandoffCompleted) {
      patch.handoffCompletedAt = now;
      if ((args.transportStatus ?? encounter.transportStatus) === "completed") {
        patch.delayReason = "none";
      }
    }

    await ctx.db.patch(args.encounterId, patch);
    return { updatedAt: now };
  },
});