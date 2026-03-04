import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const record = mutation({
  args: {
    encounterId: v.id("encounters"),
    hr: v.number(),
    bp: v.string(),
    spO2: v.number(),
    temp: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Log the full history in the 'vitals' table for the trend chart
    await ctx.db.insert("vitals", {
      ...args,
      recordedAt: Date.now(),
    });

    // 2. Fetch the current encounter to see what the OLD heart rate was
    const encounter = await ctx.db.get(args.encounterId);
    const oldHr = encounter?.vitals?.hr || 0;

    // 3. Update the 'encounters' table with the LATEST snapshot for the Tracking Board
    // This makes the 'Critical Trend' icon logic much faster on the frontend
    return await ctx.db.patch(args.encounterId, {
      vitals: {
        hr: args.hr,
        bp: args.bp,
        spO2: args.spO2,
        temp: args.temp,
        previousHr: oldHr, // Keep this for the 20% jump comparison
      }
    });
  },
});

export const getHistory = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("vitals")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .order("asc") 
      .collect();

    return history.map((v) => ({
      time: new Date(v.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hr: v.hr,
      spO2: v.spO2,
      recordedAt: v.recordedAt,
    }));
  },
});