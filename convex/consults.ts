// convex/consults.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * 🚀 Start a new Tele-Consultation
 */
export const start = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    specialty: v.string(),
    userId: v.id("users"),
    roomName: v.string(),
  },
  handler: async (ctx, args) => {
    const { encounterId, patientId, specialty, userId, roomName } = args;

    // 1. Create the consult record
    const consultId = await ctx.db.insert("teleConsults", {
      encounterId,
      patientId,
      specialty,
      roomName,
      requestedBy: userId,
      status: "ACTIVE",
      requestedAt: Date.now(),
    });

    // 2. Trigger a notification for all Specialists in that department
    // In a real app, you'd filter users by role/specialty
    await ctx.db.insert("notifications", {
      title: `Incoming ${args.specialty} Consult`,
      message: `Urgent Tele-Consult requested for Patient ID: ${args.patientId.slice(0, 5)}`,
      type: "SYSTEM",
      isRead: false,
      timestamp: Date.now(),
      patientId: args.patientId,
    });

    return consultId;
  },
});

/**
 * ✅ Complete/End a Consultation
 */
export const complete = mutation({
  args: { id: v.id("teleConsults") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "COMPLETED" });
  },
});

/**
 * 🔍 Fetch active consults for the current encounter
 */
export const getActiveByEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teleConsults")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .filter((q) => q.eq(q.field("status"), "ACTIVE"))
      .unique();
  },
});