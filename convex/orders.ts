// convex/orders.ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";

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