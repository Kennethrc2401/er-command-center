// convex/clinical.ts
import { v } from "convex/values";
import { query } from "./_generated/server";

export const globalClinicalSearch = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    if (args.searchTerm.length < 2) return { patients: [], orders: [] };

    const term = args.searchTerm.toLowerCase();

    // 1. Search Patients (Name/MRN)
    const patients = await ctx.db
      .query("patients")
      .withSearchIndex("search_patients", (q) => q.search("searchVector", term))
      .take(5);

    // 2. Search Orders (Test Name/Status)
    const orders = await ctx.db
      .query("orders")
      .withSearchIndex("search_orders", (q) => q.search("searchVector", term))
      .take(5);

    return { patients, orders };
  },
});

export const getMorningReport = query({
  args: {},
  handler: async (ctx) => {
    const [encounters, orders] = await Promise.all([
      ctx.db.query("encounters").collect(),
      ctx.db.query("orders").collect()
    ]);

    // 🚨 1. Identify Critical Patients (O2 < 90 or high HR)
    const criticalPatients = encounters.filter(e => 
      (e.vitals?.spO2 && e.vitals.spO2 < 90) || 
      (e.vitals?.hr && e.vitals.hr > 130)
    ).length;

    // 🧪 2. Count STAT Backlog
    const pendingStatOrders = orders.filter(o => 
      o.priority === "STAT" && o.status === "PENDING"
    ).length;

    // 📊 3. Calculate Acuity Mix
    const highAcuity = encounters.filter(e => e.acuity <= 2).length;

    return {
      criticalAlerts: criticalPatients,
      statBacklog: pendingStatOrders,
      highAcuityCount: highAcuity,
      totalCensus: encounters.length
    };
  },
});