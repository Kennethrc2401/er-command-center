import { query } from "./_generated/server";
import { v } from "convex/values";

export const getUnitMetrics = query({
  args: { encounterId: v.optional(v.id("encounters")) },
  handler: async (ctx) => {
    const encounters = await ctx.db.query("encounters").collect();
    const now = Date.now();

    // 1. Average Wait Time (Arrival to Bed)
    const beddedPatients = encounters.filter(e => e.location && e.location !== "");
    const avgWait = beddedPatients.length > 0 
      ? beddedPatients.reduce((acc, e) => acc + (now - e._creationTime), 0) / beddedPatients.length 
      : 0;

    // 2. Acuity Distribution
    const acuityMix = {
      level1: encounters.filter(e => e.acuity === 1).length,
      level2: encounters.filter(e => e.acuity === 2).length,
      others: encounters.filter(e => e.acuity > 2).length,
    };

    return {
      avgWaitMinutes: Math.floor(avgWait / 60000),
      acuityMix,
      totalCensus: encounters.length,
    };
  },
});