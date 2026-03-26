import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

type CaseStatus = "SCHEDULED" | "IN_ROOM" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

function isActiveStatus(status: CaseStatus) {
  return status === "SCHEDULED" || status === "IN_ROOM" || status === "IN_PROGRESS";
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

async function getNearbyCandidates(
  ctx: MutationCtx,
  scheduledStart: number,
  scheduledEnd: number
): Promise<Doc<"orCases">[]> {
  const windowStart = scheduledStart - 12 * 60 * 60 * 1000;
  const windowEnd = scheduledEnd + 12 * 60 * 60 * 1000;
  return await ctx.db
    .query("orCases")
    .withIndex("by_scheduled_start", (q) => q.gte("scheduledStart", windowStart))
    .filter((q) => q.lt(q.field("scheduledStart"), windowEnd))
    .collect();
}

function validateConflicts(
  candidates: Doc<"orCases">[],
  args: {
    room: string;
    surgeon: string;
    scheduledStart: number;
    scheduledEnd: number;
  },
  ignoreCaseId?: string
) {
  const roomConflict = candidates.find(
    (entry) =>
      (!ignoreCaseId || String(entry._id) !== ignoreCaseId) &&
      isActiveStatus(entry.status as CaseStatus) &&
      entry.room.trim().toLowerCase() === args.room.trim().toLowerCase() &&
      overlaps(args.scheduledStart, args.scheduledEnd, entry.scheduledStart, entry.scheduledEnd)
  );
  if (roomConflict) {
    throw new Error(`Room conflict with ${roomConflict.patientName} (${roomConflict.procedure}) in ${roomConflict.room}.`);
  }

  const surgeonConflict = candidates.find(
    (entry) =>
      (!ignoreCaseId || String(entry._id) !== ignoreCaseId) &&
      isActiveStatus(entry.status as CaseStatus) &&
      entry.surgeon.trim().toLowerCase() === args.surgeon.trim().toLowerCase() &&
      overlaps(args.scheduledStart, args.scheduledEnd, entry.scheduledStart, entry.scheduledEnd)
  );
  if (surgeonConflict) {
    throw new Error(`Surgeon conflict with ${surgeonConflict.patientName} (${surgeonConflict.procedure}) assigned to ${surgeonConflict.room}.`);
  }
}

export const getByWindow = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.endMs <= args.startMs) {
      throw new Error("Invalid date window.");
    }

    const all = await ctx.db
      .query("orCases")
      .withIndex("by_scheduled_start", (q) => q.gte("scheduledStart", args.startMs))
      .filter((q) => q.lt(q.field("scheduledStart"), args.endMs))
      .collect();

    return all.sort((a, b) => a.scheduledStart - b.scheduledStart);
  },
});

export const createCase = mutation({
  args: {
    patientName: v.string(),
    procedure: v.string(),
    surgeon: v.string(),
    anesthesia: v.string(),
    room: v.string(),
    scheduledStart: v.number(),
    scheduledEnd: v.number(),
    priority: v.union(v.literal("ELECTIVE"), v.literal("URGENT"), v.literal("EMERGENT")),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.scheduledEnd <= args.scheduledStart) {
      throw new Error("End time must be after start time.");
    }

    const candidates = await getNearbyCandidates(ctx, args.scheduledStart, args.scheduledEnd);
    validateConflicts(candidates, args);

    const now = Date.now();
    return await ctx.db.insert("orCases", {
      ...args,
      notes: args.notes?.trim() || undefined,
      status: "SCHEDULED",
      createdAt: now,
      updatedAt: now,
      statusUpdatedAt: now,
      statusUpdatedBy: args.createdBy,
      statusHistory: [{ status: "SCHEDULED", at: now, by: args.createdBy }],
    });
  },
});

export const updateCaseDetails = mutation({
  args: {
    caseId: v.id("orCases"),
    patientName: v.string(),
    procedure: v.string(),
    surgeon: v.string(),
    anesthesia: v.string(),
    room: v.string(),
    scheduledStart: v.number(),
    scheduledEnd: v.number(),
    priority: v.union(v.literal("ELECTIVE"), v.literal("URGENT"), v.literal("EMERGENT")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.caseId);
    if (!existing) throw new Error("OR case not found.");
    if (args.scheduledEnd <= args.scheduledStart) {
      throw new Error("End time must be after start time.");
    }

    const candidates = await getNearbyCandidates(ctx, args.scheduledStart, args.scheduledEnd);
    validateConflicts(candidates, args, String(args.caseId));

    await ctx.db.patch(args.caseId, {
      patientName: args.patientName.trim(),
      procedure: args.procedure.trim(),
      surgeon: args.surgeon.trim(),
      anesthesia: args.anesthesia.trim() || "General",
      room: args.room.trim() || "OR-1",
      scheduledStart: args.scheduledStart,
      scheduledEnd: args.scheduledEnd,
      priority: args.priority,
      notes: args.notes?.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    caseId: v.id("orCases"),
    actorName: v.optional(v.string()),
    status: v.union(
      v.literal("SCHEDULED"),
      v.literal("IN_ROOM"),
      v.literal("IN_PROGRESS"),
      v.literal("COMPLETED"),
      v.literal("CANCELLED")
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.caseId);
    if (!existing) throw new Error("OR case not found.");

    const now = Date.now();
    const priorHistory = existing.statusHistory ?? [];
    const statusChanged = existing.status !== args.status;
    const nextHistory = statusChanged
      ? [...priorHistory, { status: args.status, at: now, by: args.actorName }]
      : priorHistory;

    await ctx.db.patch(args.caseId, {
      status: args.status,
      updatedAt: now,
      statusUpdatedAt: statusChanged ? now : existing.statusUpdatedAt,
      statusUpdatedBy: statusChanged ? args.actorName : existing.statusUpdatedBy,
      statusHistory: nextHistory,
    });
  },
});

export const removeCase = mutation({
  args: {
    caseId: v.id("orCases"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.caseId);
    if (!existing) throw new Error("OR case not found.");
    await ctx.db.delete(args.caseId);
  },
});
