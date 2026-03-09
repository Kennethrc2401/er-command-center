import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Fetch a single patient by ID.
 */
export const getById = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.patientId);
  },
});

/**
 * Full-text search for patients by Name.
 * Uses the 'search_patients' index defined in schema.ts.
 */
export const search = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const trimSearch = args.searchTerm.trim();
    if (trimSearch === "") return [];

    return await ctx.db
      .query("patients")
      .withSearchIndex("search_patients", (q) => 
        q.search("name", trimSearch)
      )
      .take(10);
  },
});

/**
 * Updates basic patient demographics.
 */
export const updateDemographics = mutation({
  args: {
    patientId: v.id("patients"),
    name: v.optional(v.string()),
    gender: v.optional(v.string()),
    allergies: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { patientId, ...updates } = args;
    await ctx.db.patch(patientId, updates);
  },
});

export const updateCodeStatus = mutation({
  args: { 
    patientId: v.id("patients"), 
    status: v.union(v.literal("Full Code"), v.literal("DNR/DNI"), v.literal("DNR-Limited")) 
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.patientId, { codeStatus: args.status });
  },
});
// export default defineSchema({
//   patients: defineTable({
//     name: v.string(),
//     mrn: v.string(),
//     dob: v.string(),
//     gender: v.string(),
//     allergies: v.array(v.string()),
//     codeStatus: v.optional(v.union(
//       v.literal("Full Code"), 
//       v.literal("DNR/DNI"), 
//       v.literal("DNR-Limited")
//     )),
//     isHighRisk: v.optional(v.boolean()),
//     medicalHistory: v.optional(v.array(v.string())), // e.g., ["HTN", "DM", "CAD"]
//     socialHistory: v.optional(v.string()), // e.g., "Smokes 1 ppd, Lives alone"
//     familyHistory: v.optional(v.string()), // e.g., "Father had MI at 60"
//     vitals: v.optional(
//       v.object({
//         hr: v.number(),
//         bp: v.string(),
//         temp: v.number(),
//         spO2: v.number(),
//       })
//     )
//    })
export const createPatient = mutation({
  args: {
    name: v.string(),
    // We start with minimal info from the kiosk
  },
  handler: async (ctx, args) => {
    const newPatient = {
      name: args.name,
      mrn: `MRN${Date.now()}`, // Simple MRN generation for demo
      dob: "",
      gender: "",
      allergies: [],
    };
    const patientId = await ctx.db.insert("patients", newPatient);
    return patientId;
  }
});