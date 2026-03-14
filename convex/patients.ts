import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { normalizePatientContactFields } from "./patientNormalization";

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
    dob: v.optional(v.string()),
    gender: v.optional(v.string()),
    allergies: v.optional(v.array(v.string())),
    phoneNumber: v.optional(v.string()),
    emailAddress: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    emergencyContactName: v.optional(v.string()),
    emergencyContactPhone: v.optional(v.string()),
    emergencyContactRelation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    const normalizedContact = normalizePatientContactFields({
      phoneNumber: args.phoneNumber,
      emailAddress: args.emailAddress,
      preferredLanguage: args.preferredLanguage,
      addressLine1: args.addressLine1,
      addressLine2: args.addressLine2,
      city: args.city,
      state: args.state,
      postalCode: args.postalCode,
      emergencyContactName: args.emergencyContactName,
      emergencyContactPhone: args.emergencyContactPhone,
      emergencyContactRelation: args.emergencyContactRelation,
    });

    const updates: Record<string, unknown> = {};

    if (args.name !== undefined) {
      const trimmedName = args.name.trim();
      if (trimmedName.length > 0) {
        updates.name = trimmedName;
      }
    }

    if (args.dob !== undefined) {
      updates.dob = args.dob.trim();
    }

    if (args.gender !== undefined) {
      const trimmedGender = args.gender.trim();
      updates.gender = trimmedGender.length > 0 ? trimmedGender : patient.gender;
    }

    if (args.allergies !== undefined) {
      updates.allergies = args.allergies;
    }

    updates.phoneNumber = normalizedContact.phoneNumber;
    updates.emailAddress = normalizedContact.emailAddress;
    updates.preferredLanguage = normalizedContact.preferredLanguage;
    updates.addressLine1 = normalizedContact.addressLine1;
    updates.addressLine2 = normalizedContact.addressLine2;
    updates.city = normalizedContact.city;
    updates.state = normalizedContact.state;
    updates.postalCode = normalizedContact.postalCode;
    updates.emergencyContactName = normalizedContact.emergencyContactName;
    updates.emergencyContactPhone = normalizedContact.emergencyContactPhone;
    updates.emergencyContactRelation = normalizedContact.emergencyContactRelation;

    const nextName = typeof updates.name === "string" ? updates.name : patient.name;
    updates.searchVector = `${nextName} ${patient.mrn}`.trim();

    await ctx.db.patch(args.patientId, updates);
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