import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const urgentComplaintTerms = [
  "chest pain",
  "difficulty breathing",
  "shortness of breath",
  "severe bleeding",
  "stroke",
  "weakness",
  "suicidal",
  "overdose",
  "trauma",
];

function normalizeText(value?: string) {
  return value?.trim() || "";
}

export const submitCheckIn = mutation({
  args: {
    name: v.string(),
    chiefComplaint: v.string(),
    symptomSummary: v.optional(v.string()),
    painScore: v.optional(v.number()),
    chestPain: v.optional(v.boolean()),
    breathingDifficulty: v.optional(v.boolean()),
    severeBleeding: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const patientName = normalizeText(args.name);
    const chiefComplaint = normalizeText(args.chiefComplaint);
    const symptomSummary = normalizeText(args.symptomSummary);

    if (!patientName || !chiefComplaint) {
      throw new Error("Name and reason for visit are required.");
    }

    const summaryText = `${chiefComplaint} ${symptomSummary}`.toLowerCase();
    const urgentFlags = [
      args.chestPain ? "Chest Pain" : null,
      args.breathingDifficulty ? "Difficulty Breathing" : null,
      args.severeBleeding ? "Severe Bleeding" : null,
      ...urgentComplaintTerms
        .filter((term) => summaryText.includes(term))
        .map((term) => term.replace(/\b\w/g, (char) => char.toUpperCase())),
    ].filter((flag, index, list): flag is string => Boolean(flag) && list.indexOf(flag) === index);

    const priority = urgentFlags.length > 0 || (args.painScore ?? 0) >= 8 ? "urgent" : "routine";
    const now = Date.now();

    const patientId = await ctx.db.insert("patients", {
      name: patientName,
      mrn: `MRN${now}`,
      dob: "",
      gender: "",
      allergies: [],
      searchVector: `${patientName} MRN${now}`,
    });

    const encounterId = await ctx.db.insert("encounters", {
      patientId,
      patientName,
      status: "triage",
      acuity: priority === "urgent" ? 2 : 5,
      chiefComplaint,
      vitals: { hr: 0, bp: "0/0", temp: 0, spO2: 0 },
      flowStage: "triage",
      flowStageUpdatedAt: now,
      dispositionPlan: "undecided",
      delayReason: "registration_hold",
    });

    await ctx.db.insert("kioskIntakes", {
      patientId,
      encounterId,
      patientName,
      chiefComplaint,
      symptomSummary: symptomSummary || undefined,
      painScore: args.painScore,
      urgentFlags,
      priority,
      status: "new",
      checkedInAt: now,
    });

    return { patientId, encounterId, priority, urgentFlags };
  },
});

export const getQueue = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("kioskIntakes").collect();
    return rows
      .filter((row) => row.status !== "roomed")
      .sort((left, right) => {
        if (left.priority !== right.priority) {
          return left.priority === "urgent" ? -1 : 1;
        }
        return right.checkedInAt - left.checkedInAt;
      });
  },
});

export const acknowledge = mutation({
  args: {
    intakeId: v.id("kioskIntakes"),
    actorName: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.intakeId, {
      status: "acknowledged",
      acknowledgedBy: args.actorName,
      acknowledgedAt: Date.now(),
    });
  },
});

export const markRoomed = mutation({
  args: {
    intakeId: v.id("kioskIntakes"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.intakeId, {
      status: "roomed",
    });
  },
});