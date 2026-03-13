// convex/audit.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const logEvent = mutation({
  args: {
    userId: v.id("users"),
    userName: v.string(),
    action: v.string(),
    patientId: v.optional(v.id("patients")),
    patientName: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const getRecentLogs = query({
  handler: async (ctx) => {
    return await ctx.db.query("auditLogs").order("desc").take(50);
  },
});