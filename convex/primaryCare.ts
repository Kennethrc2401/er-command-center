import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { mustBeDoctor, mustBeAdmin, mustBeStaffOrDoctor, mustBeClinicAdmin } from "./auth";
import { findConflict } from "./primaryCareHelpers";

type PmStatus = "scheduled" | "arrived" | "checked_in" | "seen" | "completed" | "no_show" | "cancelled" | "blocked";

const PM_STATUS_TAG_REGEX = /\[PM_STATUS:([A-Z_]+)\]/;
const PM_REASON_TAG_REGEX = /\[PM_REASON:([^\]]+)\]/;

const asValidPmStatus = (status: string | undefined): PmStatus | undefined => {
  if (!status) return undefined;
  const lowered = status.toLowerCase();
  if (
    lowered === "scheduled" ||
    lowered === "arrived" ||
    lowered === "checked_in" ||
    lowered === "seen" ||
    lowered === "completed" ||
    lowered === "no_show" ||
    lowered === "cancelled" ||
    lowered === "blocked"
  ) {
    return lowered;
  }
  return undefined;
};

const getPmStatusFromNotes = (notes: string | undefined): PmStatus | undefined => {
  const match = String(notes ?? "").match(PM_STATUS_TAG_REGEX);
  return asValidPmStatus(match?.[1]);
};

const getPmReasonFromNotes = (notes: string | undefined): string | undefined => {
  const match = String(notes ?? "").match(PM_REASON_TAG_REGEX);
  const value = match?.[1]?.trim();
  return value ? value : undefined;
};

const getStatusTimestampPatch = (status: PmStatus, now: number) => {
  if (status === "arrived") return { arrivedAt: now };
  if (status === "checked_in") return { checkedInAt: now };
  if (status === "seen") return { seenAt: now };
  if (status === "completed") return { completedAt: now };
  if (status === "no_show") return { noShowAt: now };
  if (status === "cancelled") return { cancelledAt: now };
  if (status === "blocked") return { blockedAt: now };
  return {};
};

export const listApptTypes = query({
  args: { clinicId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let q = ctx.db.query("primaryCareApptTypes");
    if (args.clinicId) q = q.filter((q) => q.eq(q.field("clinicId"), args.clinicId));
    return q.collect();
  },
});

export const createApptType = mutation({
  args: { clinicId: v.optional(v.string()), name: v.string() },
  handler: async (ctx, args) => {
    await mustBeDoctor(ctx);
    const now = Date.now();
    return await ctx.db.insert("primaryCareApptTypes", {
      clinicId: args.clinicId,
      name: args.name.trim(),
      createdAt: now,
    });
  },
});

export const removeApptType = mutation({
  args: { typeId: v.id("primaryCareApptTypes") },
  handler: async (ctx, args) => {
    await mustBeAdmin(ctx);
    const existing = await ctx.db.get(args.typeId);
    if (!existing) throw new Error("Appointment type not found.");
    await ctx.db.delete(args.typeId);
  },
});

export const listAppointments = query({
  args: { clinicId: v.optional(v.string()), startMs: v.optional(v.number()), endMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let q = ctx.db.query("primaryCareAppointments");
    if (args.clinicId) q = q.filter((q) => q.eq(q.field("clinicId"), args.clinicId));
    if (args.startMs !== undefined) {
      const start = args.startMs;
      q = q.filter((q) => q.gte(q.field("startMs"), start));
    }
    if (args.endMs !== undefined) {
      const end = args.endMs;
      q = q.filter((q) => q.lt(q.field("startMs"), end));
    }
    const rows = await q.collect();
    return rows.sort((a, b) => a.startMs - b.startMs);
  },
});

export const listRooms = query({
  args: { clinicId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let q = ctx.db.query("rooms");
    if (args.clinicId) q = q.filter((q) => q.eq(q.field("clinicId"), args.clinicId));
    return q.collect();
  },
});

export const createRoom = mutation({
  args: { clinicId: v.optional(v.string()), name: v.string(), capacity: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await mustBeClinicAdmin(ctx);
    const now = Date.now();
    return await ctx.db.insert("rooms", { clinicId: args.clinicId, name: args.name.trim(), capacity: args.capacity, createdAt: now });
  },
});

export const removeRoom = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    await mustBeClinicAdmin(ctx);
    const existing = await ctx.db.get(args.roomId);
    if (!existing) throw new Error("Room not found.");
    await ctx.db.delete(args.roomId);
  },
});

export const createAppointment = mutation({
  args: {
    clinicId: v.optional(v.string()),
    patientId: v.optional(v.id("patients")),
    patientName: v.string(),
    providerId: v.optional(v.id("users")),
    roomId: v.optional(v.id("rooms")),
    typeId: v.optional(v.id("primaryCareApptTypes")),
    startMs: v.number(),
    endMs: v.optional(v.number()),
    notes: v.optional(v.string()),
    pmStatus: v.optional(v.union(
      v.literal("scheduled"),
      v.literal("arrived"),
      v.literal("checked_in"),
      v.literal("seen"),
      v.literal("completed"),
      v.literal("no_show"),
      v.literal("cancelled"),
      v.literal("blocked")
    )),
    pmStatusReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await mustBeStaffOrDoctor(ctx);
    if (args.endMs !== undefined && args.endMs <= args.startMs) {
      throw new Error("End time must be after start time.");
    }

    // Check for overlaps within the same clinic and provider
    const windowStart = args.startMs - 24 * 60 * 60 * 1000;
    const windowEnd = (args.endMs ?? args.startMs) + 24 * 60 * 60 * 1000;
    let q = ctx.db.query("primaryCareAppointments");
    if (args.clinicId) q = q.filter((q) => q.eq(q.field("clinicId"), args.clinicId));
    const candidates = await q.filter((q) => q.gte(q.field("startMs"), windowStart)).filter((q) => q.lt(q.field("startMs"), windowEnd)).collect();

    const conflict = findConflict(candidates, { startMs: args.startMs, endMs: args.endMs, providerId: args.providerId, roomId: args.roomId });
    if (conflict) throw new Error("Appointment conflicts with existing appointment.");

    const now = Date.now();
    const inferredPmStatus =
      args.pmStatus ??
      (args.patientName.includes("[BLOCKED]") ? "blocked" : undefined) ??
      getPmStatusFromNotes(args.notes) ??
      "scheduled";
    const inferredPmReason = args.pmStatusReason?.trim() || getPmReasonFromNotes(args.notes);
    return await ctx.db.insert("primaryCareAppointments", {
      clinicId: args.clinicId,
      patientId: args.patientId,
      patientName: args.patientName.trim(),
      providerId: args.providerId,
      roomId: args.roomId,
      typeId: args.typeId,
      startMs: args.startMs,
      endMs: args.endMs,
      notes: args.notes?.trim(),
      pmStatus: inferredPmStatus,
      pmStatusReason: inferredPmReason,
      pmStatusUpdatedAt: now,
      ...getStatusTimestampPatch(inferredPmStatus, now),
      createdAt: now,
    });
  },
});

export const updateAppointment = mutation({
  args: {
    apptId: v.id("primaryCareAppointments"),
    patientName: v.optional(v.string()),
    providerId: v.optional(v.id("users")),
    roomId: v.optional(v.id("rooms")),
    typeId: v.optional(v.id("primaryCareApptTypes")),
    startMs: v.optional(v.number()),
    endMs: v.optional(v.number()),
    notes: v.optional(v.string()),
    pmStatus: v.optional(v.union(
      v.literal("scheduled"),
      v.literal("arrived"),
      v.literal("checked_in"),
      v.literal("seen"),
      v.literal("completed"),
      v.literal("no_show"),
      v.literal("cancelled"),
      v.literal("blocked")
    )),
    pmStatusReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Fetch appointment first
    const existing = await ctx.db.get(args.apptId);
    if (!existing) throw new Error("Appointment not found.");

    // authorization: admin, staff, or provider owner can update
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    if (identity.role !== "admin") {
      if (identity.role === "doctor") {
        if (!existing.providerId || String(identity.userId) !== String(existing.providerId)) {
          throw new Error("Not authorized to update this appointment");
        }
      } else if (identity.role === "staff") {
        // staff allowed
      } else {
        throw new Error("Not authorized to update this appointment");
      }
    }

    const nextStart = args.startMs !== undefined ? args.startMs : existing.startMs;
    const nextEnd = args.endMs !== undefined ? args.endMs : existing.endMs;
    if (nextEnd !== undefined && nextEnd <= nextStart) throw new Error("End time must be after start time.");

    // Check for overlaps within the same clinic and provider, ignoring this appointment
    const windowStart = nextStart - 24 * 60 * 60 * 1000;
    const windowEnd = (nextEnd ?? nextStart) + 24 * 60 * 60 * 1000;
    let q = ctx.db.query("primaryCareAppointments");
    if (existing.clinicId) q = q.filter((q) => q.eq(q.field("clinicId"), existing.clinicId));
    const candidates = await q
      .filter((q) => q.gte(q.field("startMs"), windowStart))
      .filter((q) => q.lt(q.field("startMs"), windowEnd))
      .collect();

    const candidatesFiltered = candidates.filter((c) => String(c._id) !== String(args.apptId));
    const updatedProviderId = args.providerId !== undefined ? args.providerId : existing.providerId;
    const updatedRoomId = args.roomId !== undefined ? args.roomId : existing.roomId;
    const conflict2 = findConflict(candidatesFiltered, { startMs: nextStart, endMs: nextEnd, providerId: updatedProviderId, roomId: updatedRoomId });
    if (conflict2) throw new Error("Updated time conflicts with existing appointment.");

    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.patientName !== undefined) patch.patientName = args.patientName.trim();
    if (args.providerId !== undefined) patch.providerId = args.providerId;
    if (args.roomId !== undefined) patch.roomId = args.roomId;
    if (args.typeId !== undefined) patch.typeId = args.typeId;
    if (args.startMs !== undefined) patch.startMs = args.startMs;
    if (args.endMs !== undefined) patch.endMs = args.endMs;
    if (args.notes !== undefined) patch.notes = args.notes?.trim();

    let nextPmStatus: PmStatus | undefined;
    if (args.pmStatus !== undefined) {
      nextPmStatus = args.pmStatus;
    } else if (args.patientName !== undefined && args.patientName.includes("[BLOCKED]")) {
      nextPmStatus = "blocked";
    } else if (args.notes !== undefined) {
      nextPmStatus = getPmStatusFromNotes(args.notes);
    }

    if (nextPmStatus) {
      const now = Date.now();
      patch.pmStatus = nextPmStatus;
      patch.pmStatusUpdatedAt = now;
      Object.assign(patch, getStatusTimestampPatch(nextPmStatus, now));
    }

    if (args.pmStatusReason !== undefined) {
      patch.pmStatusReason = args.pmStatusReason?.trim() || undefined;
    } else if (args.notes !== undefined) {
      const reasonFromNotes = getPmReasonFromNotes(args.notes);
      if (reasonFromNotes !== undefined) patch.pmStatusReason = reasonFromNotes;
    }

    await ctx.db.patch(args.apptId, patch);
  },
});

export const moveAppointment = mutation({
  args: { apptId: v.id("primaryCareAppointments"), deltaMs: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db.get(args.apptId);
    if (!existing) throw new Error("Appointment not found.");
    if (identity.role !== "admin") {
      if (identity.role === "doctor") {
        if (!existing.providerId || String(identity.userId) !== String(existing.providerId)) {
          throw new Error("Not authorized to move this appointment");
        }
      } else if (identity.role === "staff") {
        // staff allowed to move
      } else {
        throw new Error("Not authorized to move this appointment");
      }
    }
    const nextStart = existing.startMs + args.deltaMs;
    const nextEnd = existing.endMs !== undefined ? existing.endMs + args.deltaMs : undefined;

    const windowStart = nextStart - 24 * 60 * 60 * 1000;
    const windowEnd = (nextEnd ?? nextStart) + 24 * 60 * 60 * 1000;
    let q = ctx.db.query("primaryCareAppointments");
    if (existing.clinicId) q = q.filter((q) => q.eq(q.field("clinicId"), existing.clinicId));
    const candidates = await q
      .filter((q) => q.gte(q.field("startMs"), windowStart))
      .filter((q) => q.lt(q.field("startMs"), windowEnd))
      .collect();
    const candidatesFiltered = candidates.filter((c) => String(c._id) !== String(args.apptId));
    const conflict = findConflict(candidatesFiltered, { startMs: nextStart, endMs: nextEnd, providerId: existing.providerId, roomId: existing.roomId });
    if (conflict) throw new Error("Moved time conflicts with existing appointment.");

    const next: Record<string, any> = { startMs: nextStart, updatedAt: Date.now() };
    if (nextEnd !== undefined) next.endMs = nextEnd;
    await ctx.db.patch(args.apptId, next);
  },
});

export const deleteAppointment = mutation({
  args: { apptId: v.id("primaryCareAppointments") },
  handler: async (ctx, args) => {
    await mustBeAdmin(ctx);
    const existing = await ctx.db.get(args.apptId);
    if (!existing) throw new Error("Appointment not found.");
    await ctx.db.delete(args.apptId);
  },
});

export const listTemplates = query({ args: { clinicId: v.optional(v.string()) }, handler: async (ctx, args) => {
  let q = ctx.db.query("primaryCareNoteTemplates");
  if (args.clinicId) q = q.filter((q) => q.eq(q.field("clinicId"), args.clinicId));
  return q.collect();
}});

export const createTemplate = mutation({
  args: { clinicId: v.optional(v.string()), name: v.string(), content: v.string() },
  handler: async (ctx, args) => {
    await mustBeDoctor(ctx);
    const now = Date.now();
    return await ctx.db.insert("primaryCareNoteTemplates", {
      clinicId: args.clinicId,
      name: args.name.trim(),
      content: args.content,
      createdAt: now,
    });
  },
});

export const updateTemplate = mutation({
  args: { templateId: v.id("primaryCareNoteTemplates"), name: v.optional(v.string()), content: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await mustBeDoctor(ctx);
    const existing = await ctx.db.get(args.templateId);
    if (!existing) throw new Error("Template not found.");
    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.content !== undefined) patch.content = args.content;
    await ctx.db.patch(args.templateId, patch);
  },
});

export const deleteTemplate = mutation({
  args: { templateId: v.id("primaryCareNoteTemplates") },
  handler: async (ctx, args) => {
    await mustBeAdmin(ctx);
    const existing = await ctx.db.get(args.templateId);
    if (!existing) throw new Error("Template not found.");
    await ctx.db.delete(args.templateId);
  },
});

export const ensurePrimaryCareDefaults = mutation({
  args: { clinicId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await mustBeStaffOrDoctor(ctx);
    const clinicId = args.clinicId;

    let typeQuery = ctx.db.query("primaryCareApptTypes");
    if (clinicId) typeQuery = typeQuery.filter((q) => q.eq(q.field("clinicId"), clinicId));
    let roomQuery = ctx.db.query("rooms");
    if (clinicId) roomQuery = roomQuery.filter((q) => q.eq(q.field("clinicId"), clinicId));
    let templateQuery = ctx.db.query("primaryCareNoteTemplates");
    if (clinicId) templateQuery = templateQuery.filter((q) => q.eq(q.field("clinicId"), clinicId));

    const [types, rooms, templates] = await Promise.all([typeQuery.collect(), roomQuery.collect(), templateQuery.collect()]);

    const now = Date.now();

    if (types.length === 0) {
      await Promise.all(
        ["Consult - New", "Consult - EST", "SP Injection", "Follow-up", "Annual Physical"].map((name) =>
          ctx.db.insert("primaryCareApptTypes", { clinicId, name, createdAt: now }),
        ),
      );
    }

    if (rooms.length === 0) {
      await ctx.db.insert("rooms", { clinicId, name: "Exam Room 1", capacity: 1, createdAt: now });
    }

    if (templates.length === 0) {
      await ctx.db.insert("primaryCareNoteTemplates", {
        clinicId,
        name: "Primary Care SOAP",
        content: "S:\nO:\nA:\nP:\n",
        createdAt: now,
      });
    }
  },
});
