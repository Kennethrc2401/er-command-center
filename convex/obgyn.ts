import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

const OB_SNAPSHOT_PREFIX = "OB_LD_SNAPSHOT::";
const POSTPARTUM_TASK_PREFIX = "ob_pp_";

const staffRole = v.union(
  v.literal("ADMIN"),
  v.literal("DOCTOR"),
  v.literal("NURSE"),
  v.literal("CCMA"),
  v.literal("SURGEON"),
  v.literal("ANESTHESIOLOGIST"),
  v.literal("PHARMACIST"),
  v.literal("RESPIRATORY_THERAPIST"),
  v.literal("RAD_TECH"),
  v.literal("SCRUB_TECH"),
  v.literal("UNIT_COORDINATOR"),
  v.literal("UNKNOWN")
);

type StaffRole =
  | "ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "CCMA"
  | "SURGEON"
  | "ANESTHESIOLOGIST"
  | "PHARMACIST"
  | "RESPIRATORY_THERAPIST"
  | "RAD_TECH"
  | "SCRUB_TECH"
  | "UNIT_COORDINATOR"
  | "UNKNOWN";

type LaborStage = "Latent" | "Active" | "Transition" | "Second" | "Recovery";
type FetalCategory = "I" | "II" | "III";

type ObSnapshot = {
  gaWeeks: number;
  parity: string;
  stage: LaborStage;
  dilationCm: number;
  effacementPct: number;
  station: string;
  membranes: "Intact" | "ROM" | "AROM";
  contractionPattern: string;
  fetalCategory: FetalCategory;
  hemorrhageRisk: "LOW" | "MED" | "HIGH";
  gbs: "NEG" | "POS" | "UNKNOWN";
  pitocin: string;
  analgesia: string;
  etaMinutes: number;
  updatedAt: number;
  updatedBy: string;
  updatedByRole: StaffRole;
};

const DEFAULT_POSTPARTUM_TASKS = [
  "Hemorrhage reassessment complete",
  "Pain and mobility goals documented",
  "Lactation consult offered/completed",
  "Postpartum depression screening done",
  "Rh status reviewed; Rhogam plan documented",
  "Contraception counseling completed",
  "Discharge warning signs taught",
];

function isLikelyObEncounter(chiefComplaint: string, location?: string) {
  const source = `${chiefComplaint || ""} ${location || ""}`.toLowerCase();
  const terms = [
    "preg",
    "pregnancy",
    "labor",
    "delivery",
    "contraction",
    "vaginal bleeding",
    "rupture of membranes",
    "rom",
    "fetal",
    "ob",
    "gyn",
    "postpartum",
    "preeclampsia",
    "eclampsia",
    "ldr",
  ];
  return terms.some((term) => source.includes(term));
}

function parseSnapshot(content: string): ObSnapshot | null {
  if (!content.startsWith(OB_SNAPSHOT_PREFIX)) return null;
  const payload = content.slice(OB_SNAPSHOT_PREFIX.length);
  try {
    const parsed = JSON.parse(payload) as Partial<ObSnapshot>;
    if (
      typeof parsed.gaWeeks !== "number" ||
      typeof parsed.parity !== "string" ||
      typeof parsed.stage !== "string" ||
      typeof parsed.dilationCm !== "number" ||
      typeof parsed.effacementPct !== "number" ||
      typeof parsed.station !== "string" ||
      typeof parsed.membranes !== "string" ||
      typeof parsed.contractionPattern !== "string" ||
      typeof parsed.fetalCategory !== "string" ||
      typeof parsed.hemorrhageRisk !== "string" ||
      typeof parsed.gbs !== "string" ||
      typeof parsed.pitocin !== "string" ||
      typeof parsed.analgesia !== "string" ||
      typeof parsed.etaMinutes !== "number" ||
      typeof parsed.updatedAt !== "number" ||
      typeof parsed.updatedBy !== "string" ||
      typeof parsed.updatedByRole !== "string"
    ) {
      return null;
    }

    return parsed as ObSnapshot;
  } catch {
    return null;
  }
}

function validateSnapshotInput(snapshot: {
  gaWeeks: number;
  dilationCm: number;
  effacementPct: number;
  etaMinutes: number;
}) {
  if (snapshot.gaWeeks < 0 || snapshot.gaWeeks > 45) {
    throw new Error("Gestational age must be between 0 and 45 weeks.");
  }
  if (snapshot.dilationCm < 0 || snapshot.dilationCm > 10) {
    throw new Error("Dilation must be between 0 and 10 cm.");
  }
  if (snapshot.effacementPct < 0 || snapshot.effacementPct > 100) {
    throw new Error("Effacement must be between 0 and 100%.");
  }
  if (snapshot.etaMinutes < 0 || snapshot.etaMinutes > 1440) {
    throw new Error("ETA must be between 0 and 1440 minutes.");
  }
}

function canWriteLaborSnapshot(role: StaffRole) {
  return ["ADMIN", "NURSE", "DOCTOR", "SURGEON", "UNIT_COORDINATOR"].includes(role);
}

function canManagePostpartumTasks(role: StaffRole) {
  return ["ADMIN", "NURSE", "DOCTOR", "CCMA", "UNIT_COORDINATOR"].includes(role);
}

function canTriggerEscalation(role: StaffRole) {
  return ["ADMIN", "NURSE", "DOCTOR", "UNIT_COORDINATOR"].includes(role);
}

async function getActiveEncounters(ctx: QueryCtx) {
  const statuses = ["triage", "waiting", "treating", "observed"] as const;
  const grouped = await Promise.all(
    statuses.map((status) =>
      ctx.db
        .query("encounters")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect()
    )
  );

  return grouped.flat();
}

async function resolveAuditActorUserId(ctx: MutationCtx, actorName: string, actorRole: StaffRole) {
  const usersByRole =
    actorRole === "UNKNOWN"
      ? await ctx.db.query("users").collect()
      : await ctx.db
          .query("users")
          .withIndex("by_role", (q) => q.eq("role", actorRole))
          .collect();

  const normalizedActor = actorName.trim().toLowerCase();
  const exact = usersByRole.find((row) => row.name.trim().toLowerCase() === normalizedActor);
  if (exact) return exact._id;

  return usersByRole[0]?._id ?? null;
}

export const getDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const activeEncounters = await getActiveEncounters(ctx);
    const obEncounters = activeEncounters.filter((encounter) =>
      isLikelyObEncounter(encounter.chiefComplaint, encounter.location)
    );

    const rows = await Promise.all(
      obEncounters.map(async (encounter) => {
        const patient = await ctx.db.get(encounter.patientId);
        const notes = await ctx.db
          .query("notes")
          .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
          .collect();

        const snapshotNote = notes.find((note) => note.content.startsWith(OB_SNAPSHOT_PREFIX));
        const snapshot = snapshotNote ? parseSnapshot(snapshotNote.content) : null;

        const postpartumTasks = (await ctx.db
          .query("checklists")
          .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
          .collect())
          .filter((task) => (task.taskKey ?? "").startsWith(POSTPARTUM_TASK_PREFIX))
          .sort((a, b) => a.item.localeCompare(b.item));

        return {
          encounterId: encounter._id,
          patientId: encounter.patientId,
          patientName: encounter.patientName ?? patient?.name ?? "Unknown Patient",
          location: encounter.location ?? "OB Triage",
          status: encounter.status,
          chiefComplaint: encounter.chiefComplaint,
          snapshot,
          postpartumTasks,
          triageWaitMinutes: Math.max(0, Math.floor((Date.now() - encounter._creationTime) / 60000)),
        };
      })
    );

    const laborBoard = rows.filter(
      (row) => row.snapshot && (row.status === "treating" || row.status === "observed" || row.status === "waiting")
    );
    const triageQueue = rows.filter((row) => row.status === "triage" || row.status === "waiting");

    return {
      laborBoard,
      triageQueue,
      postpartumTemplateTasks: DEFAULT_POSTPARTUM_TASKS,
      fetchedAt: Date.now(),
    };
  },
});

export const upsertLaborSnapshot = mutation({
  args: {
    encounterId: v.id("encounters"),
    gaWeeks: v.number(),
    parity: v.string(),
    stage: v.union(
      v.literal("Latent"),
      v.literal("Active"),
      v.literal("Transition"),
      v.literal("Second"),
      v.literal("Recovery")
    ),
    dilationCm: v.number(),
    effacementPct: v.number(),
    station: v.string(),
    membranes: v.union(v.literal("Intact"), v.literal("ROM"), v.literal("AROM")),
    contractionPattern: v.string(),
    fetalCategory: v.union(v.literal("I"), v.literal("II"), v.literal("III")),
    hemorrhageRisk: v.union(v.literal("LOW"), v.literal("MED"), v.literal("HIGH")),
    gbs: v.union(v.literal("NEG"), v.literal("POS"), v.literal("UNKNOWN")),
    pitocin: v.string(),
    analgesia: v.string(),
    etaMinutes: v.number(),
    actorName: v.string(),
    actorRole: staffRole,
  },
  handler: async (ctx, args) => {
    if (!canWriteLaborSnapshot(args.actorRole)) {
      throw new Error("Your role is not permitted to update labor tracking fields.");
    }

    validateSnapshotInput({
      gaWeeks: args.gaWeeks,
      dilationCm: args.dilationCm,
      effacementPct: args.effacementPct,
      etaMinutes: args.etaMinutes,
    });

    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) {
      throw new Error("Encounter not found.");
    }

    const patient = await ctx.db.get(encounter.patientId);
    if (!patient) {
      throw new Error("Patient not found for encounter.");
    }

    const snapshot: ObSnapshot = {
      gaWeeks: args.gaWeeks,
      parity: args.parity.trim(),
      stage: args.stage,
      dilationCm: args.dilationCm,
      effacementPct: args.effacementPct,
      station: args.station.trim(),
      membranes: args.membranes,
      contractionPattern: args.contractionPattern.trim(),
      fetalCategory: args.fetalCategory,
      hemorrhageRisk: args.hemorrhageRisk,
      gbs: args.gbs,
      pitocin: args.pitocin.trim(),
      analgesia: args.analgesia.trim(),
      etaMinutes: args.etaMinutes,
      updatedAt: Date.now(),
      updatedBy: args.actorName,
      updatedByRole: args.actorRole,
    };

    const serialized = `${OB_SNAPSHOT_PREFIX}${JSON.stringify(snapshot)}`;

    const existing = (await ctx.db
      .query("notes")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect())
      .find((note) => note.content.startsWith(OB_SNAPSHOT_PREFIX));

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: serialized,
        author: `${args.actorName}, ${args.actorRole}`,
        category: "Nursing",
        isTemplate: false,
      });
    } else {
      await ctx.db.insert("notes", {
        encounterId: args.encounterId,
        author: `${args.actorName}, ${args.actorRole}`,
        category: "Nursing",
        content: serialized,
        isTemplate: false,
      });
    }

    await ctx.db.insert("operationalAlertAcknowledgements", {
      encounterId: args.encounterId,
      patientId: encounter.patientId,
      kind: "consult",
      recordId: `ob-labor-snapshot-${Date.now()}`,
      alertTitle: "OB/L&D labor tracking updated",
      acknowledgedBy: args.actorName,
      acknowledgedRole: args.actorRole,
      note: `Updated FHR category ${args.fetalCategory}, dilation ${args.dilationCm} cm, stage ${args.stage}`,
      acknowledgedAt: Date.now(),
      source: "other",
    });

    const actorUserId = await resolveAuditActorUserId(ctx, args.actorName, args.actorRole);
    if (actorUserId) {
      await ctx.db.insert("auditLogs", {
        userId: actorUserId,
        userName: args.actorName,
        action: "OB_LD_LABOR_SNAPSHOT_UPDATED",
        patientId: encounter.patientId,
        patientName: patient.name,
        timestamp: Date.now(),
        metadata: JSON.stringify({
          encounterId: String(args.encounterId),
          fetalCategory: args.fetalCategory,
          stage: args.stage,
        }),
      });
    }

    return { ok: true };
  },
});

export const ensurePostpartumChecklist = mutation({
  args: {
    encounterId: v.id("encounters"),
    actorName: v.string(),
    actorRole: staffRole,
  },
  handler: async (ctx, args) => {
    if (!canManagePostpartumTasks(args.actorRole)) {
      throw new Error("Your role is not permitted to manage postpartum tasks.");
    }

    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) {
      throw new Error("Encounter not found.");
    }

    const existing = await ctx.db
      .query("checklists")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    let created = 0;
    for (const item of DEFAULT_POSTPARTUM_TASKS) {
      const taskKey = `${POSTPARTUM_TASK_PREFIX}${item.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const hasTask = existing.some((row) => row.taskKey === taskKey);
      if (hasTask) continue;

      await ctx.db.insert("checklists", {
        encounterId: args.encounterId,
        taskKey,
        item,
        completed: false,
        category: "care",
        required: true,
      });
      created += 1;
    }

    return { created };
  },
});

export const togglePostpartumTask = mutation({
  args: {
    checklistId: v.id("checklists"),
    completed: v.boolean(),
    actorName: v.string(),
    actorRole: staffRole,
  },
  handler: async (ctx, args) => {
    if (!canManagePostpartumTasks(args.actorRole)) {
      throw new Error("Your role is not permitted to update postpartum tasks.");
    }

    const checklist = await ctx.db.get(args.checklistId);
    if (!checklist) {
      throw new Error("Checklist item not found.");
    }

    await ctx.db.patch(args.checklistId, {
      completed: args.completed,
      completedBy: args.completed ? args.actorName : undefined,
      completedAt: args.completed ? Date.now() : undefined,
    });

    await ctx.db.insert("operationalAlertAcknowledgements", {
      encounterId: checklist.encounterId,
      kind: "consult",
      recordId: `ob-pp-task-${String(args.checklistId)}-${Date.now()}`,
      alertTitle: "OB postpartum task updated",
      acknowledgedBy: args.actorName,
      acknowledgedRole: args.actorRole,
      note: `${checklist.item} marked ${args.completed ? "complete" : "pending"}`,
      acknowledgedAt: Date.now(),
      source: "other",
    });

    return { ok: true };
  },
});

export const addPatientToLaborBoard = mutation({
  args: {
    encounterId: v.id("encounters"),
    gaWeeks: v.number(),
    parity: v.string(),
    stage: v.union(
      v.literal("Latent"),
      v.literal("Active"),
      v.literal("Transition"),
      v.literal("Second"),
      v.literal("Recovery")
    ),
    dilationCm: v.number(),
    effacementPct: v.number(),
    station: v.string(),
    membranes: v.union(v.literal("Intact"), v.literal("ROM"), v.literal("AROM")),
    contractionPattern: v.string(),
    fetalCategory: v.union(v.literal("I"), v.literal("II"), v.literal("III")),
    hemorrhageRisk: v.union(v.literal("LOW"), v.literal("MED"), v.literal("HIGH")),
    gbs: v.union(v.literal("NEG"), v.literal("POS"), v.literal("UNKNOWN")),
    pitocin: v.string(),
    analgesia: v.string(),
    etaMinutes: v.number(),
    actorName: v.string(),
    actorRole: staffRole,
  },
  handler: async (ctx, args) => {
    if (!canWriteLaborSnapshot(args.actorRole)) {
      throw new Error("Your role is not permitted to update labor tracking fields.");
    }

    validateSnapshotInput({
      gaWeeks: args.gaWeeks,
      dilationCm: args.dilationCm,
      effacementPct: args.effacementPct,
      etaMinutes: args.etaMinutes,
    });

    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) {
      throw new Error("Encounter not found.");
    }

    const patient = await ctx.db.get(encounter.patientId);
    if (!patient) {
      throw new Error("Patient not found for encounter.");
    }

    const now = Date.now();
    await ctx.db.patch(args.encounterId, {
      dispositionPlan: "admit",
      dispositionDecisionAt: now,
      flowStage: "bedded",
      flowStageUpdatedAt: now,
      status: "treating",
    });

    const snapshot: ObSnapshot = {
      gaWeeks: args.gaWeeks,
      parity: args.parity.trim(),
      stage: args.stage,
      dilationCm: args.dilationCm,
      effacementPct: args.effacementPct,
      station: args.station.trim(),
      membranes: args.membranes,
      contractionPattern: args.contractionPattern.trim(),
      fetalCategory: args.fetalCategory,
      hemorrhageRisk: args.hemorrhageRisk,
      gbs: args.gbs,
      pitocin: args.pitocin.trim(),
      analgesia: args.analgesia.trim(),
      etaMinutes: args.etaMinutes,
      updatedAt: now,
      updatedBy: args.actorName,
      updatedByRole: args.actorRole,
    };

    const serialized = `${OB_SNAPSHOT_PREFIX}${JSON.stringify(snapshot)}`;
    const existing = (await ctx.db
      .query("notes")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect())
      .find((note) => note.content.startsWith(OB_SNAPSHOT_PREFIX));

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: serialized,
        author: `${args.actorName}, ${args.actorRole}`,
        category: "Nursing",
        isTemplate: false,
      });
    } else {
      await ctx.db.insert("notes", {
        encounterId: args.encounterId,
        author: `${args.actorName}, ${args.actorRole}`,
        category: "Nursing",
        content: serialized,
        isTemplate: false,
      });
    }

    await ctx.db.insert("operationalAlertAcknowledgements", {
      encounterId: args.encounterId,
      patientId: encounter.patientId,
      kind: "consult",
      recordId: `ob-board-admit-${Date.now()}`,
      alertTitle: "OB/L&D board admission updated",
      acknowledgedBy: args.actorName,
      acknowledgedRole: args.actorRole,
      note: `Admitted to labor board with FHR category ${args.fetalCategory}, dilation ${args.dilationCm} cm, stage ${args.stage}`,
      acknowledgedAt: Date.now(),
      source: "other",
    });

    const actorUserId = await resolveAuditActorUserId(ctx, args.actorName, args.actorRole);
    if (actorUserId) {
      await ctx.db.insert("auditLogs", {
        userId: actorUserId,
        userName: args.actorName,
        action: "OB_LD_BOARD_ADMISSION",
        patientId: encounter.patientId,
        patientName: patient.name,
        timestamp: Date.now(),
        metadata: JSON.stringify({
          encounterId: String(args.encounterId),
          fetalCategory: args.fetalCategory,
          stage: args.stage,
        }),
      });
    }

    return { ok: true };
  },
});

export const triggerSafetyEscalation = mutation({
  args: {
    encounterId: v.id("encounters"),
    actorName: v.string(),
    actorRole: staffRole,
    title: v.string(),
    message: v.string(),
    targetRole: v.union(v.literal("NURSE"), v.literal("DOCTOR"), v.literal("UNIT_COORDINATOR")),
  },
  handler: async (ctx, args) => {
    if (!canTriggerEscalation(args.actorRole)) {
      throw new Error("Your role is not permitted to trigger OB safety escalation alerts.");
    }

    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found.");

    const patient = await ctx.db.get(encounter.patientId);

    const notificationId = await ctx.db.insert("notifications", {
      type: "OB_LD_ESCALATION",
      title: args.title,
      message: args.message,
      patientId: encounter.patientId,
      encounterId: args.encounterId,
      timestamp: Date.now(),
      severity: "critical",
      routedTo: args.targetRole,
      isRead: false,
    });

    await ctx.db.insert("operationalAlertAcknowledgements", {
      encounterId: args.encounterId,
      patientId: encounter.patientId,
      kind: "consult",
      recordId: `ob-escalation-${String(notificationId)}`,
      alertTitle: args.title,
      acknowledgedBy: args.actorName,
      acknowledgedRole: args.actorRole,
      note: `${args.message} | Routed to ${args.targetRole}`,
      acknowledgedAt: Date.now(),
      source: "other",
    });

    // Best-effort audit log insertion. This falls back to the first matching staff user.
    const actorUserId = await resolveAuditActorUserId(ctx, args.actorName, args.actorRole);
    if (actorUserId) {
      await ctx.db.insert("auditLogs", {
        userId: actorUserId,
        userName: args.actorName,
        action: "OB_LD_SAFETY_ESCALATION",
        patientId: encounter.patientId,
        patientName: patient?.name,
        timestamp: Date.now(),
        metadata: JSON.stringify({
          encounterId: String(args.encounterId),
          title: args.title,
          targetRole: args.targetRole,
        }),
      });
    }

    return {
      notificationId,
      routedTo: args.targetRole,
    };
  },
});
