import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getByEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("triageAssessments")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .unique();
  },
});

export const submit = mutation({
  args: {
    encounterId: v.id("encounters"),
    gcsScore: v.number(),
    pupils: v.string(),
    mentalStatus: v.string(),
    workOfBreathing: v.string(),
    lungSounds: v.string(),
    skinTemp: v.string(),
    skinCondition: v.string(),
    triageNurse: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("triageAssessments")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .unique();

    if (existing) {
      return await ctx.db.patch(existing._id, { ...args, completedAt: Date.now() });
    }
    return await ctx.db.insert("triageAssessments", { ...args, completedAt: Date.now() });
  },
});

// Add this to convex/triage.ts
export const getLatestGCS = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const assessment = await ctx.db
      .query("triageAssessments")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .unique();
    return assessment?.gcsScore ?? null;
  },
});