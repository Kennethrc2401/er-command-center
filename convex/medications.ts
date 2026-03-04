import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Fetch all meds for a specific visit
export const getByEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("medications")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
  },
});

export const administer = mutation({
  args: { 
    medicationId: v.id("medications") 
  },
  handler: async (ctx, args) => {
    const { medicationId } = args;

    // 1. Verify the medication exists
    const med = await ctx.db.get(medicationId);
    if (!med) throw new Error("Medication record not found");

    // 2. Update the record with administration details
    await ctx.db.patch(medicationId, {
      status: "administered",
      adminTime: Date.now(),
      // Hardcoded for your profile as the primary RN
      adminBy: "Sophia R, RN", 
    });

    return { success: true, medicationName: med.name };
  },
});

export const createOrder = mutation({
  args: {
    patientId: v.id("patients"),
    encounterId: v.id("encounters"),
    name: v.string(),
    dosage: v.string(),
    route: v.string(),
    orderedBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("medications", {
      ...args,
      status: "ordered",
    });
  },
});