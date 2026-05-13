// convex/insurance.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const discoverSecondaryCoverage = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId);
    if (!patient) throw new Error("Patient not found");

    const seed = Array.from(args.patientId).reduce((total, character) => total + character.charCodeAt(0), 0);
    // Determine if we "find" something (40% chance)
    const found = seed % 10 >= 6;

    if (found) {
      // You could actually update the database here if you wanted, 
      // but for now, we'll just return the simulated data.
      return {
        success: true,
        provider: "NJ FamilyCare (Medicaid)",
        policyNumber: "NJ-MED-8827341",
        groupNumber: "STATE-001",
        coPay: 0,
      };
    }

    return { success: false };
  },
});

export const verifyInsuranceByEncounter = mutation({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const coverage = await ctx.db
      .query("insurance")
      .withIndex("by_patient", (q) => q.eq("patientId", encounter.patientId))
      .unique();

    if (!coverage) {
      return "No Insurance Record";
    }

    const normalizedPolicy = coverage.policyNumber.replace(/\s+/g, "").toUpperCase();
    const isVerified = normalizedPolicy.length >= 6 && !normalizedPolicy.startsWith("DENY");
    const now = Date.now();
    const nextStatus = isVerified ? "verified" : "denied";

    await ctx.db.patch(coverage._id, {
      status: nextStatus,
      lastVerified: now,
    });

    return isVerified ? "Verified" : "Denied";
  },
});

export const createInsuranceRecordForEncounter = mutation({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const existing = await ctx.db
      .query("insurance")
      .withIndex("by_patient", (q) => q.eq("patientId", encounter.patientId))
      .first();

    if (existing) {
      return { created: false, insuranceId: existing._id };
    }

    const nowSuffix = Date.now().toString().slice(-6);
    const insuranceId = await ctx.db.insert("insurance", {
      patientId: encounter.patientId,
      provider: "Pending Verification",
      policyNumber: `TEMP-${nowSuffix}`,
      groupNumber: "UNASSIGNED",
      status: "pending",
      planType: "Unknown",
      coPayAmount: 0,
      authorizationRequired: false,
      authStatus: "not_started",
      lastVerified: undefined,
    });

    return { created: true, insuranceId };
  },
});

export const getCoverageByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("insurance")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .first();
  },
});

export const upsertCoverageByPatient = mutation({
  args: {
    patientId: v.id("patients"),
    provider: v.string(),
    policyNumber: v.string(),
    groupNumber: v.optional(v.string()),
    planType: v.optional(v.string()),
    coPayAmount: v.optional(v.number()),
    authorizationRequired: v.optional(v.boolean()),
    status: v.optional(v.union(v.literal("pending"), v.literal("verified"), v.literal("denied"))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("insurance")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .first();

    const payload = {
      patientId: args.patientId,
      provider: args.provider.trim(),
      policyNumber: args.policyNumber.trim(),
      groupNumber: args.groupNumber?.trim() || "",
      planType: args.planType?.trim() || "Unknown",
      coPayAmount: args.coPayAmount ?? 0,
      authorizationRequired: args.authorizationRequired ?? false,
      status: args.status ?? "pending",
      lastVerified: existing?.lastVerified,
      authStatus: existing?.authStatus,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("insurance", payload);
  },
});

export const getPortalWorkbench = query({
  args: {},
  handler: async (ctx) => {
    // POS tables no longer exist; removed posCharges query
    const [encounters, insuranceRows, patients, claims] = await Promise.all([
      ctx.db.query("encounters").collect(),
      ctx.db.query("insurance").collect(),
      ctx.db.query("patients").collect(),
      ctx.db.query("insuranceClaims").collect(),
    ]);

    const patientMap = new Map(patients.map((patient) => [patient._id, patient]));
    const insuranceByPatient = new Map(insuranceRows.map((row) => [row.patientId, row]));
    const claimByEncounter = new Map(claims.map((claim) => [claim.encounterId, claim]));

    // Charge data no longer available - POS tables removed
    const chargesByEncounter = new Map<string, { totalChargeCents: number; openBalanceCents: number }>();

    const eligibilityQueue = encounters
      .filter((encounter) => encounter.status !== "discharged")
      .slice(0, 40)
      .map((encounter) => {
        const insurance = insuranceByPatient.get(encounter.patientId) ?? null;
        const patient = patientMap.get(encounter.patientId) ?? null;
        return {
          encounterId: encounter._id,
          patientId: encounter.patientId,
          patientName: encounter.patientName ?? patient?.name ?? "Unknown Patient",
          mrn: patient?.mrn ?? "--",
          payer: insurance?.provider ?? "Self-Pay",
          hasInsurance: Boolean(insurance),
          policyNumber: insurance?.policyNumber ?? "--",
          status: insurance?.status ?? "pending",
          authStatus: insurance?.authStatus ?? "not_started",
          authorizationRequired: insurance?.authorizationRequired ?? false,
          lastVerified: insurance?.lastVerified,
          chiefComplaint: encounter.chiefComplaint,
          acuity: encounter.acuity,
        };
      })
      .sort((a, b) => {
        const aScore = a.status === "denied" ? 0 : a.status === "pending" ? 1 : 2;
        const bScore = b.status === "denied" ? 0 : b.status === "pending" ? 1 : 2;
        return aScore - bScore;
      });

    const claimCandidates = encounters
      .filter((encounter) => encounter.status !== "triage")
      .map((encounter) => {
        const chargeSummary = chargesByEncounter.get(encounter._id) ?? { totalChargeCents: 0, openBalanceCents: 0 };
        const existingClaim = claimByEncounter.get(encounter._id) ?? null;
        const patient = patientMap.get(encounter.patientId) ?? null;
        const insurance = insuranceByPatient.get(encounter.patientId) ?? null;

        return {
          encounterId: encounter._id,
          patientId: encounter.patientId,
          patientName: encounter.patientName ?? patient?.name ?? "Unknown Patient",
          payer: insurance?.provider ?? "Self-Pay",
          totalChargeCents: chargeSummary.totalChargeCents,
          openBalanceCents: chargeSummary.openBalanceCents,
          hasClaim: Boolean(existingClaim),
        };
      })
      .filter((row) => row.totalChargeCents > 0)
      .slice(0, 50);

    const claimsQueue = claims
      .map((claim) => {
        const encounter = encounters.find((item) => item._id === claim.encounterId);
        const patient = patientMap.get(claim.patientId) ?? null;
        const payer = claim.insuranceId
          ? insuranceRows.find((row) => row._id === claim.insuranceId)?.provider
          : insuranceByPatient.get(claim.patientId)?.provider;

        return {
          claimId: claim._id,
          encounterId: claim.encounterId,
          patientName: encounter?.patientName ?? patient?.name ?? "Unknown Patient",
          payer: payer ?? "Self-Pay",
          status: claim.status,
          totalChargeCents: claim.totalChargeCents,
          allowedAmountCents: claim.allowedAmountCents,
          denialReason: claim.denialReason,
          payerControlNumber: claim.payerControlNumber,
          submittedAt: claim.submittedAt,
          respondedAt: claim.respondedAt,
          updatedAt: claim.updatedAt,
          denialRisk: Math.min(
            95,
            Math.max(
              5,
              Math.round(
                (claim.status === "denied" ? 70 : claim.status === "scrub" ? 45 : 20) +
                  (claim.totalChargeCents > 100000 ? 15 : 0) +
                  (claim.allowedAmountCents === undefined ? 10 : 0)
              )
            )
          ),
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 80);

    return {
      metrics: {
        pendingEligibility: eligibilityQueue.filter((row) => row.status === "pending").length,
        deniedEligibility: eligibilityQueue.filter((row) => row.status === "denied").length,
        claimsInScrub: claimsQueue.filter((row) => row.status === "scrub").length,
        submittedClaims: claimsQueue.filter((row) => row.status === "submitted").length,
        deniedClaims: claimsQueue.filter((row) => row.status === "denied").length,
      },
      eligibilityQueue,
      claimCandidates,
      claimsQueue,
    };
  },
});

export const createClaimDraft = mutation({
  args: {
    encounterId: v.id("encounters"),
    actor: v.string(),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    // POS tables no longer exist; removed posCharges query
    const [insurance, existingClaim] = await Promise.all([
      ctx.db
        .query("insurance")
        .withIndex("by_patient", (q) => q.eq("patientId", encounter.patientId))
        .first(),
      ctx.db
        .query("insuranceClaims")
        .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
        .first(),
    ]);

    // Default charge amount for billing (POS system removed)
    const totalChargeCents = 10000;
    if (totalChargeCents <= 0) {
      throw new Error("No billable charges were found for this encounter.");
    }

    const now = Date.now();
    if (existingClaim) {
      await ctx.db.patch(existingClaim._id, {
        totalChargeCents,
        insuranceId: insurance?._id,
        status: existingClaim.status === "paid" ? "paid" : "scrub",
        updatedAt: now,
        updatedBy: args.actor,
      });
      return existingClaim._id;
    }

    const claimId = await ctx.db.insert("insuranceClaims", {
      encounterId: encounter._id,
      patientId: encounter.patientId,
      insuranceId: insurance?._id,
      status: "scrub",
      totalChargeCents,
      createdAt: now,
      updatedAt: now,
      updatedBy: args.actor,
    });

    return claimId;
  },
});

export const submitClaim = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    actor: v.string(),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.status === "paid") throw new Error("Claim already paid");

    const now = Date.now();
    await ctx.db.patch(args.claimId, {
      status: "submitted",
      submittedAt: now,
      updatedAt: now,
      updatedBy: args.actor,
      denialReason: undefined,
    });

    return { ok: true };
  },
});

export const postClaimResponse = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    actor: v.string(),
    outcome: v.union(v.literal("accepted"), v.literal("denied")),
    denialReason: v.optional(v.string()),
    allowedAmountCents: v.optional(v.number()),
    payerControlNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");

    const now = Date.now();
    await ctx.db.patch(args.claimId, {
      status: args.outcome,
      denialReason: args.outcome === "denied" ? args.denialReason ?? "CO-16: Missing information" : undefined,
      allowedAmountCents: args.allowedAmountCents,
      payerControlNumber: args.payerControlNumber,
      respondedAt: now,
      updatedAt: now,
      updatedBy: args.actor,
    });

    return { ok: true };
  },
});

export const markClaimPaid = mutation({
  args: {
    claimId: v.id("insuranceClaims"),
    actor: v.string(),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");

    await ctx.db.patch(args.claimId, {
      status: "paid",
      updatedAt: Date.now(),
      updatedBy: args.actor,
    });

    return { ok: true };
  },
});

export const requestPriorAuthorization = mutation({
  args: {
    encounterId: v.id("encounters"),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const insurance = await ctx.db
      .query("insurance")
      .withIndex("by_patient", (q) => q.eq("patientId", encounter.patientId))
      .first();

    if (!insurance) throw new Error("Insurance record not found");

    await ctx.db.patch(insurance._id, {
      authStatus: "requested",
    });

    return { ok: true };
  },
});