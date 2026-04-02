import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const ROOM_TURNOVER_OVERDUE_MINUTES = 20;

const PROTOCOL_BUNDLES: Record<string, { orders: Array<{ type: "LAB" | "IMAGING"; testName: string; priority: "ROUTINE" | "STAT" }>; tasks: string[]; flowStage?: "workup_pending" | "consult_pending"; delayReason?: "awaiting_labs" | "awaiting_imaging" | "awaiting_consult" | "none"; }> = {
  "stroke-alert": {
    orders: [
      { type: "IMAGING", testName: "CT Head Without Contrast", priority: "STAT" },
      { type: "LAB", testName: "Point-of-Care Glucose", priority: "STAT" },
      { type: "LAB", testName: "Coagulation Panel", priority: "STAT" },
    ],
    tasks: ["Document last-known-well time", "Page neurology / tele-stroke", "Prepare CT transport"],
    flowStage: "consult_pending",
    delayReason: "awaiting_consult",
  },
  "sepsis-bundle": {
    orders: [
      { type: "LAB", testName: "Lactate", priority: "STAT" },
      { type: "LAB", testName: "Blood Cultures", priority: "STAT" },
      { type: "LAB", testName: "CBC / CMP", priority: "STAT" },
    ],
    tasks: ["Start broad-spectrum antibiotics", "Assess fluid bolus readiness", "Repeat sepsis reassessment"],
    flowStage: "workup_pending",
    delayReason: "awaiting_labs",
  },
  "chest-pain-acs": {
    orders: [
      { type: "LAB", testName: "Troponin", priority: "STAT" },
      { type: "LAB", testName: "BMP", priority: "STAT" },
      { type: "IMAGING", testName: "Portable Chest X-Ray", priority: "ROUTINE" },
    ],
    tasks: ["Obtain ECG within 10 minutes", "Administer aspirin if eligible", "Calculate HEART score"],
    flowStage: "workup_pending",
    delayReason: "awaiting_labs",
  },
  "head-injury": {
    orders: [
      { type: "IMAGING", testName: "CT Head Without Contrast", priority: "STAT" },
    ],
    tasks: ["Perform serial GCS checks", "Review anticoagulation status", "Prepare neurosurgery escalation if needed"],
    flowStage: "workup_pending",
    delayReason: "awaiting_imaging",
  },
  "trauma-activation": {
    orders: [
      { type: "LAB", testName: "Type and Screen", priority: "STAT" },
      { type: "LAB", testName: "CBC", priority: "STAT" },
      { type: "IMAGING", testName: "Trauma Pan-Scan", priority: "STAT" },
    ],
    tasks: ["Activate trauma team", "Prepare blood products", "Document primary survey"],
    flowStage: "workup_pending",
    delayReason: "awaiting_imaging",
  },
  "behavioral-health-hold": {
    orders: [
      { type: "LAB", testName: "Medical Clearance Panel", priority: "ROUTINE" },
    ],
    tasks: ["Initiate safety sitter / observation", "Secure belongings and remove hazards", "Notify behavioral health team"],
    flowStage: "consult_pending",
    delayReason: "awaiting_consult",
  },
};

export const getOperationalAlerts = query({
  args: { encounterId: v.optional(v.id("encounters")) },
  handler: async (ctx, args) => {
    const encounters = args.encounterId
      ? [await ctx.db.get(args.encounterId)].filter(Boolean)
      : await ctx.db
          .query("encounters")
          .withIndex("by_status")
          .filter((q) => q.neq(q.field("status"), "discharged"))
          .collect();

    const alerts = [] as Array<{
      kind: "lab" | "imaging" | "consult" | "room" | "assignment";
      encounterId: string;
      patientId: string;
      patientName: string;
      severity: "critical" | "attention";
      title: string;
      detail: string;
      createdAt: number;
      acknowledgedAt?: number;
      labId?: string;
      imagingOrderId?: string;
      consultId?: string;
      roomTurnoverStatus?: string;
      missingOwner?: boolean;
      missingProvider?: boolean;
    }>;

    for (const encounter of encounters) {
      if (!encounter) continue;
      const patient = await ctx.db.get(encounter.patientId);
      const patientName = patient?.name ?? encounter.patientName ?? "Unknown Patient";

      const [labs, imaging, consults] = await Promise.all([
        ctx.db.query("labResults").withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id)).collect(),
        ctx.db.query("imagingOrders").withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id)).collect(),
        ctx.db.query("teleConsults").withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id)).collect(),
      ]);

      const roomTurnoverStatus = encounter.roomTurnoverStatus ?? "not_started";
      const roomTurnoverUpdatedAt = encounter.roomTurnoverUpdatedAt ?? encounter.flowStageUpdatedAt ?? encounter._creationTime;
      const roomTurnoverAgeMinutes = Math.max(0, Math.floor((Date.now() - roomTurnoverUpdatedAt) / 60000));
      const roomTurnoverIsOverdue =
        (roomTurnoverStatus === "cleaning" && roomTurnoverAgeMinutes >= ROOM_TURNOVER_OVERDUE_MINUTES) ||
        (roomTurnoverStatus === "not_started" && encounter.flowStage === "boarded" && roomTurnoverAgeMinutes >= ROOM_TURNOVER_OVERDUE_MINUTES);

      const stageAgeMinutes = Math.max(0, Math.floor((Date.now() - (encounter.flowStageUpdatedAt ?? encounter._creationTime)) / 60000));
      const missingOwner = !encounter.flowOwner?.trim();
      const missingProvider = !encounter.assignedProvider?.trim();
      const assignmentIsOverdue = stageAgeMinutes >= 15 && (missingOwner || missingProvider);

      if (assignmentIsOverdue) {
        alerts.push({
          kind: "assignment",
          encounterId: encounter._id,
          patientId: encounter.patientId,
          patientName,
          severity: stageAgeMinutes >= 30 ? "critical" : "attention",
          title: "Unassigned Encounter",
          detail: `No ${missingOwner && missingProvider ? "flow owner or provider" : missingOwner ? "flow owner" : "provider"} after ${stageAgeMinutes}m in stage.`,
          createdAt: encounter.flowStageUpdatedAt ?? encounter._creationTime,
          missingOwner,
          missingProvider,
        });
      }

      if (roomTurnoverStatus !== "ready") {
        alerts.push({
          kind: "room",
          encounterId: encounter._id,
          patientId: encounter.patientId,
          patientName,
          severity: roomTurnoverIsOverdue ? "critical" : "attention",
          title: roomTurnoverStatus === "cleaning" ? "Room Cleaning In Progress" : "Room Turnover Needed",
          detail: roomTurnoverIsOverdue
            ? `Room is ${roomTurnoverStatus.replaceAll("_", " ")} and overdue by ${roomTurnoverAgeMinutes - ROOM_TURNOVER_OVERDUE_MINUTES}m.`
            : `Room is ${roomTurnoverStatus.replaceAll("_", " ")}; turnover age ${roomTurnoverAgeMinutes}m.`,
          createdAt: roomTurnoverUpdatedAt,
          roomTurnoverStatus,
        });
      }

      for (const lab of labs) {
        if (!lab.isAbnormal || lab.acknowledgedAt) continue;
        alerts.push({
          kind: "lab",
          encounterId: encounter._id,
          patientId: encounter.patientId,
          patientName,
          severity: "critical",
          title: `Critical Lab: ${lab.testName}`,
          detail: `${lab.value} ${lab.unit} (range ${lab.range})`,
          createdAt: lab._creationTime,
          labId: lab._id,
        });
      }

      for (const study of imaging) {
        if (study.status !== "Resulted" || study.acknowledgedAt || !study.report) continue;
        alerts.push({
          kind: "imaging",
          encounterId: encounter._id,
          patientId: encounter.patientId,
          patientName,
          severity: study.priority === "STAT" ? "critical" : "attention",
          title: `Imaging Result: ${study.studyName}`,
          detail: study.report.slice(0, 140),
          createdAt: study.resultedAt ?? study.orderedAt,
          imagingOrderId: study._id,
        });
      }

      for (const consult of consults) {
        if (consult.status !== "ACTIVE" || consult.acknowledgedAt) continue;
        alerts.push({
          kind: "consult",
          encounterId: encounter._id,
          patientId: encounter.patientId,
          patientName,
          severity: "attention",
          title: `${consult.specialty} Consult Active`,
          detail: `Room ${consult.roomName} is awaiting callback acknowledgement.`,
          createdAt: consult.requestedAt,
          consultId: consult._id,
        });
      }
    }

    return alerts.sort((left, right) => right.createdAt - left.createdAt);
  },
});

export const getThroughputBoard = query({
  args: {},
  handler: async (ctx) => {
    const activeEncounters = await ctx.db
      .query("encounters")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "discharged"))
      .collect();

    return await Promise.all(
      activeEncounters.map(async (encounter) => {
        const patient = await ctx.db.get(encounter.patientId);
        return {
          _id: encounter._id,
          patientId: encounter.patientId,
          patientName: patient?.name ?? encounter.patientName ?? "Unknown Patient",
          location: encounter.location ?? "Unassigned",
          flowStage: encounter.flowStage ?? "triage",
          flowOwner: encounter.flowOwner,
          assignedProvider: encounter.assignedProvider,
          status: encounter.status,
          acuity: encounter.acuity ?? 5,
          chiefComplaint: encounter.chiefComplaint,
          _creationTime: encounter._creationTime,
        };
      })
    );
  },
});

export const getRoomTurnoverQueue = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const activeEncounters = await ctx.db
      .query("encounters")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "discharged"))
      .collect();

    const queue = await Promise.all(
      activeEncounters.map(async (encounter) => {
        const patient = await ctx.db.get(encounter.patientId);
        const roomTurnoverStatus = encounter.roomTurnoverStatus ?? "not_started";
        const turnStart = encounter.roomTurnoverUpdatedAt ?? encounter.flowStageUpdatedAt ?? encounter._creationTime;
        const ageMinutes = Math.max(0, Math.floor((now - turnStart) / 60000));
        const isOverdue =
          (roomTurnoverStatus === "cleaning" && ageMinutes >= ROOM_TURNOVER_OVERDUE_MINUTES) ||
          (roomTurnoverStatus === "not_started" && encounter.flowStage === "boarded" && ageMinutes >= ROOM_TURNOVER_OVERDUE_MINUTES);

        return {
          _id: encounter._id,
          patientId: encounter.patientId,
          patientName: patient?.name ?? encounter.patientName ?? "Unknown Patient",
          location: encounter.location ?? "Unassigned",
          flowStage: encounter.flowStage ?? "triage",
          roomTurnoverStatus,
          roomTurnoverUpdatedAt: encounter.roomTurnoverUpdatedAt,
          ageMinutes,
          isOverdue,
          isCleaning: roomTurnoverStatus === "cleaning",
          canMarkReady: roomTurnoverStatus !== "ready",
          canStartCleaning: roomTurnoverStatus !== "cleaning" && roomTurnoverStatus !== "ready",
        };
      })
    );

    return queue
      .filter((row) => row.roomTurnoverStatus !== "ready" || row.isOverdue)
      .sort((left, right) => {
        if (left.isOverdue !== right.isOverdue) return left.isOverdue ? -1 : 1;
        if (left.roomTurnoverStatus !== right.roomTurnoverStatus) return left.roomTurnoverStatus.localeCompare(right.roomTurnoverStatus);
        return right.ageMinutes - left.ageMinutes;
      });
  },
});

export const getProviderWorkload = query({
  args: {},
  handler: async (ctx) => {
    const activeEncounters = await ctx.db
      .query("encounters")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "discharged"))
      .collect();

    const buckets = new Map<string, {
      name: string;
      assignedCount: number;
      highAcuityCount: number;
      acuityWeightedLoad: number;
      blockedCount: number;
      readyDischargeCount: number;
      openAlertCount: number;
    }>();

    for (const encounter of activeEncounters) {
      const key = encounter.assignedProvider?.trim() || encounter.flowOwner?.trim() || "Unassigned";
      const existing = buckets.get(key) ?? {
        name: key,
        assignedCount: 0,
        highAcuityCount: 0,
        acuityWeightedLoad: 0,
        blockedCount: 0,
        readyDischargeCount: 0,
        openAlertCount: 0,
      };

      const [labs, imaging, consults] = await Promise.all([
        ctx.db.query("labResults").withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id)).collect(),
        ctx.db.query("imagingOrders").withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id)).collect(),
        ctx.db.query("teleConsults").withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id)).collect(),
      ]);

      const acuity = encounter.acuity ?? 5;
      const acuityMultiplier = acuity <= 2 ? 3 : acuity <= 3 ? 2 : 1;

      existing.assignedCount += 1;
      existing.acuityWeightedLoad += acuityMultiplier;
      if (acuity <= 2) existing.highAcuityCount += 1;
      if (encounter.delayReason && encounter.delayReason !== "none") existing.blockedCount += 1;
      if (encounter.flowStage === "discharge_ready") existing.readyDischargeCount += 1;
      existing.openAlertCount += labs.filter((lab) => lab.isAbnormal && !lab.acknowledgedAt).length;
      existing.openAlertCount += imaging.filter((study) => study.status === "Resulted" && !study.acknowledgedAt).length;
      existing.openAlertCount += consults.filter((consult) => consult.status === "ACTIVE" && !consult.acknowledgedAt).length;

      buckets.set(key, existing);
    }

    return Array.from(buckets.values()).sort((left, right) => {
      if (right.highAcuityCount !== left.highAcuityCount) return right.highAcuityCount - left.highAcuityCount;
      if (right.acuityWeightedLoad !== left.acuityWeightedLoad) return right.acuityWeightedLoad - left.acuityWeightedLoad;
      if (right.openAlertCount !== left.openAlertCount) return right.openAlertCount - left.openAlertCount;
      return right.assignedCount - left.assignedCount;
    });
  },
});

export const getAssignmentRecommendations = query({
  args: {},
  handler: async (ctx) => {
    const [roster, activeEncounters] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db
        .query("encounters")
        .withIndex("by_status")
        .filter((q) => q.neq(q.field("status"), "discharged"))
        .collect(),
    ]);

    const activeRoster = roster
      .filter((user) => user.status === "ACTIVE")
      .map((user) => ({
        _id: user._id,
        name: user.name,
        role: user.role,
        department: user.department,
      }));

    const workloadByName = new Map<string, {
      assignedCount: number;
      highAcuityCount: number;
      blockedCount: number;
      readyDischargeCount: number;
      openAlertCount: number;
    }>();

    for (const encounter of activeEncounters) {
      const key = encounter.assignedProvider?.trim() || encounter.flowOwner?.trim() || "Unassigned";
      const existing = workloadByName.get(key) ?? {
        assignedCount: 0,
        highAcuityCount: 0,
        blockedCount: 0,
        readyDischargeCount: 0,
        openAlertCount: 0,
      };

      const [labs, imaging, consults] = await Promise.all([
        ctx.db.query("labResults").withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id)).collect(),
        ctx.db.query("imagingOrders").withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id)).collect(),
        ctx.db.query("teleConsults").withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id)).collect(),
      ]);

      existing.assignedCount += 1;
      if (encounter.acuity <= 2) existing.highAcuityCount += 1;
      if (encounter.delayReason && encounter.delayReason !== "none") existing.blockedCount += 1;
      if (encounter.flowStage === "discharge_ready") existing.readyDischargeCount += 1;
      existing.openAlertCount += labs.filter((lab) => lab.isAbnormal && !lab.acknowledgedAt).length;
      existing.openAlertCount += imaging.filter((study) => study.status === "Resulted" && !study.acknowledgedAt).length;
      existing.openAlertCount += consults.filter((consult) => consult.status === "ACTIVE" && !consult.acknowledgedAt).length;

      workloadByName.set(key, existing);
    }

    const scoredRoster = activeRoster
      .map((staff) => {
        const workload = workloadByName.get(staff.name) ?? {
          assignedCount: 0,
          highAcuityCount: 0,
          blockedCount: 0,
          readyDischargeCount: 0,
          openAlertCount: 0,
        };

        const loadScore =
          (workload.assignedCount ?? 0) * 2 +
          (workload.highAcuityCount ?? 0) * 5 +
          (workload.blockedCount ?? 0) * 3 +
          (workload.openAlertCount ?? 0) * 2;

        return {
          ...staff,
          ...workload,
          loadScore,
        };
      })
      .sort((left, right) => left.loadScore - right.loadScore || left.role.localeCompare(right.role) || left.name.localeCompare(right.name));

    const pickByRoles = (roles: string[]) => scoredRoster.find((staff) => roles.includes(staff.role)) ?? scoredRoster[0] ?? null;

    return {
      flowOwner: pickByRoles(["NURSE", "CCMA", "UNIT_COORDINATOR", "RAD_TECH", "SCRUB_TECH"]),
      assignedProvider: pickByRoles(["DOCTOR", "SURGEON", "ANESTHESIOLOGIST", "PHARMACIST", "RESPIRATORY_THERAPIST"]),
    };
  },
});

export const activateProtocolBundle = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    protocolId: v.string(),
    protocolTitle: v.string(),
    activatedBy: v.string(),
    source: v.union(v.literal("patient_chart"), v.literal("training")),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const bundle = PROTOCOL_BUNDLES[args.protocolId] ?? { orders: [], tasks: [] };
    const now = Date.now();

    const activationId = await ctx.db.insert("protocolActivations", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      protocolId: args.protocolId,
      title: args.protocolTitle,
      activatedBy: args.activatedBy,
      status: "active",
      source: args.source,
      activatedAt: now,
    });

    for (const order of bundle.orders) {
      await ctx.db.insert("orders", {
        encounterId: args.encounterId,
        patientId: args.patientId,
        type: order.type,
        testName: order.testName,
        searchVector: `${order.testName} ${order.type}`.toLowerCase(),
        priority: order.priority,
        status: "PENDING",
        orderedAt: now,
      });
    }

    const existingChecklistRows = await ctx.db
      .query("checklists")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
    const existingTaskKeys = new Set(existingChecklistRows.map((row) => row.taskKey));

    for (const [index, task] of bundle.tasks.entries()) {
      const taskKey = `protocol:${args.protocolId}:${index}`;
      if (existingTaskKeys.has(taskKey)) continue;

      await ctx.db.insert("checklists", {
        encounterId: args.encounterId,
        taskKey,
        item: task,
        completed: false,
        category: "care",
      });
    }

    await ctx.db.insert("notes", {
      encounterId: args.encounterId,
      author: args.activatedBy,
      category: "Triage",
      content: `[PROTOCOL] ${args.protocolTitle} activated with ${bundle.orders.length} order${bundle.orders.length === 1 ? "" : "s"} and ${bundle.tasks.length} task${bundle.tasks.length === 1 ? "" : "s"}.`,
      isTemplate: false,
    });

    await ctx.db.patch(args.encounterId, {
      ...(bundle.flowStage ? { flowStage: bundle.flowStage, flowStageUpdatedAt: now } : {}),
      ...(bundle.delayReason ? { delayReason: bundle.delayReason } : {}),
    });

    return { activationId };
  },
});

export const getProtocolActivationsByEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("protocolActivations")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
  },
});

export const getTrainingAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const [activations, kioskIntakes, activeEncounters] = await Promise.all([
      ctx.db.query("protocolActivations").collect(),
      ctx.db.query("kioskIntakes").collect(),
      ctx.db
        .query("encounters")
        .withIndex("by_status")
        .filter((q) => q.neq(q.field("status"), "discharged"))
        .collect(),
    ]);

    const recentActivations = activations.filter((activation) => activation.activatedAt >= Date.now() - 7 * 24 * 60 * 60 * 1000);
    const protocolUsage = new Map<string, { title: string; count: number }>();

    for (const activation of recentActivations) {
      const current = protocolUsage.get(activation.protocolId) ?? { title: activation.title, count: 0 };
      current.count += 1;
      protocolUsage.set(activation.protocolId, current);
    }

    const kioskAckSamples = kioskIntakes
      .filter((row) => row.acknowledgedAt)
      .map((row) => Math.max(0, Math.round(((row.acknowledgedAt ?? 0) - row.checkedInAt) / 60000)));

    const avgKioskAckMinutes = kioskAckSamples.length === 0
      ? null
      : Math.round(kioskAckSamples.reduce((sum, value) => sum + value, 0) / kioskAckSamples.length);

    return {
      activeProtocolCount: recentActivations.length,
      urgentKioskCount: kioskIntakes.filter((row) => row.priority === "urgent" && row.status !== "roomed").length,
      avgKioskAckMinutes,
      activeEncounterCount: activeEncounters.length,
      mostUsedProtocols: Array.from(protocolUsage.values())
        .sort((left, right) => right.count - left.count)
        .slice(0, 4),
    };
  },
});

// ============================================================================
// SHIFT HANDOFF WORKFLOW
// ============================================================================

export const initiateShiftHandoff = mutation({
  args: {
    fromUserId: v.id("users"),
    fromUserName: v.string(),
    fromUserRole: v.string(),
    patientEncounterIds: v.array(v.id("encounters")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Create shift handoff record
    const now = Date.now();
    const handoffId = await ctx.db.insert("shiftHandoffs", {
      fromUserId: args.fromUserId,
      fromUserName: args.fromUserName,
      fromUserRole: args.fromUserRole,
      toUserId: undefined,
      toUserName: undefined,
      toUserRole: undefined,
      status: "initiated",
      patientCount: args.patientEncounterIds.length,
      patientEncounterIds: args.patientEncounterIds,
      initiatedAt: now,
      expiresAt: now + 15 * 60 * 1000, // 15 minute acceptance window
      notes: args.notes,
    });

    // Create handoff sessions for each encounter
    for (const encounterId of args.patientEncounterIds) {
      const encounter = await ctx.db.get(encounterId);
      if (!encounter) continue;

      // Count key alerts
      const [labs, imaging] = await Promise.all([
        ctx.db
          .query("labs")
          .withIndex("by_encounter", (q) => q.eq("encounterId", encounterId))
          .collect(),
        ctx.db
          .query("imagingOrders")
          .withIndex("by_encounter", (q) => q.eq("encounterId", encounterId))
          .filter((q) => q.neq(q.field("status"), "Resulted"))
          .collect(),
      ]);

      const keyAlertsCount = labs.length + imaging.length;

      await ctx.db.insert("handoffSessions", {
        handoffId,
        encounterId,
        status: "pending",
        patientName: encounter.patientName || "Unknown",
        chiefComplaint: encounter.chiefComplaint || "N/A",
        acuity: encounter.acuity || 3,
        currentLocation: encounter.location,
        keyAlertsCount,
        pendingActionsCount: 0,
        acknowledgedAt: undefined,
        acceptedAt: undefined,
      });
    }

    // Create initial audit log
    await ctx.db.insert("handoffAuditLogs", {
      handoffId,
      encounterId: undefined,
      action: "handoff_initiated",
      actorUserId: args.fromUserId,
      actorUserName: args.fromUserName,
      actorUserRole: args.fromUserRole,
      details: `Handoff initiated with ${args.patientEncounterIds.length} patients`,
      timestamp: now,
    });

    return handoffId;
  },
});

export const getPendingHandoffs = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const handoffs = await ctx.db
      .query("shiftHandoffs")
      .withIndex("by_to_user_status", (q) => q.eq("toUserId", args.userId).eq("status", "initiated"))
      .collect();

    // Map to include session details
    const enrichedHandoffs = await Promise.all(
      handoffs.map(async (handoff) => {
        const sessions = await ctx.db
          .query("handoffSessions")
          .withIndex("by_handoff", (q) => q.eq("handoffId", handoff._id))
          .collect();

        return {
          ...handoff,
          sessions,
          isExpired: now > handoff.expiresAt,
          timeRemaining: Math.max(0, handoff.expiresAt - now),
        };
      })
    );

    return enrichedHandoffs.sort((a, b) => b.initiatedAt - a.initiatedAt);
  },
});

export const getHandoffDetails = query({
  args: { handoffId: v.id("shiftHandoffs") },
  handler: async (ctx, args) => {
    const handoff = await ctx.db.get(args.handoffId);
    if (!handoff) return null;

    const sessions = await ctx.db
      .query("handoffSessions")
      .withIndex("by_handoff", (q) => q.eq("handoffId", args.handoffId))
      .collect();

    const auditLogs = await ctx.db
      .query("handoffAuditLogs")
      .withIndex("by_handoff_timestamp", (q) => q.eq("handoffId", args.handoffId))
      .collect();

    return {
      ...handoff,
      sessions: sessions.sort((a, b) => a.acuity - b.acuity),
      auditLogs: auditLogs.sort((a, b) => b.timestamp - a.timestamp),
      isExpired: Date.now() > handoff.expiresAt,
      timeRemaining: Math.max(0, handoff.expiresAt - Date.now()),
    };
  },
});

export const acceptHandoff = mutation({
  args: {
    handoffId: v.id("shiftHandoffs"),
    toUserId: v.id("users"),
    toUserName: v.string(),
    toUserRole: v.string(),
    signInNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const handoff = await ctx.db.get(args.handoffId);
    if (!handoff) throw new Error("Handoff not found");

    const now = Date.now();
    if (now > handoff.expiresAt) throw new Error("Handoff expired");

    // Update handoff record
    await ctx.db.patch(args.handoffId, {
      toUserId: args.toUserId,
      toUserName: args.toUserName,
      toUserRole: args.toUserRole,
      status: "accepted",
      acceptedAt: now,
      completedAt: now,
    });

    // Update all sessions to accepted
    const sessions = await ctx.db
      .query("handoffSessions")
      .withIndex("by_handoff", (q) => q.eq("handoffId", args.handoffId))
      .collect();

    for (const session of sessions) {
      await ctx.db.patch(session._id, {
        status: "accepted",
        acceptedAt: now,
        signInNotes: args.signInNotes,
      });

      // Log acceptance for audit trail
      await ctx.db.insert("handoffAuditLogs", {
        handoffId: args.handoffId,
        encounterId: session.encounterId,
        action: "encounter_accepted",
        actorUserId: args.toUserId,
        actorUserName: args.toUserName,
        actorUserRole: args.toUserRole,
        details: session.patientName,
        timestamp: now,
      });
    }

    // Log handoff acceptance
    await ctx.db.insert("handoffAuditLogs", {
      handoffId: args.handoffId,
      encounterId: undefined,
      action: "handoff_accepted",
      actorUserId: args.toUserId,
      actorUserName: args.toUserName,
      actorUserRole: args.toUserRole,
      details: `Accepted ${sessions.length} patients`,
      timestamp: now,
    });

    return args.handoffId;
  },
});

export const rejectHandoff = mutation({
  args: {
    handoffId: v.id("shiftHandoffs"),
    toUserId: v.id("users"),
    toUserName: v.string(),
    toUserRole: v.string(),
    rejectionReason: v.string(),
  },
  handler: async (ctx, args) => {
    const handoff = await ctx.db.get(args.handoffId);
    if (!handoff) throw new Error("Handoff not found");

    const now = Date.now();

    // Update handoff record
    await ctx.db.patch(args.handoffId, {
      status: "rejected",
      rejectedAt: now,
      rejectionReason: args.rejectionReason,
    });

    // Update all sessions to rejected
    const sessions = await ctx.db
      .query("handoffSessions")
      .withIndex("by_handoff", (q) => q.eq("handoffId", args.handoffId))
      .collect();

    for (const session of sessions) {
      await ctx.db.patch(session._id, {
        status: "rejected",
        rejectionReason: args.rejectionReason,
      });
    }

    // Log rejection
    await ctx.db.insert("handoffAuditLogs", {
      handoffId: args.handoffId,
      encounterId: undefined,
      action: "handoff_rejected",
      actorUserId: args.toUserId,
      actorUserName: args.toUserName,
      actorUserRole: args.toUserRole,
      details: args.rejectionReason,
      timestamp: now,
    });

    return args.handoffId;
  },
});

export const getHandoffHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;

    const [given, received] = await Promise.all([
      ctx.db
        .query("shiftHandoffs")
        .withIndex("by_from_user_status", (q) => q.eq("fromUserId", args.userId))
        .filter((q) => q.gte(q.field("initiatedAt"), last24Hours))
        .collect(),
      ctx.db
        .query("shiftHandoffs")
        .withIndex("by_to_user_status", (q) => q.eq("toUserId", args.userId))
        .filter((q) => q.gte(q.field("initiatedAt"), last24Hours))
        .collect(),
    ]);

    return {
      given: given.sort((a, b) => b.initiatedAt - a.initiatedAt),
      received: received.sort((a, b) => b.initiatedAt - a.initiatedAt),
    };
  },
});

// ============================================================================
// SPECIALIST/ROLE-BASED ASSIGNMENT MATCHING
// ============================================================================

export const getSpecialistMatches = query({
  args: { encounterId: v.id("encounters"), requiredSpecialties: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) return [];

    const specialists = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "SURGEON"))
      .collect();

    let matches = specialists;

    // Filter by required specialties if provided
    if (args.requiredSpecialties && args.requiredSpecialties.length > 0) {
      matches = matches.filter((user) => {
        const userSpecs = user.specialties || [];
        return args.requiredSpecialties!.some((spec) => userSpecs.includes(spec));
      });
    }

    // Score each match by workload and preference
    const scoredMatches = await Promise.all(
      matches.map(async (specialist) => {
        const workload = await ctx.db
          .query("encounters")
          .filter((q) => q.eq(q.field("assignedProvider"), specialist.name))
          .filter((q) => q.neq(q.field("status"), "discharged"))
          .collect();

        const acuity = encounter.acuity ?? 3;
        const acuityMultiplier = acuity <= 2 ? 5 : acuity <= 3 ? 2 : 1;

        // Calculate workload score
        let workloadScore = 0;
        for (const enc of workload) {
          const encAcuity = enc.acuity ?? 3;
          workloadScore += encAcuity <= 2 ? 5 : encAcuity <= 3 ? 2 : 1;
        }

        // Get preference score
        const preferences = await ctx.db
          .query("providerPreferences")
          .withIndex("by_provider_category", (q) =>
            q.eq("providerId", specialist._id).eq("prefCategory", "chief_complaint")
          )
          .collect();

        const matchingPref = preferences.find((p) => p.prefValue === encounter.chiefComplaint);
        const preferenceBonus = matchingPref && matchingPref.preference > 0 ? matchingPref.successRate * 100 : 0;

        return {
          ...specialist,
          specialistScore: 1000 - workloadScore + preferenceBonus,
          currentLoad: workload.length,
          acuityWeightedLoad: workloadScore,
          hasRelevantSpecialty: !!matchingPref,
        };
      })
    );

    return scoredMatches.sort((a, b) => b.specialistScore - a.specialistScore);
  },
});

// ============================================================================
// STANDING ORDER AUTOMATION
// ============================================================================

export const autoPlaceStandingOrders = mutation({
  args: {
    encounterId: v.id("encounters"),
    chiefComplaint: v.string(),
    diagnosis: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const now = Date.now();
    const ordersToPlace = [];

    // Match protocol bundles
    const matchedProtocol = Object.entries(PROTOCOL_BUNDLES).find(([, bundle]) => {
      // Simple matching - in production this would be more sophisticated
      return args.chiefComplaint.toLowerCase().includes("stroke") && bundle === PROTOCOL_BUNDLES["stroke-alert"];
    });

    if (matchedProtocol) {
      const [protocolId, bundle] = matchedProtocol;

      for (const order of bundle.orders) {
        const orderId = await ctx.db.insert("standingOrders", {
          encounterId: args.encounterId,
          protocolId,
          orderType: order.type as "LAB" | "IMAGING" | "MEDICATION" | "PROCEDURE",
          orderName: order.testName,
          status: "pending",
          trigger: "diagnosis",
          triggerValue: args.diagnosis,
          autoPlaced: true,
          createdAt: now,
        });
        ordersToPlace.push(orderId);
      }
    }

    // Rule-based orders by chief complaint
    const complaintBasedOrders = getComplaintBasedOrders(args.chiefComplaint);
    for (const [orderName, orderType] of complaintBasedOrders) {
      const orderId = await ctx.db.insert("standingOrders", {
        encounterId: args.encounterId,
        orderType: orderType as "LAB" | "IMAGING",
        orderName,
        status: "pending",
        trigger: "chief_complaint",
        triggerValue: args.chiefComplaint,
        autoPlaced: true,
        createdAt: now,
      });
      ordersToPlace.push(orderId);
    }

    return { placedOrderIds: ordersToPlace, count: ordersToPlace.length };
  },
});

const getComplaintBasedOrders = (complaint: string): Array<[string, string]> => {
  const lc = complaint.toLowerCase();
  const orders: Array<[string, string]> = [];

  if (lc.includes("chest") || lc.includes("cardiac")) {
    orders.push(["Troponin", "LAB"], ["ECG", "IMAGING"], ["BMP", "LAB"]);
  } else if (lc.includes("abdom") || lc.includes("belly")) {
    orders.push(["CBC", "LAB"], ["CMP", "LAB"], ["Lipase", "LAB"], ["CT Abdomen", "IMAGING"]);
  } else if (lc.includes("head") || lc.includes("neuro")) {
    orders.push(["CT Head", "IMAGING"], ["CBC", "LAB"]);
  } else if (lc.includes("sepsis") || lc.includes("fever")) {
    orders.push(["CBC", "LAB"], ["Blood Cultures", "LAB"], ["Lactate", "LAB"]);
  }

  return orders;
};

export const markStandingOrderComplete = mutation({
  args: { standingOrderId: v.id("standingOrders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.standingOrderId);
    if (!order) throw new Error("Standing order not found");

    await ctx.db.patch(args.standingOrderId, {
      status: "completed",
      completedAt: Date.now(),
    });

    return args.standingOrderId;
  },
});

// ============================================================================
// TRIAGE REASSESSMENT & MULTI-PHASE LOGIC
// ============================================================================

export const reassessTriage = mutation({
  args: {
    encounterId: v.id("encounters"),
    newAcuity: v.number(),
    reassessmentPhase: v.number(),
    presentationChanges: v.optional(v.array(v.string())),
    reassessedBy: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const previousAcuity = encounter.acuity || 3;
    const acuityChanged = previousAcuity !== args.newAcuity;

    const reassessmentId = await ctx.db.insert("triageReassessments", {
      encounterId: args.encounterId,
      patientId: encounter.patientId,
      reassessmentPhase: args.reassessmentPhase,
      previousAcuity,
      currentAcuity: args.newAcuity,
      acuityChanged,
      presentationChanges: args.presentationChanges,
      reassessedBy: args.reassessedBy,
      assessmentNotes: args.notes,
      reassessedAt: Date.now(),
    });

    // If acuity changed, trigger re-recommendation
    if (acuityChanged) {
      await ctx.db.patch(args.encounterId, {
        acuity: args.newAcuity,
      });
    }

    return reassessmentId;
  },
});

export const getTriageReassessmentHistory = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("triageReassessments")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
  },
});

// ============================================================================
// REAL-TIME METRICS DASHBOARD
// ============================================================================

export const updateEdMetrics = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const activeEncounters = await ctx.db
      .query("encounters")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "discharged"))
      .collect();

    const waitingInTriage = activeEncounters.filter((e) => e.flowStage === "triage").length;
    const bedded = activeEncounters.filter((e) => e.flowStage === "bedded").length;
    const dischargeReady = activeEncounters.filter((e) => e.flowStage === "discharge_ready").length;
    const admitReady = activeEncounters.filter((e) => e.flowStage === "admit_ready").length;

    // Calculate average times
    const triageTimeSamples = activeEncounters
      .filter((e) => e.bedAssignedAt && e.flowStageUpdatedAt)
      .map((e) => ((e.bedAssignedAt ?? now) - e.flowStageUpdatedAt!) / 60000);

    const avgTimeInTriageMinutes = triageTimeSamples.length ? Math.round(triageTimeSamples.reduce((a, b) => a + b, 0) / triageTimeSamples.length) : 0;

    // Get recent admissions/discharges
    const recentDischarges = await ctx.db
      .query("encounters")
      .filter((q) => q.gte(q.field("dischargedAt"), oneHourAgo))
      .collect();

    const highAcuityCount = activeEncounters.filter((e) => (e.acuity ?? 5) <= 2).length;

    // Get or update singleton metrics record
    const existing = await ctx.db
      .query("edMetrics")
      .withIndex("by_singleton", (q) => q.eq("singletonKey", "current"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        timestamp: now,
        activePatientCount: activeEncounters.length,
        waitingInTriageCount: waitingInTriage,
        beddedCount: bedded,
        dischargeReadyCount: dischargeReady,
        admitReadyCount: admitReady,
        avgTimeInTriageMinutes,
        bedsOccupied: bedded,
        bedUtilizationPercent: Math.round((bedded / 30) * 100),
        averageProviderLoad: activeEncounters.length > 0 ? (activeEncounters.length / 10) : 0,
        highAcuityPatientCount: highAcuityCount,
        dischargesLastHour: recentDischarges.length,
        lastUpdateMs: now,
      });
      return existing._id;
    }

    // Create new metrics record
    const metricsId = await ctx.db.insert("edMetrics", {
      singletonKey: "current",
      timestamp: now,
      activePatientCount: activeEncounters.length,
      waitingInTriageCount: waitingInTriage,
      beddedCount: bedded,
      dischargeReadyCount: dischargeReady,
      admitReadyCount: admitReady,
      avgTimeInTriageMinutes,
      avgTimeFromArrivalToBedroomMinutes: 0,
      avgTimeFromArrivalToProviderMinutes: 0,
      bedsOccupied: bedded,
      bedsTotalAvailable: 30,
      bedUtilizationPercent: Math.round((bedded / 30) * 100),
      averageProviderLoad: activeEncounters.length > 0 ? (activeEncounters.length / 10) : 0,
      highAcuityPatientCount: highAcuityCount,
      criticalAlertsOpen: 0,
      dischargesLastHour: recentDischarges.length,
      admitsLastHour: 0,
      lastUpdateMs: now,
    });

    return metricsId;
  },
});

export const getEdMetrics = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("edMetrics")
      .withIndex("by_singleton", (q) => q.eq("singletonKey", "current"))
      .first();
  },
});

// ============================================================================
// PROVIDER PREFERENCE LEARNING
// ============================================================================

export const updateProviderPreference = mutation({
  args: {
    providerId: v.id("users"),
    category: v.union(
      v.literal("patient_type"),
      v.literal("chief_complaint"),
      v.literal("acuity_level"),
      v.literal("procedure"),
      v.literal("specialty"),
      v.literal("age_group")
    ),
    value: v.string(),
    successIndicator: v.boolean(),
  },
  handler: async (ctx, args) => {
    let prefs = await ctx.db
      .query("providerPreferences")
      .withIndex("by_provider_category", (q) =>
        q.eq("providerId", args.providerId).eq("prefCategory", args.category)
      )
      .filter((q) => q.eq(q.field("prefValue"), args.value))
      .first();

    if (!prefs) {
      // Create new preference entry
      const prefId = await ctx.db.insert("providerPreferences", {
        providerId: args.providerId,
        prefCategory: args.category,
        prefValue: args.value,
        preference: args.successIndicator ? 1 : -1,
        matchCount: 1,
        successRate: args.successIndicator ? 1 : 0,
        lastUpdatedAt: Date.now(),
      });
      return prefId;
    }

    // Update existing preference
    const newMatchCount = (prefs.matchCount || 0) + 1;
    const newSuccessCount = prefs.successRate * prefs.matchCount + (args.successIndicator ? 1 : 0);
    const newSuccessRate = newSuccessCount / newMatchCount;

    await ctx.db.patch(prefs._id, {
      matchCount: newMatchCount,
      successRate: newSuccessRate,
      preference: newSuccessRate > 0.6 ? 1 : newSuccessRate < 0.4 ? -1 : 0,
      lastUpdatedAt: Date.now(),
    });

    return prefs._id;
  },
});

export const recordAssignmentOutcome = mutation({
  args: {
    encounterId: v.id("encounters"),
    providerId: v.id("users"),
    patientChiefComplaint: v.string(),
    patientAcuity: v.number(),
    outcomeScore: v.optional(v.number()), // 1-5
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const historyId = await ctx.db.insert("assignmentHistory", {
      encounterId: args.encounterId,
      providerId: args.providerId,
      assignmentReason: "assignment",
      assignedAt: Date.now(),
      patientChiefComplaint: args.patientChiefComplaint,
      patientAcuity: args.patientAcuity,
      outcomeScore: args.outcomeScore,
    });

    // Update provider preference based on chief complaint
    await ctx.db.insert("providerPreferences", {
      providerId: args.providerId,
      prefCategory: "chief_complaint",
      prefValue: args.patientChiefComplaint,
      preference: args.outcomeScore && args.outcomeScore >= 4 ? 1 : args.outcomeScore && args.outcomeScore <= 2 ? -1 : 0,
      matchCount: 1,
      successRate: args.outcomeScore ? args.outcomeScore / 5 : 0.5,
      lastUpdatedAt: Date.now(),
    });

    return historyId;
  },
});

// ============================================================================
// PREDICTIVE BED REUSE
// ============================================================================

export const predictBedAvailability = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const beddedEncounters = await ctx.db
      .query("encounters")
      .withIndex("by_status")
      .filter((q) => q.eq(q.field("status"), "treating"))
      .collect();

    const predictions = await Promise.all(
      beddedEncounters.map(async (enc) => {
        // Look at historical turnovers for similar acuity
        const history = await ctx.db
          .query("bedTurnoverHistory")
          .withIndex("by_bed_discharge", (q) => q.eq("bedLabel", enc.location || "unknown"))
          .collect();

        const avgTurnoverMs = history.length
          ? history.reduce((sum, h) => sum + h.turnoverTimeMs, 0) / history.length
          : 20 * 60 * 1000; // 20 min default

        // Estimate discharge time based on flowStage and acuity
        let estimatedLosMs = 120 * 60 * 1000; // 2hr default
        if (enc.flowStage === "discharge_ready") {
          estimatedLosMs = 15 * 60 * 1000; // 15 min
        }

        const predictedAvailableAt = now + estimatedLosMs + avgTurnoverMs;
        const confidence = Math.min(0.9, 0.5 + history.length * 0.05); // Higher confidence with more history

        return {
          bedLabel: enc.location || "unknown",
          predictedAvailableAt,
          predictionConfidence: confidence,
          currentOccupantEncounterId: enc._id,
          currentOccupantAcuity: enc.acuity,
          estimatedDischargeTimeMs: estimatedLosMs,
          historyBasedAvgTurnaroundMs: avgTurnoverMs,
          lastUpdatedAt: now,
        };
      })
    );

    return predictions.sort((a, b) => a.predictedAvailableAt - b.predictedAvailableAt);
  },
});

export const recordBedTurnover = mutation({
  args: {
    bedLabel: v.string(),
    previousEncounterId: v.id("encounters"),
    previousDischargeAt: v.number(),
    nextEncounterId: v.id("encounters"),
    nextAdmitAt: v.number(),
    turnoverStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const turnoverTimeMs = args.nextAdmitAt - args.previousDischargeAt;

    const turnoverHistoryId = await ctx.db.insert("bedTurnoverHistory", {
      bedLabel: args.bedLabel,
      previousEncounterId: args.previousEncounterId,
      previousDischargeAt: args.previousDischargeAt,
      nextEncounterId: args.nextEncounterId,
      nextAdmitAt: args.nextAdmitAt,
      turnoverTimeMs,
      turnoverStatus: args.turnoverStatus as any,
    });

    return turnoverHistoryId;
  },
});