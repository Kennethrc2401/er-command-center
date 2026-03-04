import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("socialHistory")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .unique();
  },
});

// For when you need to update it
export const update = mutation({
  args: {
    patientId: v.id("patients"),
    smokingStatus: v.string(),
    livingSituation: v.string(),
    alcoholUse: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("socialHistory")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, lastUpdated: Date.now() });
    } else {
      await ctx.db.insert("socialHistory", { ...args, lastUpdated: Date.now() });
    }
  },
});