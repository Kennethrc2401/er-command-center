import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Real-Time Alerts & Routing Module
 * CDS Hooks, alert configuration, escalation tracking, stat order prioritization
 */

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get active alert configurations
 */
export const getActiveAlertConfigurations = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("alertConfigurations")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

/**
 * Get alert config by type
 */
export const getAlertConfigByType = query({
  args: { alertType: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("alertConfigurations")
      .withIndex("by_alert_type", (q) =>
        q.eq("alertType", args.alertType as "critical_lab" | "critical_vital" | "stat_order" | "deterioration_risk" | "high_readmission_risk" | "denial_risk")
      )
      .first();
  },
});

/**
 * Get escalation history for encounter
 */
export const getEscalationHistory = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("escalationTracks")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .order("desc")
      .collect();
  },
});

/**
 * Get pending escalations (not yet resolved)
 */
export const getPendingEscalations = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("escalationTracks")
      .filter((q) => q.eq(q.field("resolutionAt"), undefined))
      .order("desc")
      .take(50);
  },
});

/**
 * Get alerts by role
 */
export const getAlertsByRole = query({
  args: { role: v.union(v.literal("NURSE"), v.literal("DOCTOR"), v.literal("UNIT_COORDINATOR")) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("escalationTracks")
      .withIndex("by_routed_to_role", (q) => q.eq("routedToRole", args.role))
      .filter((q) => q.eq(q.field("resolutionAt"), undefined))
      .order("desc")
      .collect();
  },
});

/**
 * Get alert volume metrics
 */
export const getAlertMetrics = query({
  handler: async (ctx) => {
    const allEscalations = await ctx.db.query("escalationTracks").collect();

    const unacknowledged = allEscalations.filter((e) => !e.acknowledgedAt).length;
    const escalated = allEscalations.filter((e) => e.escalatedAt).length;
    const resolved = allEscalations.filter((e) => e.resolutionAt).length;

    const avgTimeToAcknowledge = allEscalations
      .filter((e) => e.acknowledgedAt && e.initialTriggerAt)
      .reduce((sum, e) => sum + (e.acknowledgedAt! - e.initialTriggerAt), 0) / Math.max(1, unacknowledged);

    return {
      totalAlerts: allEscalations.length,
      unacknowledgedCount: unacknowledged,
      escalatedCount: escalated,
      resolvedCount: resolved,
      avgTimeToAcknowledgeMs: Math.round(avgTimeToAcknowledge),
      avgTimeToAcknowledgeMin: Math.round(avgTimeToAcknowledge / 60000),
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create or update alert configuration
 */
export const configureAlert = mutation({
  args: {
    alertType: v.union(
      v.literal("critical_lab"),
      v.literal("critical_vital"),
      v.literal("stat_order"),
      v.literal("deterioration_risk"),
      v.literal("high_readmission_risk"),
      v.literal("denial_risk")
    ),
    routingRules: v.array(
      v.object({
        condition: v.string(),
        targetRole: v.union(v.literal("NURSE"), v.literal("DOCTOR"), v.literal("UNIT_COORDINATOR")),
        priority: v.union(v.literal("high"), v.literal("normal")),
        notifySecondaryRole: v.optional(v.union(v.literal("NURSE"), v.literal("DOCTOR"), v.literal("UNIT_COORDINATOR"))),
        escalateAfterMinutes: v.optional(v.number()),
      })
    ),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("alertConfigurations")
      .withIndex("by_alert_type", (q) => q.eq("alertType", args.alertType))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        routingRules: args.routingRules,
        isActive: args.isActive,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("alertConfigurations", {
        alertType: args.alertType,
        routingRules: args.routingRules,
        isActive: args.isActive,
        createdAt: Date.now(),
        createdBy: "admin-service",
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Route critical lab result alert
 */
export const routeCriticalLabAlert = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    labTestName: v.string(),
    result: v.string(),
    criticalRange: v.string(),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const config = await ctx.db
      .query("alertConfigurations")
      .withIndex("by_alert_type", (q) => q.eq("alertType", "critical_lab"))
      .first();

    if (!config || !config.isActive) {
      return { status: "alert_not_configured" };
    }

    // Route to primary target (usually Nurse or Doctor)
    const primaryRule = config.routingRules[0];
    if (!primaryRule) return { status: "no_routing_rule" };

    const escalationId = await ctx.db.insert("escalationTracks", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      alertId: `critical-lab-${args.encounterId}-${Date.now()}`,
      alertType: "critical_lab",
      initialTriggerAt: Date.now(),
      routedToRole: primaryRule.targetRole,
      escalatedAt:
        primaryRule.escalateAfterMinutes && primaryRule.escalateAfterMinutes > 0 ? undefined : Date.now(),
      escalatedToRole:
        primaryRule.notifySecondaryRole && primaryRule.escalateAfterMinutes && primaryRule.escalateAfterMinutes > 0
          ? primaryRule.notifySecondaryRole
          : undefined,
    });

    // Create notification
    await ctx.db.insert("notifications", {
      title: `Critical Lab Alert: ${args.labTestName}`,
      message: `${args.labTestName} result ${args.result} (critical range: ${args.criticalRange})`,
      type: "CRITICAL_LAB",
      severity: "critical",
      isRead: false,
      timestamp: Date.now(),
      patientId: args.patientId,
      encounterId: args.encounterId,
      suppressionKey: `critical-lab-${args.encounterId}`,
    });

    // Schedule auto-escalation if configured
    if (primaryRule.escalateAfterMinutes && primaryRule.escalateAfterMinutes > 0) {
      // In production, this would be a scheduled job
      // For now, just log it
    }

    return { escalationId, status: "routed", routedTo: primaryRule.targetRole };
  },
});

/**
 * Route deterioration risk alert
 */
export const routeDeteriorizationRiskAlert = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    riskScore: v.number(),
    riskTier: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    reasons: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.riskTier === "low") {
      return { status: "below_threshold" };
    }

    const config = await ctx.db
      .query("alertConfigurations")
      .withIndex("by_alert_type", (q) => q.eq("alertType", "deterioration_risk"))
      .first();

    if (!config || !config.isActive) {
      return { status: "alert_not_configured" };
    }

    const targetRole = args.riskTier === "high" ? "DOCTOR" : "NURSE";

    const escalationId = await ctx.db.insert("escalationTracks", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      alertId: `deterioration-${args.encounterId}-${Date.now()}`,
      alertType: "deterioration_risk",
      initialTriggerAt: Date.now(),
      routedToRole: targetRole,
    });

    // Create notification
    await ctx.db.insert("notifications", {
      title: `Patient Deterioration Risk (${args.riskTier})`,
      message: `Risk Score: ${args.riskScore} - ${args.reasons.join(", ")}`,
      type: "DETERIORATION_RISK",
      severity: args.riskTier === "high" ? "critical" : "high",
      isRead: false,
      timestamp: Date.now(),
      patientId: args.patientId,
      encounterId: args.encounterId,
      suppressionKey: `deterioration-${args.encounterId}`,
    });

    return { escalationId, status: "routed", routedTo: targetRole };
  },
});

/**
 * Acknowledge alert
 */
export const acknowledgeAlert = mutation({
  args: {
    escalationId: v.id("escalationTracks"),
    acknowledgedByName: v.string(),
  },
  handler: async (ctx, args) => {
    const escalation = await ctx.db.get(args.escalationId);
    if (!escalation) throw new Error("Escalation not found");

    await ctx.db.patch(args.escalationId, {
      acknowledgedAt: Date.now(),
      acknowledgedBy: args.acknowledgedByName,
    });

    return { status: "acknowledged", timeToAcknowledgeMs: Date.now() - escalation.initialTriggerAt };
  },
});

/**
 * Escalate alert to secondary role
 */
export const escalateAlert = mutation({
  args: {
    escalationId: v.id("escalationTracks"),
    escalateToRole: v.union(v.literal("NURSE"), v.literal("DOCTOR"), v.literal("UNIT_COORDINATOR")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.escalationId, {
      escalatedAt: Date.now(),
      escalatedToRole: args.escalateToRole,
    });

    return { status: "escalated" };
  },
});

/**
 * Resolve alert
 */
export const resolveAlert = mutation({
  args: {
    escalationId: v.id("escalationTracks"),
    resolutionDetails: v.string(),
  },
  handler: async (ctx, args) => {
    const escalation = await ctx.db.get(args.escalationId);
    if (!escalation) throw new Error("Escalation not found");

    const totalTimeMs = Date.now() - escalation.initialTriggerAt;

    await ctx.db.patch(args.escalationId, {
      resolutionAt: Date.now(),
      resolutionDetails: args.resolutionDetails,
    });

    return {
      status: "resolved",
      totalTimeMs,
      totalTimeMin: Math.round(totalTimeMs / 60000),
    };
  },
});

/**
 * Route STAT order (high priority)
 */
export const routeStatOrder = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    orderType: v.union(v.literal("LAB"), v.literal("IMAGING")),
    testName: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("alertConfigurations")
      .withIndex("by_alert_type", (q) => q.eq("alertType", "stat_order"))
      .first();

    if (!config || !config.isActive) {
      return { status: "alert_not_configured" };
    }

    const primaryRule = config.routingRules[0];

    const escalationId = await ctx.db.insert("escalationTracks", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      alertId: `stat-${args.encounterId}-${Date.now()}`,
      alertType: "stat_order",
      initialTriggerAt: Date.now(),
      routedToRole: primaryRule.targetRole,
    });

    // Create high-priority notification
    await ctx.db.insert("notifications", {
      title: `STAT ORDER: ${args.orderType}`,
      message: `${args.testName} - Priority: STAT`,
      type: "STAT_ORDER",
      severity: "critical",
      isRead: false,
      timestamp: Date.now(),
      patientId: args.patientId,
      encounterId: args.encounterId,
      suppressionKey: `stat-${args.encounterId}`,
    });

    return { escalationId, status: "routed", priority: "STAT" };
  },
});

/**
 * Get CDS Hooks recommendations for medications
 */
export const getCDSHooksRecommendations = query({
  args: { encounterId: v.id("encounters") },
  handler: async (_ctx, _args) => {
    // Mock CDS Hooks implementation
    // In production, would integrate with Epic's CDS Hooks endpoints
    void _ctx;
    void _args;
    const recommendations: Array<{
      hook: string;
      severity: "critical" | "warning";
      message: string;
      source: string;
    }> = [];

    // Check for known drug interactions based on common medications
    // Warfarin + Aspirin combination
    recommendations.push({
      hook: "medication-prescribe",
      severity: "critical",
      message: "High bleeding risk with Warfarin + Aspirin combination. Consider alternative.",
      source: "CDS_SERVICE",
    });

    // Lisinopril + NSAID combination
    recommendations.push({
      hook: "medication-prescribe",
      severity: "warning",
      message: "Potential ACE inhibitor + NSAID interaction. Monitor renal function.",
      source: "CDS_SERVICE",
    });

    return { recommendations };
  },
});

/**
 * Suppress duplicate alerts
 */
export const suppressDuplicateAlert = mutation({
  args: {
    suppressionKey: v.string(),
    suppressionWindowMinutes: v.number(),
  },
  handler: async (_ctx, args) => {
    // In production, implement alert suppression logic
    // For now, just return success
    void _ctx; // Silence unused variable warning
    return {
      status: "suppressed",
      key: args.suppressionKey,
      windowMinutes: args.suppressionWindowMinutes,
    };
  },
});
