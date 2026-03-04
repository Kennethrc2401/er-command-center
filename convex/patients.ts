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