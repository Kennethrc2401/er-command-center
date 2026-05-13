import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Analytics & Compliance Module
 * HEDIS metrics, clinical variance tracking, coding audits
 */

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get HEDIS metrics for period
 */
export const getHedisMetrics = query({
  args: { measurementPeriod: v.string() },
  handler: async (ctx, args) => {
    const metrics = await ctx.db
      .query("hedisMetricsCapture")
      .withIndex("by_measurement_period", (q) => q.eq("measurementPeriod", args.measurementPeriod))
      .collect();

    // Calculate compliance stats
    const compliant = metrics.filter((m) => m.complianceStatus === "compliant").length;
    const nonCompliant = metrics.filter((m) => m.complianceStatus === "non_compliant").length;
    const notApplicable = metrics.filter((m) => m.complianceStatus === "not_applicable").length;

    const complianceRate = metrics.length > 0 ? (compliant / (metrics.length - notApplicable)) * 100 : 0;

    return {
      period: args.measurementPeriod,
      totalCases: metrics.length,
      compliantCases: compliant,
      nonCompliantCases: nonCompliant,
      notApplicableCases: notApplicable,
      complianceRate: Math.round(complianceRate),
      metrics,
    };
  },
});

/**
 * Get clinical variance flags
 */
export const getClinicalVariances = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clinicalVarianceTracking")
      .filter((q) => q.eq(q.field("patientId"), args.patientId))
      .order("desc")
      .collect();
  },
});

/**
 * Get variance by type
 */
export const getVariancesByType = query({
  args: { varianceType: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clinicalVarianceTracking")
      .withIndex("by_variance_type", (q) => q.eq("varianceType", args.varianceType as any))
      .collect();
  },
});

/**
 * Get coding audit history
 */
export const getCodingAudits = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("codingAuditLog")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .order("desc")
      .collect();
  },
});

/**
 * Get audit findings by status
 */
export const getPendingAuditFindings = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("codingAuditLog")
      .withIndex("by_status", (q) => q.eq("status", "requires_correction"))
      .order("desc")
      .take(50);
  },
});

/**
 * Get compliance dashboard metrics
 */
export const getComplianceDashboard = query({
  handler: async (ctx) => {
    const [hedisMetrics, variances, auditFindings] = await Promise.all([
      ctx.db.query("hedisMetricsCapture").collect(),
      ctx.db.query("clinicalVarianceTracking").collect(),
      ctx.db
        .query("codingAuditLog")
        .withIndex("by_status", (q) => q.eq("status", "requires_correction"))
        .collect(),
    ]);

    const hedisCompliance = hedisMetrics.length > 0
      ? (hedisMetrics.filter((m) => m.complianceStatus === "compliant").length / hedisMetrics.length) * 100
      : 0;

    const highSeverityVariances = variances.filter((v) => v.severity === "high").length;

    return {
      hedisComplianceRate: Math.round(hedisCompliance),
      totalHedisCases: hedisMetrics.length,
      clinicalVariancesCount: variances.length,
      highSeverityVariancesCount: highSeverityVariances,
      pendingAuditFindingsCount: auditFindings.length,
      criticalFindingsCount: auditFindings.filter((a) => a.criticalFindingsCount > 0).length,
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Capture HEDIS metric compliance
 */
export const captureHedisMetric = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    metricTypes: v.array(v.string()),
    measurementPeriod: v.string(),
    complianceStatus: v.union(v.literal("compliant"), v.literal("non_compliant"), v.literal("not_applicable")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const metricId = await ctx.db.insert("hedisMetricsCapture", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      metricType: args.metricTypes,
      measurementPeriod: args.measurementPeriod,
      complianceStatus: args.complianceStatus,
      capturedAt: Date.now(),
      capturedBy: "hedis-capture-service",
      notes: args.notes,
    });

    return metricId;
  },
});

/**
 * Track clinical variance (e.g., high antibiotic use, unusual procedures)
 */
export const flagClinicalVariance = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    varianceType: v.union(
      v.literal("high_antibiotic_use"),
      v.literal("unusual_procedure"),
      v.literal("extended_los"),
      v.literal("high_readmission_risk"),
      v.literal("medication_allergy_conflict")
    ),
    varianceDescription: v.string(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  },
  handler: async (ctx, args) => {
    const varianceId = await ctx.db.insert("clinicalVarianceTracking", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      varianceType: args.varianceType,
      varianceDescription: args.varianceDescription,
      severity: args.severity,
      flaggedAt: Date.now(),
      flaggedBy: "variance-detection-engine",
    });

    // Add to encounter's variance flags
    const encounter = await ctx.db.get(args.encounterId);
    if (encounter && encounter.clinicalVarianceFlags) {
      const updatedFlags = [...encounter.clinicalVarianceFlags, args.varianceType];
      await ctx.db.patch(args.encounterId, {
        clinicalVarianceFlags: updatedFlags,
      });
    } else {
      await ctx.db.patch(args.encounterId, {
        clinicalVarianceFlags: [args.varianceType],
      });
    }

    return varianceId;
  },
});

/**
 * Update variance with root cause analysis
 */
export const updateVarianceAnalysis = mutation({
  args: {
    varianceId: v.id("clinicalVarianceTracking"),
    rootCauseAnalysis: v.string(),
    interventionPlan: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.varianceId, {
      rootCauseAnalysis: args.rootCauseAnalysis,
      interventionPlan: args.interventionPlan,
    });

    return { status: "updated" };
  },
});

/**
 * Resolve variance
 */
export const resolveVariance = mutation({
  args: {
    varianceId: v.id("clinicalVarianceTracking"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.varianceId, {
      resolvedAt: Date.now(),
    });

    return { status: "resolved" };
  },
});

/**
 * Create coding audit (pre-bill, random sample, or high-risk)
 */
export const createCodingAudit = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    cptCodesReviewed: v.array(v.string()),
    icdCodesReviewed: v.array(v.string()),
    auditType: v.union(
      v.literal("pre_bill"),
      v.literal("random_sample"),
      v.literal("high_risk"),
      v.literal("post_payment")
    ),
  },
  handler: async (ctx, args) => {
    // Mock: Simulate automated audit checks
    const findings: string[] = [];
    let criticalFindingsCount = 0;

    if (args.cptCodesReviewed.length === 0) {
      findings.push("No CPT codes documented");
      criticalFindingsCount++;
    }

    if (args.icdCodesReviewed.length === 0) {
      findings.push("No diagnosis codes found");
      criticalFindingsCount++;
    }

    if (args.cptCodesReviewed.some((c) => c.includes("error"))) {
      findings.push("Invalid CPT code format detected");
      criticalFindingsCount++;
    }

    const auditId = await ctx.db.insert("codingAuditLog", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      coderName: "automated-audit-engine",
      coderRole: "SYSTEM",
      cptCodesReviewed: args.cptCodesReviewed,
      icdCodesReviewed: args.icdCodesReviewed,
      auditType: args.auditType,
      findingsCount: findings.length,
      criticalFindingsCount,
      findings: findings.length > 0 ? findings : undefined,
      auditedAt: Date.now(),
      status: findings.length > 0 ? "requires_correction" : "approved",
    });

    return auditId;
  },
});

/**
 * Review coding audit findings
 */
export const reviewCodingAudit = mutation({
  args: {
    auditId: v.id("codingAuditLog"),
    status: v.union(v.literal("approved"), v.literal("requires_correction")),
    reviewerName: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.auditId, {
      status: args.status,
      reviewedAt: Date.now(),
      reviewedBy: args.reviewerName,
    });

    return { status: "reviewed" };
  },
});

/**
 * Get utilization analysis for procedures
 */
export const getProcedureUtilizationAnalysis = query({
  handler: async (ctx) => {
    const cptCodes = await ctx.db.query("cptCodeCaptures").collect();

    // Group by code
    const utilization: Record<string, { count: number; description: string }> = {};

    for (const cpt of cptCodes) {
      if (!utilization[cpt.cptCode]) {
        utilization[cpt.cptCode] = {
          count: 0,
          description: cpt.cptDescription,
        };
      }
      utilization[cpt.cptCode].count++;
    }

    // Convert to array and sort by frequency
    const analysis = Object.entries(utilization)
      .map(([code, data]) => ({
        cptCode: code,
        description: data.description,
        usageCount: data.count,
      }))
      .sort((a, b) => b.usageCount - a.usageCount);

    return analysis;
  },
});

/**
 * Get medication utilization variance
 */
export const getMedicationUtilizationVariance = query({
  handler: async (ctx) => {
    // Mock medication utilization variance analysis
    // In production, would query actual medications prescribed during period
    const variance = {
      totalMedicationsOrdered: 145,
      antibiotiOrderCount: 42,
      antibioticUsageRate: 29,
      highUsageAlert: false,
      recommendation: "Antibiotic usage within normal parameters",
    };

    return variance;
  },
});

/**
 * Get readmission risk analysis
 */
export const getReadmissionRiskAnalysis = query({
  handler: async (ctx) => {
    const discharges = await ctx.db.query("discharges").collect();

    // Mock: Calculate 30-day readmission risk factors
    const highRiskFactors = {
      lowSocialSupport: 0,
      complexMedications: 0,
      multipleComorbidities: 0,
      poorDischargeInstructions: 0,
    };

    for (const discharge of discharges) {
      if (!discharge.followUp || discharge.followUp.length < 20) {
        highRiskFactors.poorDischargeInstructions++;
      }
    }

    return {
      totalDischarges: discharges.length,
      highRiskDischarges: highRiskFactors.poorDischargeInstructions,
      riskRate: Math.round((highRiskFactors.poorDischargeInstructions / discharges.length) * 100),
      recommendations: [
        "Enhance discharge planning processes",
        "Implement 48-hour post-discharge phone follow-up",
        "Coordinate care transitions with primary care providers",
      ],
    };
  },
});

/**
 * Internal cron job: Run provider fairness drift detection sweep
 */
export const runProviderFairnessSweep = mutation({
  handler: async (ctx) => {
    // Check for variation in clinical outcomes across providers
    const encounters = await ctx.db.query("encounters").collect();
    const variances = await ctx.db.query("clinicalVarianceTracking").collect();

    // Group variances by provider
    const providerVariances: Record<string, number> = {};
    for (const variance of variances) {
      const encounterData = encounters.find((e) => e._id === variance.encounterId);
      if (encounterData && encounterData.assignedProvider) {
        providerVariances[encounterData.assignedProvider] =
          (providerVariances[encounterData.assignedProvider] || 0) + 1;
      }
    }

    // Calculate average variance rate
    const totalProviders = Object.keys(providerVariances).length;
    const totalVariances = Object.values(providerVariances).reduce((a, b) => a + b, 0);
    const avgVarianceRate = totalProviders > 0 ? totalVariances / totalProviders : 0;

    // Identify outliers (providers with 2x+ average variance rate)
    const outliers = Object.entries(providerVariances)
      .filter(([_, count]) => count > avgVarianceRate * 2)
      .map(([provider, count]) => ({ provider, varianceCount: count }));

    // Log fairness monitoring results
    return {
      sweepDate: Date.now(),
      providersMonitored: totalProviders,
      totalVariancesDetected: totalVariances,
      avgVarianceRate: Math.round(avgVarianceRate * 100) / 100,
      fairnessOutliers: outliers,
      status: outliers.length > 0 ? "review_recommended" : "compliant",
    };
  },
});
