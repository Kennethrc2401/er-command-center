// convex/orders.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function buildOrderSearchVector(testName: string, type: "LAB" | "IMAGING") {
  return `${testName} ${type}`.toLowerCase();
}

export const placeOrder = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    type: v.union(v.literal("LAB"), v.literal("IMAGING")),
    testName: v.string(),
    priority: v.union(v.literal("ROUTINE"), v.literal("STAT")),
  },
  handler: async (ctx, args) => {
    const orderId = await ctx.db.insert("orders", {
      ...args,
      searchVector: buildOrderSearchVector(args.testName, args.type),
      status: "PENDING",
      orderedAt: Date.now(),
    });
    return orderId;
  },
});

export const getByEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
  },
});

/**
 * Mark an order as COMPLETED.
 * If the order was STAT priority, a STAT_ORDER notification is broadcast
 * so the NotificationBell fires an alert + sound for the clinical team.
 */
export const completeOrder = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.status === "COMPLETED") return; // idempotent

    await ctx.db.patch(args.orderId, { status: "COMPLETED" });

    // 🔴 STAT order completed → broadcast a critical notification
    if (order.priority === "STAT") {
      const patient = await ctx.db.get(order.patientId);
      const patientName = patient?.name ?? "Unknown Patient";

      await ctx.db.insert("notifications", {
        // userId left undefined = global broadcast visible to all staff
        title: `STAT Result Ready: ${order.testName}`,
        message: `${order.testName} for ${patientName} has been resulted. Immediate physician review required.`,
        type: "STAT_ORDER",
        isRead: false,
        timestamp: Date.now(),
        patientId: order.patientId,
      });
    }
  },
});

/** Live count of pending STAT orders — used by the notification badge. */
export const getPendingStatCount = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("orders").collect();
    return all.filter((o) => o.priority === "STAT" && o.status === "PENDING").length;
  },
});