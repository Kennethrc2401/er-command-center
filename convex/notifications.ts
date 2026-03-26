// convex/notifications.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

const notificationTypeValidator = v.union(
  v.literal("STAT_ORDER"),
  v.literal("CRITICAL_VITAL"),
  v.literal("CRITICAL_LAB"),
  v.literal("SYSTEM")
);

export const getActive = query({
  args: {
    userId: v.optional(v.id("users")),
    includeGlobal: v.optional(v.boolean()),
    type: v.optional(notificationTypeValidator),
  },
  handler: async (ctx, args) => {
    const applyTypeFilter = <T extends { type: string }>(rows: T[]) =>
      args.type ? rows.filter((row) => row.type === args.type) : rows;

    const includeGlobal = args.includeGlobal ?? true;

    if (!args.userId) {
      const globalUnread = await ctx.db
        .query("notifications")
        .withIndex("by_timestamp")
        .filter((q) => q.and(
          q.eq(q.field("userId"), undefined),
          q.eq(q.field("isRead"), false)
        ))
        .order("desc")
        .take(25);

      return applyTypeFilter(globalUnread).slice(0, 10);
    }

    const userUnread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId).eq("isRead", false))
      .order("desc")
      .take(25);

    const globalUnread = includeGlobal
      ? await ctx.db
          .query("notifications")
          .withIndex("by_timestamp")
          .filter((q) => q.and(
            q.eq(q.field("userId"), undefined),
            q.eq(q.field("isRead"), false)
          ))
          .order("desc")
          .take(25)
      : [];

    return applyTypeFilter([...userUnread, ...globalUnread])
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  },
});

export const markAsRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isRead: true });
  },
});

/** Dismiss every unread notification for a given user (or global ones if no userId). */
export const markAllRead = mutation({
  args: {
    userId: v.optional(v.id("users")),
    includeGlobal: v.optional(v.boolean()),
    type: v.optional(notificationTypeValidator),
  },
  handler: async (ctx, args) => {
    const includeGlobal = args.includeGlobal ?? false;
    const applyTypeFilter = <T extends { type: string }>(rows: T[]) =>
      args.type ? rows.filter((row) => row.type === args.type) : rows;

    const userUnread = args.userId
      ? await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", args.userId).eq("isRead", false))
          .collect()
      : [];

    const globalUnread = includeGlobal
      ? await ctx.db
          .query("notifications")
          .withIndex("by_timestamp")
          .filter((q) => q.and(
            q.eq(q.field("userId"), undefined),
            q.eq(q.field("isRead"), false)
          ))
          .collect()
      : [];

    const unread = applyTypeFilter([...userUnread, ...globalUnread]);
    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { isRead: true })));
  },
});