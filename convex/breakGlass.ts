import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const MAX_DURATION_MINUTES = 8 * 60;
const MIN_DURATION_MINUTES = 5;

const assertAdmin = async (ctx: MutationCtx | QueryCtx, userId: Id<"users">) => {
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE") {
    throw new Error("Only active ADMIN users can use break-glass controls.");
  }
  return user;
};

export const getCurrentForUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const rows = await ctx.db
      .query("breakGlassSessions")
      .withIndex("by_user_active", (q) => q.eq("userId", args.userId).eq("isActive", true))
      .order("desc")
      .take(5);

    const active = rows.find((row) => row.expiresAt > now);
    return active ?? null;
  },
});

export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 30, 5), 100);
    const rows = await ctx.db.query("breakGlassSessions").withIndex("by_startedAt").order("desc").take(limit);

    return rows;
  },
});

export const activate = mutation({
  args: {
    actorUserId: v.id("users"),
    reason: v.string(),
    durationMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const reason = args.reason.trim();
    const durationMinutes = Math.max(MIN_DURATION_MINUTES, Math.min(MAX_DURATION_MINUTES, Math.floor(args.durationMinutes)));

    if (!reason) {
      throw new Error("A break-glass reason is required.");
    }

    const actor = await assertAdmin(ctx, args.actorUserId);

    const currentRows = await ctx.db
      .query("breakGlassSessions")
      .withIndex("by_user_active", (q) => q.eq("userId", args.actorUserId).eq("isActive", true))
      .collect();

    await Promise.all(
      currentRows
        .filter((row) => row.expiresAt > now)
        .map((row) =>
          ctx.db.patch(row._id, {
            isActive: false,
            revokedAt: now,
            revokedByUserId: args.actorUserId,
            revokeReason: "Superseded by new break-glass activation",
          })
        )
    );

    const expiresAt = now + durationMinutes * 60_000;
    const sessionId = await ctx.db.insert("breakGlassSessions", {
      userId: args.actorUserId,
      reason,
      startedAt: now,
      expiresAt,
      isActive: true,
    });

    await ctx.db.insert("auditLogs", {
      userId: args.actorUserId,
      userName: actor.name,
      action: "BREAK_GLASS_ENABLED",
      patientName: "System",
      timestamp: now,
      metadata: `Duration=${durationMinutes}m; reason=${reason}`,
    });

    return {
      sessionId,
      expiresAt,
      durationMinutes,
    };
  },
});

export const revoke = mutation({
  args: {
    actorUserId: v.id("users"),
    sessionId: v.id("breakGlassSessions"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = await assertAdmin(ctx, args.actorUserId);

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Break-glass session not found.");
    }

    if (!session.isActive) {
      return { alreadyInactive: true };
    }

    await ctx.db.patch(args.sessionId, {
      isActive: false,
      revokedAt: now,
      revokedByUserId: args.actorUserId,
      revokeReason: args.reason?.trim() || "Manual revoke",
    });

    await ctx.db.insert("auditLogs", {
      userId: args.actorUserId,
      userName: actor.name,
      action: "BREAK_GLASS_REVOKED",
      patientName: "System",
      timestamp: now,
      metadata: `TargetUserId=${session.userId}; reason=${args.reason?.trim() || "Manual revoke"}`,
    });

    return { ok: true };
  },
});
