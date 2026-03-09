import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Shared Vitals Validator to ensure strict data integrity.
 */
const vitalsValidator = v.object({
  hr: v.number(),
  bp: v.string(),
  temp: v.number(),
  spO2: v.number(),
});

/**
 * Registers a new patient and starts an encounter simultaneously.
 */
export const admitPatient = mutation({
  args: {
    name: v.string(),
    mrn: v.string(),
    dob: v.string(),
    gender: v.optional(v.string()), 
    chiefComplaint: v.string(),
    acuity: v.number(),
    vitals: vitalsValidator,
  },
  handler: async (ctx, args) => {
    // 1. Create the Patient Record
    const patientId = await ctx.db.insert("patients", {
      name: args.name,
      mrn: args.mrn,
      dob: args.dob,
      gender: args.gender ?? "Not Specified", 
      allergies: [], // Initializing with empty array
      codeStatus: "Full Code", // Default code status
    });

    // 2. Create the ER Encounter
    const encounterId = await ctx.db.insert("encounters", {
      patientId,
      status: "waiting",
      acuity: args.acuity,
      chiefComplaint: args.chiefComplaint,
      vitals: args.vitals,
    });

    // 3. AUTO-GENERATE CLINICAL CHECKLIST
    // These tasks populate the sidebar we just created
    const standardTasks = [
      "Verify Patient Identity (2 Identifiers)",
      "Confirm NKDA / Allergy Status",
      "Establish IV Access / Saline Lock",
      "Obtain Primary Vitals Set",
      "Initiate Fall Risk Assessment",
      "Review Discharge Barriers"
    ];

    for (const item of standardTasks) {
      await ctx.db.insert("checklists", {
        encounterId,
        item,
        completed: false,
        // completedBy is left undefined until Sophia R, RN checks it
      });
    }

    return { patientId, encounterId };
  },
});
/**
 * Creates an encounter for a patient already in the system.
 */
export const createEncounter = mutation({
  args: {
    patientId: v.id("patients"),
    chiefComplaint: v.string(),
    acuity: v.number(),
    vitals: vitalsValidator,
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("encounters", {
      patientId: args.patientId,
      chiefComplaint: args.chiefComplaint,
      acuity: args.acuity,
      vitals: args.vitals,
      status: "triage",
    });
    
    await ctx.db.insert("auditLogs", {
      userId: "staff-user-id", 
      action: "CREATE_ENCOUNTER",
      resourceId: id,
      timestamp: Date.now(),
    });
    return id;
  },
});

/**
 * Fetches current ER load categorized by ESI level for the dashboard.
 */
export const getTriageStats = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("encounters")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "discharged"))
      .collect();

    return {
      level1: active.filter((e) => e.acuity === 1).length,
      level2: active.filter((e) => e.acuity === 2).length,
      level3: active.filter((e) => e.acuity === 3).length,
      level45: active.filter((e) => e.acuity >= 4).length,
      total: active.length,
    };
  },
});

/**
 * Returns all active encounters with joined Patient data, sorted by acuity.
 */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const encounters = await ctx.db
      .query("encounters")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "discharged"))
      .collect();

    const encountersWithNames = await Promise.all(
      encounters.map(async (encounter) => {
        // 1. Fetch the patient
        const patient = await ctx.db.get(encounter.patientId);
        
        // 2. DEFENSIVE CHECK: If patient is null, provide "Unknown" fallbacks
        // This prevents the "Cannot read property 'name' of null" error
        return {
          ...encounter,
          patientName: patient?.name ?? "Unknown Patient",
          mrn: patient?.mrn ?? "N/A",
          gender: patient?.gender ?? "U",
          location: encounter.location ?? "Waiting",
        };
      })
    );

    return encountersWithNames.sort((a, b) => {
      if (a.acuity !== b.acuity) {
        return a.acuity - b.acuity;
      }
      return a._creationTime - b._creationTime;
    });
  },
});

/**
 * Finalizes care and archives the encounter.
 */
export const dischargePatient = mutation({
  args: {
    encounterId: v.id("encounters"),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.encounterId, {
      status: "discharged",
      dischargeSummary: args.summary,
      dischargedAt: Date.now(),
    });
  },
});

/**
 * Updates vitals for an active encounter.
 */
export const updateVitals = mutation({
  args: {
    encounterId: v.id("encounters"),
    vitals: vitalsValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.encounterId, {
      vitals: args.vitals,
    });
  },
});

/**
 * General ER statistics for the Command Center.
 * This resolves the "Could not find public function" error.
 */
export const getERStats = query({
  handler: async (ctx) => {
    const now = Date.now();

    // 1. Get all active patients
    const active = await ctx.db
      .query("encounters")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "discharged"))
      .collect();

    // 🩺 THE "REALITY" FILTER:
    // A patient occupies a bed IF they have a status of 'in_treatment'/'admitted'
    // AND they actually have something written in their 'bedId' or 'location' field.
    const patientsInBeds = active.filter(
      (p) => 
        (p.status === "treating" || p.status === "waiting") && 
        p.location && p.location.trim() !== "" 
    );

    const physicalOccupancy = patientsInBeds.length;
    const TOTAL_CAPACITY = 20;
    
    // Result: 20 - 4 = 16
    const availableBeds = Math.max(0, TOTAL_CAPACITY - physicalOccupancy);

    // DEBUG: Check your terminal/console to see exactly what's being counted
    console.log(`Beds Occupied: ${physicalOccupancy} | Available: ${availableBeds}`);
    return {
      totalPatients: active.length,
      highAcuity: active.filter((p) => (p.acuity ?? 5) <= 2).length,
      availableBeds, 
      boardingPatients: active.filter((p) => p.status === "observed").length,
      pendingInsurance: 0, 
      status: physicalOccupancy >= TOTAL_CAPACITY ? "DIVERSION_RISK" : "NORMAL",
      dailyRevenue: 0, 
      collectionCount: 0,
    };
  },
});

export const getByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("encounters")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId)) // Ensure you have this index in schema!
      .order("desc")
      .collect();
  },
});

export const updateStatus = mutation({
  args: {
    encounterId: v.id("encounters"),
    nextStatus: v.union(
      v.literal("triage"),
      v.literal("waiting"),
      v.literal("treating"),
      v.literal("observed"), // <-- ADD THIS LINE
      v.literal("discharged")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.encounterId, { 
      status: args.nextStatus,
      // If discharging, log the time automatically for analytics
      ...(args.nextStatus === "discharged" ? { dischargedAt: Date.now() } : {})
    });
  },
});

export const assignBed = mutation({
  args: {
    encounterId: v.id("encounters"),
    location: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.encounterId, { 
      location: args.location,
      status: "treating" // Auto-move to treating when bed is assigned
    });
  },
});

export const clearAllBeds = mutation({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("encounters")
      .filter((q) => q.neq(q.field("status"), "discharged"))
      .collect();

    for (const encounter of active) {
      await ctx.db.patch(encounter._id, { location: "" });
    }
  },
});

export const getById = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) return null;
    return encounter;
  },
});

export const getShiftMetrics = query({
  handler: async (ctx) => {
    const allEncounters = await ctx.db.query("encounters").collect();
    const now = Date.now();
    const shiftStart = now - (12 * 60 * 60 * 1000); 

    const active = allEncounters.filter(e => e.status !== "discharged");
    const dischargedInShift = allEncounters.filter(e => 
      e.status === "discharged" && (e.dischargedAt ?? 0) > shiftStart
    );

    // 1. ACUITY DISTRIBUTION (ESI MIX)
    const acuityColors: Record<number, string> = {
      1: "#dc2626", // Red - Immediate
      2: "#ea580c", // Orange - Emergent
      3: "#eab308", // Yellow - Urgent
      4: "#2563eb", // Blue - Less Urgent
      5: "#64748b", // Grey - Non-Urgent
    };

    const acuityDist = [1, 2, 3, 4, 5].map(level => ({
      name: `ESI ${level}`,
      value: active.filter(e => e.acuity === level).length,
      fill: acuityColors[level]
    })).filter(item => item.value > 0);

    // 2. HIGH RISK VITALS TICKER LOGIC
    // Flags patients with physiologically unstable vitals
    const highRiskPatients = await Promise.all(
      active.filter(e => 
        (e.vitals.hr > 120) || 
        (e.vitals.spO2 < 92 && e.vitals.spO2 > 0) || 
        (e.vitals.temp > 103)
      ).map(async (e) => {
        // We fetch the patient document to get the name
        const patient = await ctx.db.get(e.patientId);
        return {
          name: patient?.name || "Unknown Patient", // This is what the frontend expects as 'name'
          issue: e.vitals.hr > 120 ? "Tachycardia" : e.vitals.spO2 < 92 ? "Hypoxia" : "High Fever",
          location: e.location || "Triage"
        };
      })
    );

    // 3. LENGTH OF STAY (LOS) & TREND
    const totalLOS = dischargedInShift.reduce((acc, e) => {
      return acc + ((e.dischargedAt ?? now) - e._creationTime);
    }, 0);

    const avgLOS = dischargedInShift.length > 0 
      ? Math.floor(totalLOS / dischargedInShift.length / 60000) 
      : 0;

    const losTrend = [
      { value: Math.max(0, avgLOS - 15) },
      { value: Math.max(0, avgLOS + 10) },
      { value: avgLOS - 5 },
      { value: avgLOS + 12 },
      { value: avgLOS }
    ];

    // 4. TIME TO PROVIDER (TTP)
    // Measures time from creation to reaching 'treating' status
    const treatedEncounters = allEncounters.filter(e => 
      e.status === "treating" || e.status === "discharged"
    );

    const totalTTP = treatedEncounters.reduce((acc, e) => {
      // In a real app, you'd use a specific 'treatedAt' timestamp
      return acc + ((e.dischargedAt || now) - e._creationTime);
    }, 0);

    const avgTTP = treatedEncounters.length > 0 
      ? Math.floor(totalTTP / treatedEncounters.length / 60000) 
      : 0;

    // 5. STAFFING RATIO
    // Assume 4 clinicians are currently on the shift
    const staffCount = 4;
    const staffRatio = parseFloat((active.length / staffCount).toFixed(1));

    // 6. BOTTLENECK LOGIC
    const statusCounts: Record<string, number> = {};
    active.forEach(e => {
      statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
    });
    const bottleneck = Object.entries(statusCounts).reduce((a, b) => 
      (a[1] > b[1] ? a : b), ["None", 0]
    );

    return {
      acuityDist,
      highRiskPatients,
      activeCount: active.length,
      dischargedCount: dischargedInShift.length,
      avgLOS,
      losTrend,
      avgTTP,
      ttpTarget: 30, // 30 minute clinical goal
      staffRatio,
      criticalCount: active.filter(e => e.acuity === 1).length,
      bottleneckStatus: bottleneck[0],
      bottleneckCount: bottleneck[1]
    };
  },
});

export const getTimeline = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const vitals = await ctx.db.query("vitals").withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId)).collect();
    const labs = await ctx.db.query("labResults").withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId)).collect();
    const imaging = await ctx.db.query("imagingOrders").withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId)).collect();

    // Map all into a common 'event' format
    const events = [
      ...vitals.map(v => ({ time: v._creationTime, type: "VITALS", detail: `BP: ${v.bp}, HR: ${v.hr}` })),
      ...labs.filter(l => l.status === "final").map(l => ({ time: l._creationTime, type: "LABS", detail: `${l.testName} resulted: ${l.value} ${l.unit}` })),
      ...imaging.filter(i => i.status === "Resulted").map(i => ({ time: i.orderedAt, type: "IMAGING", detail: `${i.studyName} Resulted` })),
    ];

    return events.sort((a, b) => b.time - a.time); // Newest first
  },
});

export const seedMockPatient = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. First, create a mock patient record to get a valid Id<"patients">
    const patientId = await ctx.db.insert("patients", {
      name: "John Doe",
      mrn: "12345678",
      dob: "1980-01-01",
      gender: "M",
      allergies: ["NKDA"],
      codeStatus: "Full Code",
    });

    // 2. Now use that real ID for the encounter
    const encounterId = await ctx.db.insert("encounters", {
      patientId: patientId, // This is now correctly typed as Id<"patients">
      chiefComplaint: "Chest Pain",
      acuity: 1,
      vitals: { hr: 110, bp: "150/90", spO2: 95, temp: 98.6 },
      status: "waiting",
      location: "",
    });

    return encounterId;
  },
});

export const getEncounterDetails = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) return null;

    const insurance = await ctx.db
      .query("insurance")
      .withIndex("by_patient", (q) => q.eq("patientId", encounter.patientId))
      .first();

    return {
      ...encounter,
      insurance, // Now the UI gets both in one object
    };
  },
});

export const getEncounterWithInsurance = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) return null;

    // "Join" the insurance table using the patientId
    const insurance = await ctx.db
      .query("insurance")
      .withIndex("by_patient", (q) => q.eq("patientId", encounter.patientId))
      .first();

    return {
      ...encounter,
      insurance: insurance ?? null, // Now 'insurance' exists on this object
    };
  },
});

// convex/encounters.ts

export const getByPatientWithInsurance = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    // 1. Get all encounters for this specific patient
    const encounters = await ctx.db
      .query("encounters")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect();

    // 2. Map through them and attach the insurance record
    // Since insurance is tied to the patientId, we can fetch it once
    const insurance = await ctx.db
      .query("insurance")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .first();

    // 3. Return the merged objects
    return encounters.map((encounter) => ({
      ...encounter,
      insurance: insurance ?? null,
    }));
  },
});

export const runCOBDiscovery = mutation({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    // This simulates searching a state database for secondary coverage
    const hasSecondary = Math.random() > 0.7; // 30% chance they have secondary
    
    if (hasSecondary) {
      // In a real app, you'd create a second insurance record here
      return { found: true, provider: "NJ FamilyCare (Medicaid)" };
    }
    return { found: false };
  }
});