// convex/clinical.ts
import { v } from "convex/values";
import { query } from "./_generated/server";

function calculateNEWS2(vitals: {
  hr: number;
  spO2: number;
  temp: number;
  bp: string;
}) {
  let score = 0;
  const systolicBp = Number.parseInt(vitals.bp.split("/")[0] ?? "0", 10);

  // 1. SpO2
  if (vitals.spO2 <= 91) score += 3;
  else if (vitals.spO2 <= 93) score += 2;
  else if (vitals.spO2 <= 95) score += 1;

  // 2. Temperature (F)
  if (vitals.temp <= 95) score += 3;
  else if (vitals.temp >= 102.2) score += 3;
  else if (vitals.temp >= 100.4 || vitals.temp <= 96.8) score += 1;

  // 3. Heart rate
  if (vitals.hr <= 40 || vitals.hr >= 131) score += 3;
  else if (vitals.hr >= 111 || vitals.hr <= 50) score += 2;
  else if (vitals.hr >= 91) score += 1;

  // 4. Systolic BP
  if (systolicBp <= 90 || systolicBp >= 220) score += 3;
  else if (systolicBp <= 100) score += 2;
  else if (systolicBp <= 110) score += 1;

  return { score };
}

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
    const criticalPatients = encounters.filter(e => {
      if (!e.vitals) return false;
      const { score } = calculateNEWS2(e.vitals);
      return score >= 5;
    }).length;

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