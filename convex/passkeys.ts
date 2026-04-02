import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const requireBreakGlassForAdmin = async (ctx: MutationCtx, actorUserId: Id<"users">) => {
  const actor = await ctx.db.get(actorUserId);
  if (!actor || actor.role !== "ADMIN" || actor.status !== "ACTIVE") {
    throw new Error("Only active ADMIN users can perform this action.");
  }

  const now = Date.now();
  const sessions = await ctx.db
    .query("breakGlassSessions")
    .withIndex("by_user_active", (q) => q.eq("userId", actorUserId).eq("isActive", true))
    .order("desc")
    .take(10);

  const activeSession = sessions.find((session) => session.expiresAt > now);
  if (!activeSession) {
    throw new Error("Break-glass access is required for this operation.");
  }

  return actor;
};

const normalizeCredentialId = (credentialId: string) => credentialId.trim();

const normalizeOptionalName = (name?: string) => {
  const trimmed = name?.trim();
  return trimmed ? trimmed : undefined;
};

export const getPasskeysByUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("staffPasskeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return rows.map((row) => ({
      _id: row._id,
      credentialId: row.credentialId,
      transports: row.transports ?? [],
      counter: row.counter,
      name: row.name ?? "",
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
      deviceType: row.deviceType,
      backedUp: row.backedUp,
    }));
  },
});

export const getPasskeyByCredentialId = query({
  args: {
    credentialId: v.string(),
  },
  handler: async (ctx, args) => {
    const credentialId = normalizeCredentialId(args.credentialId);
    const row = await ctx.db
      .query("staffPasskeys")
      .withIndex("by_credential_id", (q) => q.eq("credentialId", credentialId))
      .first();

    if (!row) return null;

    return {
      _id: row._id,
      userId: row.userId,
      credentialId: row.credentialId,
      publicKey: row.publicKey,
      counter: row.counter,
      transports: row.transports ?? [],
      deviceType: row.deviceType,
      backedUp: row.backedUp,
      name: row.name ?? "",
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
    };
  },
});

export const registerPasskey = mutation({
  args: {
    userId: v.id("users"),
    credentialId: v.string(),
    publicKey: v.string(),
    counter: v.number(),
    transports: v.optional(v.array(v.string())),
    deviceType: v.optional(v.string()),
    backedUp: v.optional(v.boolean()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const credentialId = normalizeCredentialId(args.credentialId);
    if (!credentialId) {
      throw new Error("Passkey credential ID is required.");
    }

    const existing = await ctx.db
      .query("staffPasskeys")
      .withIndex("by_credential_id", (q) => q.eq("credentialId", credentialId))
      .first();

    const now = Date.now();

    if (existing) {
      if (existing.userId !== args.userId) {
        throw new Error("This passkey is already linked to another account.");
      }

      await ctx.db.patch(existing._id, {
        publicKey: args.publicKey,
        counter: args.counter,
        transports: args.transports,
        deviceType: args.deviceType,
        backedUp: args.backedUp,
        name: normalizeOptionalName(args.name),
      });

      return {
        created: false,
        passkeyId: existing._id,
      };
    }

    const passkeyId = await ctx.db.insert("staffPasskeys", {
      userId: args.userId,
      credentialId,
      publicKey: args.publicKey,
      counter: args.counter,
      transports: args.transports,
      deviceType: args.deviceType,
      backedUp: args.backedUp,
      name: normalizeOptionalName(args.name),
      createdAt: now,
      lastUsedAt: now,
    });

    return {
      created: true,
      passkeyId,
    };
  },
});

export const markPasskeyUsed = mutation({
  args: {
    credentialId: v.string(),
    counter: v.number(),
  },
  handler: async (ctx, args) => {
    const credentialId = normalizeCredentialId(args.credentialId);
    const row = await ctx.db
      .query("staffPasskeys")
      .withIndex("by_credential_id", (q) => q.eq("credentialId", credentialId))
      .first();

    if (!row) {
      throw new Error("Passkey not found.");
    }

    await ctx.db.patch(row._id, {
      counter: args.counter,
      lastUsedAt: Date.now(),
    });
  },
});

export const getAdminPasskeyInventory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 200, 500));
    const rows = await ctx.db.query("staffPasskeys").collect();

    const sortedRows = rows
      .slice()
      .sort((left, right) => {
        const leftSortTs = left.lastUsedAt ?? left.createdAt;
        const rightSortTs = right.lastUsedAt ?? right.createdAt;
        return rightSortTs - leftSortTs;
      })
      .slice(0, limit);

    const inventory = await Promise.all(
      sortedRows.map(async (row) => {
        const user = await ctx.db.get(row.userId);
        return {
          _id: row._id,
          userId: row.userId,
          userName: user?.name ?? "Unknown User",
          username: user?.username ?? "",
          role: user?.role ?? "CCMA",
          status: user?.status ?? "INACTIVE",
          credentialId: row.credentialId,
          name: row.name ?? "",
          transports: row.transports ?? [],
          deviceType: row.deviceType,
          backedUp: row.backedUp,
          createdAt: row.createdAt,
          lastUsedAt: row.lastUsedAt,
        };
      })
    );

    return inventory;
  },
});

export const renamePasskey = mutation({
  args: {
    actorUserId: v.id("users"),
    passkeyId: v.id("staffPasskeys"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireBreakGlassForAdmin(ctx, args.actorUserId);

    const passkey = await ctx.db.get(args.passkeyId);
    if (!passkey) {
      throw new Error("Passkey not found.");
    }

    const nextName = normalizeOptionalName(args.name);
    await ctx.db.patch(args.passkeyId, {
      name: nextName,
    });

    return { success: true };
  },
});

export const revokePasskey = mutation({
  args: {
    actorUserId: v.id("users"),
    passkeyId: v.id("staffPasskeys"),
  },
  handler: async (ctx, args) => {
    await requireBreakGlassForAdmin(ctx, args.actorUserId);

    const passkey = await ctx.db.get(args.passkeyId);
    if (!passkey) {
      throw new Error("Passkey not found.");
    }

    await ctx.db.delete(args.passkeyId);
    return { success: true };
  },
});
