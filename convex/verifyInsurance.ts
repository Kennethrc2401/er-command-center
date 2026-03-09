import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const verifyInsuranceByEncounter = mutation({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    // 1. Find the insurance record for this patient
    const insuranceRecord = await ctx.db
      .query("insurance")
      .withIndex("by_patient", (q) => q.eq("patientId", encounter.patientId))
      .first();

    if (!insuranceRecord) return "No Insurance Record Created";

    // 2. Mock Verification Logic (Policy numbers > 5 digits are "Valid")
    const isEligible = insuranceRecord.policyNumber.length > 5;
    const newStatus = isEligible ? "verified" : "denied";

    // 3. Update the separate insurance table
    await ctx.db.patch(insuranceRecord._id, {
      status: newStatus,
      lastVerified: Date.now(),
    });

    return isEligible ? "Verified" : "Policy Rejected";
  },
});