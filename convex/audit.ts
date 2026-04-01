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

export const getSessionActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 40, 10), 200);
    const rows = await ctx.db.query("auditLogs").order("desc").take(limit * 3);

    const sessionActions = new Set([
      "STAFF_LOGIN_SUCCESS",
      "STAFF_LOGOUT",
      "PASSKEY_REGISTERED",
      "PASSKEY_LOGIN_SUCCESS",
      "PASSKEY_REVOKED",
      "PASSKEY_RENAMED",
    ]);

    return rows
      .filter((row) => sessionActions.has(row.action))
      .slice(0, limit);
  },
});