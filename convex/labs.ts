import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

const CRITICAL_ESCALATION_MS = 10 * 60 * 1000;
type EscalationRole = "NURSE" | "DOCTOR" | "ADMIN";

function getEscalationRole(escalationCount: number): EscalationRole {
  if (escalationCount <= 1) return "NURSE";
  if (escalationCount === 2) return "DOCTOR";
  return "ADMIN";
}

async function findEscalationRecipient(ctx: MutationCtx, role: EscalationRole) {
  const candidates = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", role))
    .collect();

  return candidates.find((user) => user.status === "ACTIVE") ?? null;
}

function isOpenCriticalForDisplay(lab: {
  isAbnormal: boolean;
  status: "pending" | "final";
  criticalStatus?: "new" | "acknowledged" | "escalated" | "resolved";
  acknowledgedAt?: number;
}) {
  if (!lab.isAbnormal || lab.status !== "final") return false;
  if (lab.criticalStatus === "resolved") return false;
  return true;
}

function shouldEscalateCritical(lab: {
  isAbnormal: boolean;
  status: "pending" | "final";
  criticalStatus?: "new" | "acknowledged" | "escalated" | "resolved";
  acknowledgedAt?: number;
}) {
  if (!isOpenCriticalForDisplay(lab)) return false;
  if (lab.criticalStatus === "acknowledged") return false;
  if (!lab.criticalStatus && lab.acknowledgedAt) return false;
  return true;
}

async function escalateCriticalLabs(
  ctx: MutationCtx,
  encounterId?: string
) {
  const now = Date.now();
  const allLabs = await ctx.db.query("labResults").collect();
  const dueLabs = allLabs.filter((lab: Doc<"labResults">) => {
    if (!shouldEscalateCritical(lab)) return false;
    if (encounterId && lab.encounterId !== encounterId) return false;
    const dueAt = lab.criticalEscalationDueAt ?? (lab.criticalRaisedAt ? lab.criticalRaisedAt + CRITICAL_ESCALATION_MS : undefined);
    return typeof dueAt === "number" && dueAt <= now;
  });

  if (dueLabs.length === 0) {
    return { escalatedCount: 0 };
  }

  await Promise.all(
    dueLabs.map(async (lab: Doc<"labResults">) => {
      const escalationCount = (lab.criticalEscalationCount ?? 0) + 1;
      const escalationRole = getEscalationRole(escalationCount);
      const recipient = await findEscalationRecipient(ctx, escalationRole);

      await ctx.db.patch(lab._id, {
        criticalStatus: "escalated",
        criticalEscalatedAt: now,
        criticalEscalationCount: escalationCount,
        criticalEscalatedRole: escalationRole,
        criticalEscalationDueAt: now + CRITICAL_ESCALATION_MS,
      });

      const encounter = await ctx.db.get(lab.encounterId);
      const patientId = encounter?.patientId;

      await ctx.db.insert("notifications", {
        userId: recipient?._id,
        title: "Critical Lab Escalated",
        message: `${lab.testName} remains unacknowledged and has been escalated to ${escalationRole} (${escalationCount}).`,
        type: "CRITICAL_LAB",
        isRead: false,
        timestamp: now,
        patientId,
      });
    })
  );

  return { escalatedCount: dueLabs.length };
}

export const postResult = mutation({
  args: {
    encounterId: v.id("encounters"),
    testName: v.string(),
    value: v.string(),
    unit: v.string(),
    range: v.string(),
    isAbnormal: v.boolean(),
    status: v.union(v.literal("pending"), v.literal("final")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const isCritical = args.isAbnormal && args.status === "final";

    const id = await ctx.db.insert("labResults", {
      ...args,
      criticalStatus: isCritical ? "new" : undefined,
      criticalRaisedAt: isCritical ? now : undefined,
      criticalEscalationDueAt: isCritical ? now + CRITICAL_ESCALATION_MS : undefined,
      criticalEscalationCount: isCritical ? 0 : undefined,
    });

    if (isCritical) {
      const encounter = await ctx.db.get(args.encounterId);
      const recipient = await findEscalationRecipient(ctx, "NURSE");
      await ctx.db.insert("notifications", {
        userId: recipient?._id,
        title: "Critical Lab Result",
        message: `${args.testName} is critical and requires acknowledgement within 10 minutes. Routed to NURSE on duty.`,
        type: "CRITICAL_LAB",
        isRead: false,
        timestamp: now,
        patientId: encounter?.patientId,
      });
    }

    return id;
  },
});

export const getByEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("labResults")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
  },
});

export const getCriticalAlerts = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const labs = await ctx.db
      .query("labResults")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    return labs
      .filter((lab) => isOpenCriticalForDisplay(lab))
      .sort((a, b) => {
        const aDue = a.criticalEscalationDueAt ?? Number.MAX_SAFE_INTEGER;
        const bDue = b.criticalEscalationDueAt ?? Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      });
  },
});

export const getCriticalWorkflowMetrics = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const labs = await ctx.db
      .query("labResults")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const openCriticals = labs.filter((lab) => isOpenCriticalForDisplay(lab));
    const overdueCriticals = openCriticals.filter((lab) => {
      if (lab.criticalStatus === "acknowledged") return false;
      const dueAt = lab.criticalEscalationDueAt ?? (lab.criticalRaisedAt ? lab.criticalRaisedAt + CRITICAL_ESCALATION_MS : undefined);
      return typeof dueAt === "number" && dueAt <= now;
    });

    const resolvedCount = labs.filter((lab) => lab.criticalStatus === "resolved").length;
    const escalatedCount = openCriticals.filter((lab) => lab.criticalStatus === "escalated").length;

    const ackDurationsMinutes = labs
      .filter((lab) => typeof lab.criticalRaisedAt === "number" && typeof lab.acknowledgedAt === "number")
      .map((lab) => Math.max(0, Math.floor(((lab.acknowledgedAt as number) - (lab.criticalRaisedAt as number)) / 60_000)))
      .sort((a, b) => a - b);

    const medianAckMinutes =
      ackDurationsMinutes.length === 0
        ? null
        : ackDurationsMinutes[Math.floor(ackDurationsMinutes.length / 2)];

    return {
      openCount: openCriticals.length,
      overdueCount: overdueCriticals.length,
      escalatedCount,
      resolvedCount,
      medianAckMinutes,
    };
  },
});


export const acknowledgeLab = mutation({
  args: { 
    labId: v.id("labResults"), 
    staffName: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lab = await ctx.db.get(args.labId);
    if (!lab) throw new Error("Lab result not found");

    const now = Date.now();
    await ctx.db.patch(args.labId, {
      criticalStatus: "acknowledged",
      acknowledgedBy: args.staffName,
      acknowledgedAt: now,
      criticalAcknowledgementNote: args.note,
    });

    const encounter = await ctx.db.get(lab.encounterId);
    await ctx.db.insert("notifications", {
      userId: undefined,
      title: "Critical Lab Acknowledged",
      message: `${lab.testName} acknowledged by ${args.staffName}.`,
      type: "CRITICAL_LAB",
      isRead: false,
      timestamp: now,
      patientId: encounter?.patientId,
    });
  },
});

export const resolveCriticalLab = mutation({
  args: {
    labId: v.id("labResults"),
    staffName: v.string(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const lab = await ctx.db.get(args.labId);
    if (!lab) throw new Error("Lab result not found");

    const note = args.note.trim();
    if (!note) throw new Error("Resolution note is required");

    const now = Date.now();
    await ctx.db.patch(args.labId, {
      criticalStatus: "resolved",
      criticalResolvedAt: now,
      acknowledgedBy: lab.acknowledgedBy ?? args.staffName,
      acknowledgedAt: lab.acknowledgedAt ?? now,
      criticalAcknowledgementNote: note,
    });

    const encounter = await ctx.db.get(lab.encounterId);
    await ctx.db.insert("notifications", {
      userId: undefined,
      title: "Critical Lab Resolved",
      message: `${lab.testName} resolved by ${args.staffName}.`,
      type: "CRITICAL_LAB",
      isRead: false,
      timestamp: now,
      patientId: encounter?.patientId,
    });
  },
});

export const runEscalationSweep = mutation({
  args: {
    encounterId: v.optional(v.id("encounters")),
  },
  handler: async (ctx, args) => {
    return escalateCriticalLabs(ctx, args.encounterId);
  },
});

export const runCriticalLabEscalations = internalMutation({
  args: {},
  handler: async (ctx) => {
    return escalateCriticalLabs(ctx);
  },
});

export const getPendingCount = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const pendingLabs = await ctx.db
      .query("labResults")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    return pendingLabs.length;
  },
});

// Define a clear interface for the lab result
interface LabResult {
  _id: string;
  _creationTime: number;
  testName: string;
  value: string;
  unit: string;
  status: string;
}

export const getLabTrends = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const allLabs = await ctx.db
      .query("labResults")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    // Cast as LabResult to avoid 'any'
    const results = allLabs as LabResult[];

    const groups: Record<string, LabResult[]> = {};
    results.forEach(lab => {
      if (!groups[lab.testName]) groups[lab.testName] = [];
      groups[lab.testName].push(lab);
    });

    return Object.entries(groups).map(([name, history]) => ({
      testName: name,
      history: history.sort((a, b) => b._creationTime - a._creationTime).slice(0, 3)
    }));
  },
});