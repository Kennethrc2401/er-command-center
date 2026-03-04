import { mutation } from "./_generated/server";
import { faker } from "@faker-js/faker";

export const addMorePatients = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("Generating 100 additional clinical records...");

    for (let i = 0; i < 100; i++) {
      const gender = faker.helpers.arrayElement(["Male", "Female", "Non-binary"]);
      
      // 1. Create the Patient
      const patientId = await ctx.db.insert("patients", {
        name: faker.person.fullName(),
        mrn: `ER-${faker.string.numeric(4)}-${faker.string.alpha(2).toUpperCase()}`,
        dob: faker.date.birthdate({ min: 18, max: 90, mode: 'age' }).toISOString().split('T')[0],
        gender: gender,
        allergies: faker.helpers.arrayElements(
          ["Penicillin", "Latex", "Peanuts", "Sulfa"],
          { min: 0, max: 1 }
        ),
        codeStatus: faker.helpers.arrayElement(["Full Code", "DNR/DNI", "DNR-Limited"]),
      });

      // 2. Create the associated ER Encounter
      await ctx.db.insert("encounters", {
        patientId,
        status: faker.helpers.arrayElement(["triage", "waiting", "treating"]),
        acuity: faker.number.int({ min: 2, max: 5 }),
        chiefComplaint: faker.helpers.arrayElement([
          "Chest Pain", "Shortness of Breath", "Abdominal Pain", 
          "Laceration", "Fever", "Headache", "Fall"
        ]),
        vitals: {
          hr: faker.number.int({ min: 60, max: 110 }),
          bp: `${faker.number.int({ min: 110, max: 140 })}/${faker.number.int({ min: 70, max: 90 })}`,
          temp: parseFloat(faker.number.float({ min: 36.1, max: 39.0, fractionDigits: 1 }).toFixed(1)),
          spO2: faker.number.int({ min: 94, max: 100 }),
        },
      });
    }
    return "100 New Patients Added Successfully!";
  },
});