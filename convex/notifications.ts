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

    const getGlobalUnread = async (limit: number) => {
      const recent = await ctx.db
        .query("notifications")
        .withIndex("by_timestamp")
        .order("desc")
        .take(200);

      return recent
        .filter((row) => !row.isRead)
        .slice(0, limit);
    };

    const includeGlobal = args.includeGlobal ?? true;

    if (!args.userId) {
      const globalUnread = await getGlobalUnread(25);

      return applyTypeFilter(globalUnread).slice(0, 10);
    }

    const allUserRecent = await ctx.db
      .query("notifications")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);
    
    const userUnread = allUserRecent
      .filter((row) => !row.isRead)
      .slice(0, 25);

    const globalUnread = includeGlobal
      ? await getGlobalUnread(25)
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

    const getGlobalUnread = async () => {
      const recent = await ctx.db
        .query("notifications")
        .withIndex("by_timestamp")
        .order("desc")
        .take(500);

      return recent.filter((row) => !row.isRead);
    };

    const userUnread = args.userId
      ? await ctx.db
          .query("notifications")
          .withIndex("by_timestamp")
          .order("desc")
          .take(500)
          .then((rows) => rows.filter((row) => !row.isRead))
      : [];

    const globalUnread = includeGlobal
      ? await getGlobalUnread()
      : [];

    const unread = applyTypeFilter([...userUnread, ...globalUnread]);
    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { isRead: true })));
  },
});