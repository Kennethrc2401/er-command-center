import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Workflow Automation Module
 * ADT events, referral routing to specialists, auto-discharge triggers
 */

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get ADT event history for encounter
 */
export const getAdtEventHistory = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("adtEventLog")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .order("desc")
      .collect();
  },
});

/**
 * Get pending referrals for encounter
 */
export const getPendingReferrals = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("referralRouting")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});

/**
 * Get referrals by specialty
 */
export const getReferralsBySpecialty = query({
  args: { specialty: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("referralRouting")
      .withIndex("by_specialty", (q) => q.eq("specialtyRequested", args.specialty))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});

/**
 * Get failed ADT events (for retry queue)
 */
export const getFailedAdtEvents = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("adtEventLog")
      .withIndex("by_event_type", (q) => q.eq("eventType", "discharge"))
      .filter((q) => q.eq(q.field("status"), "failed"))
      .order("desc")
      .take(20);
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Publish ADT discharge event to Epic (auto-triggers on discharge)
 */
export const publishAdtDischargeEvent = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    // Mock: Simulate ADT HL7 message generation
    const hl7Message = generateAdtDischargeMessage(encounter);

    // Log the event
    const eventId = await ctx.db.insert("adtEventLog", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      eventType: "discharge",
      epicEventId: encounter.epicEncounterId,
      eventTimestamp: Date.now(),
      pushedToEpicAt: Date.now(),
      pushedBy: "discharge-automation-service",
      status: "sent", // Mock: assume success
      retryCount: 0,
      metadata: hl7Message,
    });

    // Update encounter
    await ctx.db.patch(args.encounterId, {
      adtEventPushed: true,
      adtEventPushedAt: Date.now(),
    });

    return { eventId, status: "published", message: hl7Message };
  },
});

/**
 * Publish ADT admit event to Epic
 */
export const publishAdtAdmitEvent = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    admitToUnit: v.string(),
    bedLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const hl7Message = generateAdtAdmitMessage(encounter, args.admitToUnit, args.bedLabel);

    const eventId = await ctx.db.insert("adtEventLog", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      eventType: "admit",
      epicEventId: encounter.epicEncounterId,
      eventTimestamp: Date.now(),
      pushedToEpicAt: Date.now(),
      pushedBy: "admission-automation-service",
      status: "sent",
      retryCount: 0,
      metadata: hl7Message,
    });

    await ctx.db.patch(args.encounterId, {
      adtEventPushed: true,
      adtEventPushedAt: Date.now(),
    });

    return { eventId, status: "published" };
  },
});

/**
 * Create referral routing request to specialist
 */
export const createSpecialistReferral = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    specialtyRequested: v.string(),
    referralType: v.union(v.literal("consult"), v.literal("follow_up"), v.literal("transfer")),
    preferredSchedule: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find available provider for specialty (mock: select first available)
    const availableProviders = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("status"), "ACTIVE"))
      .take(1);

    const referralId = await ctx.db.insert("referralRouting", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      specialtyRequested: args.specialtyRequested,
      referralType: args.referralType,
      routedToProvider: availableProviders.length > 0 ? availableProviders[0]._id : undefined,
      routedToProviderName: availableProviders.length > 0 ? availableProviders[0].name : "Unassigned",
      preferredSchedule: args.preferredSchedule,
      notes: args.notes,
      routedAt: Date.now(),
      routedBy: "referral-automation-service",
      status: "pending",
    });

    // Update encounter with referral info
    const encounter = await ctx.db.get(args.encounterId);
    if (encounter && encounter.referralRoutingReferrals) {
      const updatedReferrals = [
        ...encounter.referralRoutingReferrals,
        {
          specialtyRequested: args.specialtyRequested,
          routedTo: availableProviders.length > 0 ? availableProviders[0].name : undefined,
          routedAt: Date.now(),
        },
      ];
      await ctx.db.patch(args.encounterId, {
        referralRoutingReferrals: updatedReferrals,
      });
    }

    return referralId;
  },
});

/**
 * Accept referral as provider
 */
export const acceptReferral = mutation({
  args: {
    referralId: v.id("referralRouting"),
  },
  handler: async (ctx, args) => {
    const referral = await ctx.db.get(args.referralId);
    if (!referral) throw new Error("Referral not found");

    await ctx.db.patch(args.referralId, {
      status: "accepted",
      acceptedAt: Date.now(),
    });

    return { status: "accepted" };
  },
});

/**
 * Complete referral
 */
export const completeReferral = mutation({
  args: {
    referralId: v.id("referralRouting"),
    completionNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.referralId, {
      status: "completed",
      notes: args.completionNotes,
    });

    return { status: "completed" };
  },
});

/**
 * Auto-trigger bed turnover workflow on discharge
 */
export const triggerBedTurnoverWorkflow = mutation({
  args: {
    encounterId: v.id("encounters"),
    bedLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const previousDischarge = Date.now();

    // Create bed turnover history record
    const historyId = await ctx.db.insert("bedTurnoverHistory", {
      bedLabel: args.bedLabel,
      previousEncounterId: args.encounterId,
      previousDischargeAt: previousDischarge,
      nextEncounterId: "pending" as any, // Will be updated when next patient admitted
      nextAdmitAt: previousDischarge + 60 * 60 * 1000, // Estimate: 1 hour
      turnoverTimeMs: 0,
      turnoverStatus: "clean",
    });

    // Log the turnover initiation
    const logId = await ctx.db.insert("notes", {
      encounterId: args.encounterId,
      author: "bed-turnover-automation",
      category: "Procedure",
      content: `Bed turnover initiated for ${args.bedLabel} post-discharge. Standard cleaning protocol engaged.`,
      isTemplate: false,
    });

    return { historyId, logId, status: "workflow_triggered" };
  },
});

/**
 * Auto-route post-op patients to ICU observation
 */
export const autoRoutePostOpPatient = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    procedure: v.string(),
    acuity: v.number(),
  },
  handler: async (ctx, args) => {
    let routeUnit = "PACU"; // Post-Anesthesia Care Unit

    if (args.acuity >= 2) {
      routeUnit = "ICU";
    } else if (args.acuity === 1) {
      routeUnit = "CRITICAL";
    }

    // Create observation order
    const referralId = await ctx.db.insert("referralRouting", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      specialtyRequested: routeUnit,
      referralType: "transfer",
      routedAt: Date.now(),
      routedBy: "post-op-automation",
      status: "pending",
      notes: `Post-op routing for ${args.procedure} - Acuity: ${args.acuity}`,
    });

    await ctx.db.patch(args.encounterId, {
      assignedInpatientUnit: routeUnit,
    });

    return { referralId, routeUnit };
  },
});

/**
 * Retry failed ADT event
 */
export const retryFailedAdtEvent = mutation({
  args: {
    eventId: v.id("adtEventLog"),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    if (event.retryCount >= 5) {
      throw new Error("Max retry attempts exceeded");
    }

    await ctx.db.patch(args.eventId, {
      retryCount: event.retryCount + 1,
      status: "sent",
      pushedToEpicAt: Date.now(),
    });

    return { status: "retry_queued", attempt: event.retryCount + 1 };
  },
});

/**
 * Get workflow automation status
 */
export const getWorkflowStatus = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const [adtEvents, referrals] = await Promise.all([
      ctx.db
        .query("adtEventLog")
        .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
        .collect(),
      ctx.db
        .query("referralRouting")
        .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
        .collect(),
    ]);

    return {
      adtEventCount: adtEvents.length,
      adtSuccessCount: adtEvents.filter((e) => e.status === "sent").length,
      adtFailureCount: adtEvents.filter((e) => e.status === "failed").length,
      referralCount: referrals.length,
      pendingReferralCount: referrals.filter((r) => r.status === "pending").length,
      completedReferralCount: referrals.filter((r) => r.status === "completed").length,
    };
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateAdtDischargeMessage(encounter: any): string {
  // Mock HL7 ADT^A03 (discharge) message
  return `MSH|^~\\&|NEXUS|HOSPITAL|EPIC|HOSPITAL|${new Date().toISOString()}||ADT^A03|MSG${Date.now()}|P|2.5
PID|1||${encounter.patientId}||PATIENT^TEST||19800101|M
PV1|1|O|${encounter.location}|H|||${encounter.assignedProvider}`;
}

function generateAdtAdmitMessage(encounter: any, unit: string, bedLabel: string): string {
  // Mock HL7 ADT^A01 (admit) message
  return `MSH|^~\\&|NEXUS|HOSPITAL|EPIC|HOSPITAL|${new Date().toISOString()}||ADT^A01|MSG${Date.now()}|P|2.5
PID|1||${encounter.patientId}||PATIENT^TEST||19800101|M
PV1|1|I|${unit}^${bedLabel}^BED|H|||${encounter.assignedProvider}`;
}
