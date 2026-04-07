import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

type PosRole =
  | "ADMIN"
  | "UNIT_COORDINATOR"
  | "NURSE"
  | "CCMA"
  | "DOCTOR"
  | "SURGEON"
  | "ANESTHESIOLOGIST"
  | "PHARMACIST"
  | "RESPIRATORY_THERAPIST"
  | "RAD_TECH"
  | "SCRUB_TECH";

const POS_COLLECT_ROLES = new Set<PosRole>(["ADMIN", "UNIT_COORDINATOR", "NURSE", "CCMA"]);
const POS_MANAGER_ROLES = new Set<PosRole>(["ADMIN", "UNIT_COORDINATOR"]);

const resolveActor = async (ctx: MutationCtx | QueryCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  const email = identity?.email?.toLowerCase();
  if (!email) {
    throw new Error("Unauthenticated: sign in required.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

  if (!user || user.status !== "ACTIVE") {
    throw new Error("Unauthorized: active staff access required.");
  }

  const role = user.role as PosRole;

  return {
    name: user.name,
    role,
    canCollect: POS_COLLECT_ROLES.has(role) || POS_MANAGER_ROLES.has(role),
    canManage: POS_MANAGER_ROLES.has(role),
  };
};

const centsFromDollars = (amount: number) => Math.max(0, Math.round(amount));

export const createPosCharge = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    description: v.string(),
    amountCents: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx);
    if (!actor.canCollect) {
      throw new Error("Unauthorized: role cannot create POS charges.");
    }

    const now = Date.now();
    const amountCents = centsFromDollars(args.amountCents);

    if (!args.description.trim()) {
      throw new Error("Charge description is required.");
    }

    if (amountCents <= 0) {
      throw new Error("Charge amount must be greater than zero.");
    }

    const chargeId = await ctx.db.insert("posCharges", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      description: args.description.trim().slice(0, 120),
      amountCents,
      paidCents: 0,
      status: "open",
      createdBy: actor.name,
      createdAt: now,
      updatedAt: now,
    });

    return { chargeId };
  },
});

export const capturePosPayment = mutation({
  args: {
    chargeId: v.id("posCharges"),
    amountCents: v.number(),
    method: v.union(v.literal("card"), v.literal("cash"), v.literal("check"), v.literal("hsa"), v.literal("other")),
    reference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx);
    if (!actor.canCollect) {
      throw new Error("Unauthorized: role cannot collect POS payments.");
    }

    const now = Date.now();
    const amountCents = centsFromDollars(args.amountCents);

    if (amountCents <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    const charge = await ctx.db.get(args.chargeId);
    if (!charge) throw new Error("Charge not found.");
    if (charge.status === "void") throw new Error("Cannot collect payment on a voided charge.");

    const remaining = Math.max(0, charge.amountCents - charge.paidCents);
    if (remaining <= 0) throw new Error("Charge is already fully paid.");

    const paymentAmount = Math.min(amountCents, remaining);
    const nextPaid = charge.paidCents + paymentAmount;
    const nextStatus = nextPaid >= charge.amountCents ? "paid" : "partial";

    await ctx.db.insert("posPayments", {
      chargeId: charge._id,
      encounterId: charge.encounterId,
      patientId: charge.patientId,
      amountCents: paymentAmount,
      method: args.method,
      reference: args.reference?.trim() ? args.reference.trim().slice(0, 80) : undefined,
      collectedBy: actor.name,
      collectedAt: now,
    });

    await ctx.db.patch(charge._id, {
      paidCents: nextPaid,
      status: nextStatus,
      updatedAt: now,
      lastPaymentMethod: args.method,
      lastReference: args.reference?.trim() ? args.reference.trim().slice(0, 80) : undefined,
    });

    return { paidCents: paymentAmount, remainingCents: Math.max(0, charge.amountCents - nextPaid), status: nextStatus };
  },
});

export const voidPosCharge = mutation({
  args: {
    chargeId: v.id("posCharges"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx);
    if (!actor.canManage) {
      throw new Error("Unauthorized: role cannot void POS charges.");
    }

    const charge = await ctx.db.get(args.chargeId);
    if (!charge) throw new Error("Charge not found.");
    if (charge.status === "void") return { status: "void" as const };
    if (charge.paidCents > 0) {
      throw new Error("Charge already has payments. Refund payments before voiding.");
    }

    await ctx.db.patch(charge._id, {
      status: "void",
      updatedAt: Date.now(),
      lastReference: args.reason?.trim() ? `VOID:${args.reason.trim().slice(0, 60)}` : "VOID",
    });

    return { status: "void" as const };
  },
});

export const refundPosPayment = mutation({
  args: {
    paymentId: v.id("posPayments"),
    amountCents: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx);
    if (!actor.canManage) {
      throw new Error("Unauthorized: role cannot process POS refunds.");
    }

    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment not found.");

    const charge = await ctx.db.get(payment.chargeId);
    if (!charge) throw new Error("Charge not found for payment.");

    const existingRefunds = await ctx.db
      .query("posRefunds")
      .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
      .collect();

    const alreadyRefundedCents = existingRefunds.reduce((sum, refund) => sum + refund.amountCents, 0);
    const refundableCents = Math.max(0, payment.amountCents - alreadyRefundedCents);
    if (refundableCents <= 0) {
      throw new Error("Payment has already been fully refunded.");
    }

    const requestedCents = centsFromDollars(args.amountCents);
    if (requestedCents <= 0) {
      throw new Error("Refund amount must be greater than zero.");
    }

    const refundCents = Math.min(requestedCents, refundableCents);

    await ctx.db.insert("posRefunds", {
      paymentId: payment._id,
      chargeId: payment.chargeId,
      encounterId: payment.encounterId,
      patientId: payment.patientId,
      amountCents: refundCents,
      reason: args.reason?.trim() ? args.reason.trim().slice(0, 120) : undefined,
      refundedBy: actor.name,
      refundedAt: Date.now(),
    });

    const nextPaid = Math.max(0, charge.paidCents - refundCents);
    const nextStatus =
      charge.status === "void"
        ? "void"
        : nextPaid <= 0
          ? "open"
          : nextPaid >= charge.amountCents
            ? "paid"
            : "partial";

    await ctx.db.patch(charge._id, {
      paidCents: nextPaid,
      status: nextStatus,
      updatedAt: Date.now(),
      lastReference: args.reason?.trim() ? `REFUND:${args.reason.trim().slice(0, 60)}` : "REFUND",
    });

    return {
      refundedCents: refundCents,
      remainingRefundableCents: Math.max(0, refundableCents - refundCents),
      chargeStatus: nextStatus,
    };
  },
});

export const getPosPermissions = query({
  args: {},
  handler: async (ctx) => {
    const actor = await resolveActor(ctx);
    return {
      actorName: actor.name,
      actorRole: actor.role,
      canCollect: actor.canCollect,
      canManage: actor.canManage,
    };
  },
});

export const getEncounterPosLedger = query({
  args: {
    encounterId: v.id("encounters"),
  },
  handler: async (ctx, args) => {
    const charges = await ctx.db
      .query("posCharges")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const withPayments = await Promise.all(
      charges.map(async (charge) => {
        const payments = await ctx.db
          .query("posPayments")
          .withIndex("by_charge", (q) => q.eq("chargeId", charge._id))
          .collect();

        const paymentsWithRefunds = await Promise.all(
          payments.map(async (payment) => {
            const refunds = await ctx.db
              .query("posRefunds")
              .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
              .collect();

            const refundedCents = refunds.reduce((sum, refund) => sum + refund.amountCents, 0);
            return {
              ...payment,
              refunds: refunds.sort((left, right) => right.refundedAt - left.refundedAt),
              refundedCents,
              netCents: Math.max(0, payment.amountCents - refundedCents),
              refundableCents: Math.max(0, payment.amountCents - refundedCents),
            };
          })
        );

        return {
          ...charge,
          payments: paymentsWithRefunds.sort((left, right) => right.collectedAt - left.collectedAt),
          remainingCents: Math.max(0, charge.amountCents - charge.paidCents),
        };
      })
    );

    const totalBilledCents = withPayments.reduce((sum, row) => sum + row.amountCents, 0);
    const totalPaidCents = withPayments.reduce((sum, row) => sum + row.paidCents, 0);

    return {
      charges: withPayments.sort((left, right) => right.updatedAt - left.updatedAt),
      summary: {
        totalBilledCents,
        totalPaidCents,
        totalOutstandingCents: Math.max(0, totalBilledCents - totalPaidCents),
      },
    };
  },
});

export const getPosQueueSummary = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dayStart = new Date(new Date(now).toDateString()).getTime();

    const [openCharges, todaysPayments, todaysRefunds] = await Promise.all([
      ctx.db
        .query("posCharges")
        .withIndex("by_status", (q) => q.eq("status", "open"))
        .collect(),
      ctx.db
        .query("posPayments")
        .withIndex("by_collected_at", (q) => q.gte("collectedAt", dayStart))
        .collect(),
      ctx.db
        .query("posRefunds")
        .withIndex("by_refunded_at", (q) => q.gte("refundedAt", dayStart))
        .collect(),
    ]);

    const partialCharges = await ctx.db
      .query("posCharges")
      .withIndex("by_status", (q) => q.eq("status", "partial"))
      .collect();

    const claimScrubQueue = openCharges.length + partialCharges.length;
    const denialsAtRisk = Math.round(claimScrubQueue * 0.35);
    const readyToSubmit = await ctx.db
      .query("posCharges")
      .withIndex("by_status", (q) => q.eq("status", "paid"))
      .collect();

    return {
      claimScrubQueue,
      denialsAtRisk,
      readyToSubmit: readyToSubmit.length,
      todayCollectionsCents: todaysPayments.reduce((sum, payment) => sum + payment.amountCents, 0),
      todayRefundsCents: todaysRefunds.reduce((sum, refund) => sum + refund.amountCents, 0),
      todayNetCollectionsCents:
        todaysPayments.reduce((sum, payment) => sum + payment.amountCents, 0) -
        todaysRefunds.reduce((sum, refund) => sum + refund.amountCents, 0),
    };
  },
});

export const getActiveDrawerSession = query({
  args: {},
  handler: async (ctx) => {
    const openSessions = await ctx.db
      .query("posDrawerSessions")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    return openSessions.sort((left, right) => right.openedAt - left.openedAt)[0] ?? null;
  },
});

export const getRecentDrawerSessions = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("posDrawerSessions")
      .withIndex("by_opened_at")
      .order("desc")
      .take(10);

    return sessions;
  },
});

export const openDrawerSession = mutation({
  args: {
    openingFloatCents: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx);
    if (!actor.canManage) {
      throw new Error("Unauthorized: role cannot open POS drawer.");
    }

    const existing = await ctx.db
      .query("posDrawerSessions")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    if (existing.length > 0) {
      throw new Error("A drawer session is already open.");
    }

    const closedSessions = await ctx.db
      .query("posDrawerSessions")
      .withIndex("by_status", (q) => q.eq("status", "closed"))
      .collect();

    const pendingVarianceSession = closedSessions
      .sort((left, right) => (right.closedAt ?? 0) - (left.closedAt ?? 0))
      .find(
        (session) =>
          Math.abs(session.varianceCents ?? 0) > 0 &&
          !session.varianceAcknowledged
      );

    if (pendingVarianceSession) {
      throw new Error(
        "Previous drawer variance must be acknowledged before opening a new session."
      );
    }

    const openingFloatCents = centsFromDollars(args.openingFloatCents);

    if (openingFloatCents < 0) {
      throw new Error("Opening float cannot be negative.");
    }

    const sessionId = await ctx.db.insert("posDrawerSessions", {
      openedBy: actor.name,
      openedAt: Date.now(),
      openingFloatCents,
      status: "open",
    });

    return { sessionId };
  },
});

export const closeDrawerSession = mutation({
  args: {
    sessionId: v.id("posDrawerSessions"),
    actualCashCents: v.number(),
    closeNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx);
    if (!actor.canManage) {
      throw new Error("Unauthorized: role cannot close POS drawer.");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Drawer session not found.");
    if (session.status !== "open") throw new Error("Drawer session is already closed.");

    const [cashPayments, cashRefunds] = await Promise.all([
      ctx.db
        .query("posPayments")
        .withIndex("by_collected_at", (q) => q.gte("collectedAt", session.openedAt))
        .filter((q) => q.eq(q.field("method"), "cash"))
        .collect(),
      ctx.db
        .query("posRefunds")
        .withIndex("by_refunded_at", (q) => q.gte("refundedAt", session.openedAt))
        .collect(),
    ]);

    const refundedPaymentIds = new Set(cashPayments.map((payment) => payment._id));
    const relevantCashRefunds = cashRefunds.filter((refund) => refundedPaymentIds.has(refund.paymentId));

    const cashInCents = cashPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
    const cashOutCents = relevantCashRefunds.reduce((sum, refund) => sum + refund.amountCents, 0);
    const expectedCashCents = session.openingFloatCents + cashInCents - cashOutCents;
    const actualCashCents = centsFromDollars(args.actualCashCents);
    const varianceCents = actualCashCents - expectedCashCents;

    await ctx.db.patch(session._id, {
      status: "closed",
      closedBy: actor.name,
      closedAt: Date.now(),
      expectedCashCents,
      actualCashCents,
      varianceCents,
      closeNote: args.closeNote?.trim() ? args.closeNote.trim().slice(0, 160) : undefined,
      varianceAcknowledged: varianceCents === 0,
      varianceAcknowledgedBy: varianceCents === 0 ? actor.name : undefined,
      varianceAcknowledgedAt: varianceCents === 0 ? Date.now() : undefined,
      varianceAcknowledgementNote: undefined,
    });

    return {
      expectedCashCents,
      actualCashCents,
      varianceCents,
      cashInCents,
      cashOutCents,
    };
  },
});

export const acknowledgeDrawerVariance = mutation({
  args: {
    sessionId: v.id("posDrawerSessions"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx);
    if (!actor.canManage) {
      throw new Error("Unauthorized: role cannot acknowledge drawer variance.");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Drawer session not found.");
    if (session.status !== "closed") {
      throw new Error("Only closed drawer sessions can be acknowledged.");
    }

    const varianceCents = session.varianceCents ?? 0;
    if (Math.abs(varianceCents) === 0) {
      throw new Error("Drawer variance is zero and does not require acknowledgement.");
    }

    await ctx.db.patch(session._id, {
      varianceAcknowledged: true,
      varianceAcknowledgedBy: actor.name,
      varianceAcknowledgedAt: Date.now(),
      varianceAcknowledgementNote: args.note?.trim()
        ? args.note.trim().slice(0, 160)
        : undefined,
    });

    return { acknowledged: true };
  },
});

export const getDailyCloseout = query({
  args: {
    dayStart: v.optional(v.number()),
    dayEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const dayStart = args.dayStart ?? new Date(new Date(now).toDateString()).getTime();
    const dayEnd = args.dayEnd ?? dayStart + 24 * 60 * 60 * 1000;

    const [payments, refunds] = await Promise.all([
      ctx.db
        .query("posPayments")
        .withIndex("by_collected_at", (q) => q.gte("collectedAt", dayStart))
        .filter((q) => q.lt(q.field("collectedAt"), dayEnd))
        .collect(),
      ctx.db
        .query("posRefunds")
        .withIndex("by_refunded_at", (q) => q.gte("refundedAt", dayStart))
        .filter((q) => q.lt(q.field("refundedAt"), dayEnd))
        .collect(),
    ]);

    const totalsByMethod = {
      card: 0,
      cash: 0,
      check: 0,
      hsa: 0,
      other: 0,
    };

    for (const payment of payments) {
      totalsByMethod[payment.method] += payment.amountCents;
    }

    const totalPaymentsCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    const totalRefundsCents = refunds.reduce((sum, refund) => sum + refund.amountCents, 0);

    return {
      window: { dayStart, dayEnd },
      payments: payments.sort((left, right) => right.collectedAt - left.collectedAt),
      refunds: refunds.sort((left, right) => right.refundedAt - left.refundedAt),
      totalsByMethod,
      summary: {
        totalPaymentsCents,
        totalRefundsCents,
        netCents: totalPaymentsCents - totalRefundsCents,
      },
    };
  },
});
