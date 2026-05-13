import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
  args: { medicationId: v.id("medications") },
  handler: async (ctx, args) => {
    const med = await ctx.db.get(args.medicationId);
    if (!med) throw new Error("Medication record not found");
    await ctx.db.patch(args.medicationId, {
      status: "administered",
      adminTime: Date.now(),
      adminBy: "Automated MAR",
    });
    return { success: true, medicationName: med.name };
  },
});

export const createOrder = mutation({
  args: {
    patientId: v.id("patients"),
    encounterId: v.id("encounters"),
    name: v.string(),
    dosage: v.optional(v.string()),
    route: v.optional(v.string()),
    orderedBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("medications", {
      patientId: args.patientId,
      encounterId: args.encounterId,
      name: args.name,
      dosage: args.dosage,
      route: args.route,
      orderedBy: args.orderedBy,
      status: "ordered",
      createdAt: Date.now(),
    });
  },
});