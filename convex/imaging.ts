import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getByEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("imagingOrders")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .order("desc")
      .collect();
  },
});

export const updateStatus = mutation({
  args: { 
    orderId: v.id("imagingOrders"), 
    status: v.union(v.literal("Ordered"), v.literal("In Progress"), v.literal("Resulted")),
    report: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, { 
      status: args.status,
      report: args.report 
    });
  },
});

export const createOrder = mutation({
  args: {
    encounterId: v.id("encounters"),
    studyName: v.string(),
    modality: v.string(),
    reason: v.string(),
    priority: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("imagingOrders", {
      ...args,
      status: "Ordered",
      orderedAt: Date.now(),
    });
  },
});

export const getPendingCount = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("imagingOrders")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "Ordered"),
          q.eq(q.field("status"), "In Progress")
        )
      )
      .collect();
    return pending.length;
  },
});