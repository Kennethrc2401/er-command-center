// convex/insurance.ts
import { mutation } from "./_generated/server";
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
      throw new Error("No insurance record found for this encounter.");
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