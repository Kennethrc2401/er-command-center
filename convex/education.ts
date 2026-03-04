import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// 1. Fetch all education logs for a specific visit
export const getByEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("educationLogs")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
  },
});

// 2. Log a new teaching moment
export const log = mutation({
  args: {
    encounterId: v.id("encounters"),
    topic: v.string(),
    method: v.string(),
    understanding: v.string(),
    completedBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("educationLogs", {
      ...args,
      completedAt: Date.now(),
    });
  },
});