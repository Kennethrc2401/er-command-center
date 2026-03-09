// convex/insurance.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const discoverSecondaryCoverage = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    // Determine if we "find" something (40% chance)
    const found = Math.random() > 0.6;

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