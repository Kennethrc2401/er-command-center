import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getPosPermissions = query({
  args: {},
  handler: async (ctx) => {
    return { canProcessPayments: true, roles: ["BILLER", "CASHIER"] };
  },
});

export const getPosQueueSummary = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db.query("posCharges").withIndex("by_status", (q) => q.eq("status", "PENDING")).collect();
    const total = pending.reduce((s, c: any) => s + (c.amountCents || 0), 0);
    return { pendingCount: pending.length, totalOutstandingCents: total };
  },
});

export const getEncounterPosLedger = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const charges = await ctx.db.query("posCharges").withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId)).collect();
    return charges;
  },
});

export const createPosCharge = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    amountCents: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("posCharges", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      amountCents: args.amountCents,
      description: args.description,
      status: "PENDING",
      createdAt: Date.now(),
      createdBy: "pos-service",
    });
  },
});

export const capturePosPayment = mutation({
  args: {
    chargeId: v.id("posCharges"),
    amountCents: v.number(),
    method: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("posPayments", {
      chargeId: args.chargeId,
      amountCents: args.amountCents,
      method: args.method,
      processedAt: Date.now(),
    });
    await ctx.db.patch(args.chargeId, { status: "PAID" });
    return { status: "captured" };
  },
});

export const voidPosCharge = mutation({
  args: { chargeId: v.id("posCharges") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chargeId, { status: "VOID" });
    return { status: "voided" };
  },
});

export const refundPosPayment = mutation({
  args: { paymentId: v.id("posPayments"), amountCents: v.number() },
  handler: async (ctx, args) => {
    // Mark original payment as refunded (simple approach)
    await ctx.db.patch(args.paymentId, { refunded: true });
    return { status: "refunded" };
  },
});

export const getActiveDrawerSession = query({
  args: {},
  handler: async (ctx) => {
    const open = await ctx.db.query("posDrawerSessions").withIndex("by_closed_at", (q) => q.eq("closedAt", undefined)).collect();
    return open.length > 0 ? open[0] : null;
  },
});

export const getRecentDrawerSessions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("posDrawerSessions").order("desc").take(10);
  },
});

export const openDrawerSession = mutation({
  args: { openedBy: v.string(), openingFloatCents: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("posDrawerSessions", {
      openedBy: args.openedBy,
      openedAt: Date.now(),
      openingFloatCents: args.openingFloatCents,
    });
  },
});

export const closeDrawerSession = mutation({
  args: { sessionId: v.id("posDrawerSessions"), closingFloatCents: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { closedAt: Date.now(), closingFloatCents: args.closingFloatCents });
    return { status: "closed" };
  },
});

export const acknowledgeDrawerVariance = mutation({
  args: { sessionId: v.id("posDrawerSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { varianceAcknowledged: true });
    return { status: "acknowledged" };
  },
});
