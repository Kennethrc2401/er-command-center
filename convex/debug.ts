import { mutation } from "./_generated/server";

export const wipeAllData = mutation({
  args: {},
  handler: async (ctx) => {
    const patients = await ctx.db.query("patients").collect();
    const encounters = await ctx.db.query("encounters").collect();
    const faxes = await ctx.db.query("faxes").collect();

    console.log(`Wiping ${patients.length} patients, ${encounters.length} encounters...`);

    for (const p of patients) await ctx.db.delete(p._id);
    for (const e of encounters) await ctx.db.delete(e._id);
    for (const f of faxes) await ctx.db.delete(f._id);

    return "Database cleared. You are ready to re-seed.";
  },
});