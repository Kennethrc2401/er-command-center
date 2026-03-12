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
        q.search("searchVector", trimSearch)
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
      searchVector: args.name, // Add search vector for full-text search index
    };
    const patientId = await ctx.db.insert("patients", newPatient);
    return patientId;
  }
});

export const searchPatients = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const searchTerm = args.query.trim().toLowerCase();

    // 1. If the search bar is empty, return the most recent patients
    // This provides immediate feedback before the user even types
    if (searchTerm === "") {
      return await ctx.db
        .query("patients")
        .order("desc")
        .take(5)
    }

    // 2. Perform high-speed search using the combined Name + MRN index
    // This allows the user to type "John" OR "ER-5501"
    return await ctx.db
      .query("patients")
      .withSearchIndex("search_patients", (q) => 
        q.search("searchVector", searchTerm)
      )
      .take(10)
  },
});

export const updateVitals = mutation({
  args: {
    patientId: v.id("patients"),
    encounterId: v.id("encounters"),
    vitals: v.object({
      hr: v.number(),
      bp: v.string(),
      temp: v.number(),
      spO2: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    // 1. Permanent Audit Log (The 'vitals' table)
    await ctx.db.insert("vitals", {
      encounterId: args.encounterId,
      patientId: args.patientId, 
      hr: args.vitals.hr,
      bp: args.vitals.bp,
      spO2: args.vitals.spO2,
      temp: args.vitals.temp,
      recordedAt: timestamp,
    });

    // 2. Fetch records for Delta Logic
    const [encounter, patient] = await Promise.all([
      ctx.db.get(args.encounterId),
      ctx.db.get(args.patientId)
    ]);

    // 🩺 Defensive Check: Stop if records are missing
    if (!encounter || !patient) {
      throw new Error("Clinical record sync failed: Patient or Encounter not found.");
    }

    const oldHr = encounter.vitals?.hr ?? args.vitals.hr;

    // 3. Update Encounter Snapshot (For Dashboard Sorting/Arrows)
    await ctx.db.patch(args.encounterId, {
      vitals: {
        ...args.vitals,
        previousHr: oldHr,
      },
    });

    // 4. Update Patient Document (For High-Speed Sparklines)
    const newHistoryEntry = { ...args.vitals, timestamp };
    const existingHistory = patient.vitalsHistory ?? [];

    await ctx.db.patch(args.patientId, { 
      vitals: {
        ...args.vitals,
        timestamp,
      },
      // We unshift to keep newest at the front, then slice
      vitalsHistory: [newHistoryEntry, ...existingHistory].slice(0, 20)
    });

    return { success: true };
  },
});