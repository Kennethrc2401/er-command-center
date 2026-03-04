// // convex/migrations.ts
// import { mutation } from "./_generated/server";

// export const fixMissingGender = mutation({
//   args: {},
//   handler: async (ctx) => {
//     const patients = await ctx.db.query("patients").collect();
//     for (const p of patients) {
//       if (!(p as any).gender) {
//         await ctx.db.patch(p._id, { gender: "Unknown" });
//       }
//     }
//   },
// });export const admitPatient = mutation({
//   args: {
//     name: v.string(),
//     mrn: v.string(),
//     dob: v.string(),
//     gender: v.string(),
//     chiefComplaint: v.string(),
//     acuity: v.number(),
//     // Replace v.any() with this:
//     vitals: v.object({
//       hr: v.number(),
//       bp: v.string(),
//       temp: v.number(),
//       spO2: v.number(),
//     }),
//   },
//   handler: async (ctx, args) => {
//     const patientId = await ctx.db.insert("patients", {
//       name: args.name,
//       mrn: args.mrn,
//       dob: args.dob,
//       gender: args.gender,
//       allergies: [] as string[],
//     });

//     const encounterId = await ctx.db.insert("encounters", {
//       patientId,
//       status: "waiting",
//       acuity: args.acuity,
//       chiefComplaint: args.chiefComplaint,
//       vitals: args.vitals, // Now strictly typed
//     });

//     return { patientId, encounterId };
//   },
// });