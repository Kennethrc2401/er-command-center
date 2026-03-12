import { mutation } from "./_generated/server";
import { faker } from "@faker-js/faker";

/**
 * 🧹 WIPER: Clears existing patients and encounters.
 * Use this to ensure a clean state before re-seeding.
 */
export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    const patients = await ctx.db.query("patients").collect();
    const encounters = await ctx.db.query("encounters").collect();
    const faxes = await ctx.db.query("faxes").collect();

    for (const p of patients) await ctx.db.delete(p._id);
    for (const e of encounters) await ctx.db.delete(e._id);
    for (const f of faxes) await ctx.db.delete(f._id);

    return "✅ Database Wiped: Ready for fresh seed.";
  },
});

/**
 * 🧬 SEEDER: Generates 100 synchronized patient and encounter records.
 */
export const addMorePatients = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🚀 Generating 100 clinical records...");

    for (let i = 0; i < 100; i++) {
      const gender = faker.helpers.arrayElement(["Male", "Female", "Non-binary"]);
      const firstName = faker.person.firstName(gender === "Non-binary" ? undefined : (gender.toLowerCase() as "male" | "female"));
      const lastName = faker.person.lastName();
      const name = `${firstName} ${lastName}`;
      const mrn = `ER-${faker.string.numeric(4)}-${faker.string.alpha(2).toUpperCase()}`;
      
      // 1. Create the Patient Record
      const patientId = await ctx.db.insert("patients", {
        name,
        mrn,
        dob: faker.date.birthdate({ min: 18, max: 90, mode: 'age' }).toISOString().split('T')[0],
        gender,
        searchVector: `${name} ${mrn}`.toLowerCase(),
        allergies: faker.helpers.arrayElements(
          ["Penicillin", "Latex", "Peanuts", "Sulfa", "Iodine"],
          { min: 0, max: 2 }
        ),
        codeStatus: faker.helpers.arrayElement(["Full Code", "DNR/DNI", "DNR-Limited"]),
        isHighRisk: faker.datatype.boolean({ probability: 0.15 }),
        medicalHistory: faker.helpers.arrayElements(
          ["Hypertension", "Type 2 Diabetes", "Asthma", "GERD", "CAD"],
          { min: 0, max: 3 }
        ),
        socialHistory: "Lives at home, socially active.",
        familyHistory: "Non-contributory",
        vitals: {
          hr: faker.number.int({ min: 60, max: 100 }),
          bp: `${faker.number.int({ min: 110, max: 140 })}/${faker.number.int({ min: 70, max: 90 })}`,
          temp: 98.6,
          spO2: 99,
        }
      });

      // 2. Create the associated ER Encounter
      await ctx.db.insert("encounters", {
        patientId,
        patientName: name, 
        status: faker.helpers.arrayElement(["triage", "waiting", "treating"]),
        acuity: faker.number.int({ min: 1, max: 5 }),
        chiefComplaint: faker.helpers.arrayElement([
          "Chest Pain", "Shortness of Breath", "Abdominal Pain", 
          "Laceration", "High Fever", "Dizziness", "Syncopal Episode"
        ]),
        vitals: {
          hr: faker.number.int({ min: 55, max: 125 }),
          bp: `${faker.number.int({ min: 100, max: 160 })}/${faker.number.int({ min: 60, max: 100 })}`,
          temp: parseFloat(faker.number.float({ min: 98.0, max: 103.0 }).toFixed(1)),
          spO2: faker.number.int({ min: 90, max: 100 }),
        },
      });
    }
    
    return "✅ 100 Synchronized Records Generated Successfully!";
  },
});