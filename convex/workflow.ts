import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
      kind: "lab" | "imaging" | "consult";
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

      buckets.set(key, existing);
    }

    return Array.from(buckets.values()).sort((left, right) => {
      if (right.highAcuityCount !== left.highAcuityCount) return right.highAcuityCount - left.highAcuityCount;
      if (right.openAlertCount !== left.openAlertCount) return right.openAlertCount - left.openAlertCount;
      return right.assignedCount - left.assignedCount;
    });
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