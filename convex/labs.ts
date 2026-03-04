import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const postResult = mutation({
  args: {
    encounterId: v.id("encounters"),
    testName: v.string(),
    value: v.string(),
    unit: v.string(),
    range: v.string(),
    isAbnormal: v.boolean(),
    status: v.union(v.literal("pending"), v.literal("final")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("labResults", {
      ...args,
    });

    // If a lab is critical (abnormal), we could trigger a system-wide alert here
    if (args.isAbnormal) {
      console.log(`CRITICAL ALERT for Encounter ${args.encounterId}: ${args.testName}`);
    }

    return id;
  },
});

export const getByEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("labResults")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
  },
});

export const getCriticalAlerts = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const labs = await ctx.db
      .query("labResults")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
    
    // Filter for results flagged as critical/abnormal
    return labs.filter(lab => lab.isAbnormal);
  },
});


export const acknowledgeLab = mutation({
  args: { 
    labId: v.id("labResults"), 
    staffName: v.string() 
  },
  handler: async (ctx, args) => {
    const lab = await ctx.db.get(args.labId);
    if (!lab) throw new Error("Lab result not found");

    await ctx.db.patch(args.labId, {
      isAbnormal: false, // This "resolves" the alert
      acknowledgedBy: args.staffName,
      acknowledgedAt: Date.now(),
    });
  },
});

export const getPendingCount = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const pendingLabs = await ctx.db
      .query("labResults")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    return pendingLabs.length;
  },
});

// Define a clear interface for the lab result
interface LabResult {
  _id: string;
  _creationTime: number;
  testName: string;
  value: string;
  unit: string;
  status: string;
}

export const getLabTrends = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const allLabs = await ctx.db
      .query("labResults")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    // Cast as LabResult to avoid 'any'
    const results = allLabs as LabResult[];

    const groups: Record<string, LabResult[]> = {};
    results.forEach(lab => {
      if (!groups[lab.testName]) groups[lab.testName] = [];
      groups[lab.testName].push(lab);
    });

    return Object.entries(groups).map(([name, history]) => ({
      testName: name,
      history: history.sort((a, b) => b._creationTime - a._creationTime).slice(0, 3)
    }));
  },
});