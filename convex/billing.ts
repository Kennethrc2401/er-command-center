import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * AdvancedMD Billing Module
 * CPT code capture, denial risk assessment, and prior auth tracking
 */

// ============================================================================
// CPT CODE LIBRARY (Mock)
// ============================================================================

const CPT_CODE_REFERENCE: Record<string, { description: string; rvu: number; facility_fee: number }> = {
  "99213": {
    description: "Office visit, established patient, 20-29 minutes",
    rvu: 0.89,
    facility_fee: 25,
  },
  "99214": {
    description: "Office visit, established patient, 30-39 minutes",
    rvu: 1.34,
    facility_fee: 40,
  },
  "99215": {
    description: "Office visit, established patient, 40-54 minutes",
    rvu: 1.97,
    facility_fee: 55,
  },
  "71046": {
    description: "Chest X-ray, 2 views",
    rvu: 0.12,
    facility_fee: 35,
  },
  "36415": {
    description: "Venipuncture",
    rvu: 0.03,
    facility_fee: 5,
  },
  "99284": {
    description: "Emergency dept visit, moderate severity",
    rvu: 1.62,
    facility_fee: 80,
  },
};

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all CPT codes for an encounter
 */
export const getCptCodesForEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cptCodeCaptures")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
  },
});

/**
 * Get denial risk assessment for encounter
 */
export const getDenialRiskAssessment = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const assessment = await ctx.db
      .query("denialRiskAssessments")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .order("desc")
      .first();

    return assessment;
  },
});

/**
 * Get prior auth requests for patient
 */
export const getPriorAuthRequests = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("priorAuthorizationRequests")
      .filter((q) => q.eq(q.field("patientId"), args.patientId))
      .collect();
  },
});

/**
 * Get prior auth for specific encounter
 */
export const getPriorAuthForEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("priorAuthorizationRequests")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
  },
});

/**
 * Get billing summary for encounter
 */
export const getBillingSummary = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const [cptCodes, riskAssessment, priorAuthRequests] = await Promise.all([
      ctx.db
        .query("cptCodeCaptures")
        .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
        .collect(),
      ctx.db
        .query("denialRiskAssessments")
        .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
        .order("desc")
        .first(),
      ctx.db
        .query("priorAuthorizationRequests")
        .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
        .collect(),
    ]);

    // Calculate total charges
    let totalCharges = 0;
    for (const cpt of cptCodes) {
      const ref = CPT_CODE_REFERENCE[cpt.cptCode];
      if (ref) {
        totalCharges += ref.facility_fee * 2.5; // Mock multiplier
      }
    }

    return {
      cptCodes,
      riskAssessment,
      priorAuthRequests,
      totalCharges,
      cptCount: cptCodes.length,
      denialRiskScore: riskAssessment?.riskScore || 0,
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Capture CPT code for service rendered
 */
export const captureCptCode = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    cptCode: v.string(),
    linkedToService: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ref = CPT_CODE_REFERENCE[args.cptCode];
    if (!ref) throw new Error(`CPT code ${args.cptCode} not found in reference`);

    const codeId = await ctx.db.insert("cptCodeCaptures", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      cptCode: args.cptCode,
      cptDescription: ref.description,
      capturedAt: Date.now(),
      capturedBy: "billing-service",
      linkedToService: args.linkedToService,
    });

    // Update encounter with CPT codes
    const encounter = await ctx.db.get(args.encounterId);
    const existingCpts = encounter?.cptCodes || [];
    await ctx.db.patch(args.encounterId, {
      cptCodes: [...existingCpts, args.cptCode],
    });

    // Re-assess denial risk after adding code
    await assessDenialRisk(ctx, args.encounterId, args.patientId);

    return codeId;
  },
});

/**
 * Assess denial risk based on documentation and coding
 */
export const assessDenialRisk = async (ctx: any, encounterId: any, patientId: any) => {
  const encounter = await ctx.db.get(encounterId);
  if (!encounter) return;

  const riskFactors: string[] = [];
  let riskScore = 0;

  // Check for common risk factors
  if (!encounter.dischargeSummary) {
    riskFactors.push("missing_discharge_summary");
    riskScore += 15;
  }

  if (!encounter.assignedProvider) {
    riskFactors.push("no_provider_signature");
    riskScore += 20;
  }

  if (!encounter.cptCodes || encounter.cptCodes.length === 0) {
    riskFactors.push("no_cpt_codes_captured");
    riskScore += 25;
  }

  if (encounter.denialRiskFactors?.includes("documentation_gap")) {
    riskFactors.push("documentation_gap");
    riskScore += 30;
  }

  if (encounter.acuity >= 2 && encounter.vitals.hr > 100) {
    // High acuity + tachycardia but no explanation
    if (!encounter.chiefComplaint) {
      riskFactors.push("undocumented_chief_complaint");
      riskScore += 15;
    }
  }

  const riskTier = riskScore > 50 ? "high" : riskScore > 25 ? "medium" : "low";

  const recommendations: string[] = [];
  if (riskFactors.includes("missing_discharge_summary")) {
    recommendations.push("Complete discharge summary before billing");
  }
  if (riskFactors.includes("no_provider_signature")) {
    recommendations.push("Obtain provider attestation and signature");
  }
  if (riskFactors.includes("documentation_gap")) {
    recommendations.push("Add supporting documentation for medical necessity");
  }
  if (riskFactors.includes("undocumented_chief_complaint")) {
    recommendations.push("Document clinical justification for acuity level");
  }

  // Store or update assessment
  const existing = await ctx.db
    .query("denialRiskAssessments")
    .withIndex("by_encounter", (q: any) => q.eq("encounterId", encounterId))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      riskFactors,
      riskScore,
      riskTier,
      recommendations,
    });
  } else {
    await ctx.db.insert("denialRiskAssessments", {
      encounterId,
      patientId,
      riskFactors,
      riskScore,
      riskTier,
      recommendations,
      flaggedAt: Date.now(),
      flaggedBy: "denial-risk-engine",
    });
  }
};

/**
 * Auto-assess denial risk
 */
export const autoAssessDenialRisk = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    await assessDenialRisk(ctx, args.encounterId, args.patientId);
    return { status: "assessed" };
  },
});

/**
 * Resolve denial risk factor
 */
export const resolveDenialRiskFactor = mutation({
  args: {
    assessmentId: v.id("denialRiskAssessments"),
    resolvedFactor: v.string(),
  },
  handler: async (ctx, args) => {
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) throw new Error("Assessment not found");

    const resolved = assessment.resolvedFactors || [];
    if (!resolved.includes(args.resolvedFactor)) {
      resolved.push(args.resolvedFactor);
    }

    // Recalculate risk score
    const remaining = assessment.riskFactors.filter((f: string) => !resolved.includes(f));
    const newRiskScore = remaining.length * 15; // Mock calculation
    const newRiskTier = newRiskScore > 50 ? "high" : newRiskScore > 25 ? "medium" : "low";

    await ctx.db.patch(args.assessmentId, {
      resolvedFactors: resolved,
      riskFactors: remaining,
      riskScore: newRiskScore,
      riskTier: newRiskTier,
    });

    return { status: "resolved", newRiskScore, newRiskTier };
  },
});

/**
 * Request prior authorization
 */
export const requestPriorAuth = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    insuranceId: v.id("insurance"),
    procedureCode: v.string(),
    procedureDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const authId = await ctx.db.insert("priorAuthorizationRequests", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      insuranceId: args.insuranceId,
      procedureCode: args.procedureCode,
      procedureDescription: args.procedureDescription,
      requestedAt: Date.now(),
      requestedBy: "billing-service",
      status: "pending",
    });

    // Update encounter with prior auth status
    await ctx.db.patch(args.encounterId, {
      priorAuthStatus: "pending",
    });

    return authId;
  },
});

/**
 * Update prior auth status (simulates insurance response)
 */
export const updatePriorAuthStatus = mutation({
  args: {
    authId: v.id("priorAuthorizationRequests"),
    status: v.union(v.literal("approved"), v.literal("denied"), v.literal("expired")),
    approvalNumber: v.optional(v.string()),
    denialReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await ctx.db.get(args.authId);
    if (!auth) throw new Error("Prior auth request not found");

    await ctx.db.patch(args.authId, {
      status: args.status,
      approvalNumber: args.approvalNumber,
      denialReason: args.denialReason,
      respondedAt: Date.now(),
      expiresAt: args.status === "approved" ? Date.now() + 30 * 24 * 60 * 60 * 1000 : undefined, // 30 days
    });

    // Update encounter (only set valid status values)
    const validStatus = args.status === "expired" ? "pending" : args.status;
    await ctx.db.patch(auth.encounterId, {
      priorAuthStatus: validStatus,
    });

    return { status: "updated" };
  },
});

/**
 * Generate superbill from captured CPT codes
 */
export const generateSuperbill = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const [encounter, cptCodes] = await Promise.all([
      ctx.db.get(args.encounterId),
      ctx.db
        .query("cptCodeCaptures")
        .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
        .collect(),
    ]);

    if (!encounter) throw new Error("Encounter not found");

    let totalCharges = 0;
    const lineItems: Array<{
      cptCode: string;
      description: string;
      rvu: number;
      facilityFee: number;
      totalCharge: number;
    }> = [];

    for (const cpt of cptCodes) {
      const ref = CPT_CODE_REFERENCE[cpt.cptCode];
      if (ref) {
        const charge = ref.facility_fee * 2.5;
        lineItems.push({
          cptCode: cpt.cptCode,
          description: ref.description,
          rvu: ref.rvu,
          facilityFee: ref.facility_fee,
          totalCharge: charge,
        });
        totalCharges += charge;
      }
    }

    return {
      superbillDate: new Date().toISOString(),
      encounterId: args.encounterId,
      chiefComplaint: encounter.chiefComplaint,
      acuity: encounter.acuity,
      lineItems,
      totalCharges,
      estimatedAllowedAmount: totalCharges * 0.8, // Mock: 80% of charges
      patientResponsibility: totalCharges * 0.15,
    };
  },
});

/**
 * Calculate billing metrics for dashboard
 */
export const getBillingMetrics = query({
  handler: async (ctx) => {
    const [highRiskCases, pendingAuths, capturedCodes] = await Promise.all([
      ctx.db
        .query("denialRiskAssessments")
        .withIndex("by_risk_tier", (q) => q.eq("riskTier", "high"))
        .collect(),
      ctx.db
        .query("priorAuthorizationRequests")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect(),
      ctx.db.query("cptCodeCaptures").collect(),
    ]);

    const avgRiskScore = highRiskCases.reduce((sum, c) => sum + (c.riskScore || 0), 0) / (highRiskCases.length || 1);

    return {
      highRiskCasesCount: highRiskCases.length,
      pendingAuthorizationsCount: pendingAuths.length,
      capturedCodesCount: capturedCodes.length,
      averageRiskScoreForHighRisk: avgRiskScore,
      rcmStatus: Math.round((capturedCodes.length / Math.max(highRiskCases.length, 1)) * 100),
    };
  },
});
