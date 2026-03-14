// convex/notifications.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getActive = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const globalUnread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", undefined).eq("isRead", false))
      .order("desc")
      .take(10);

    if (!args.userId) {
      return globalUnread;
    }

    const userUnread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId).eq("isRead", false))
      .order("desc")
      .take(10);

    return [...userUnread, ...globalUnread]
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
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId).eq("isRead", false))
      .collect();
    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { isRead: true })));
  },
});