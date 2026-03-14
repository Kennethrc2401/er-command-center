import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

const documentCategory = v.union(
  v.literal("LAB_RESULT"),
  v.literal("EXTERNAL_RESULT"),
  v.literal("RADIOLOGY_IMAGE"),
  v.literal("LETTER"),
  v.literal("BILLING"),
  v.literal("MISC")
);

const staffRole = v.union(
  v.literal("ADMIN"),
  v.literal("DOCTOR"),
  v.literal("NURSE"),
  v.literal("CCMA"),
  v.literal("UNKNOWN")
);

const accessAction = v.union(
  v.literal("VIEW"),
  v.literal("DOWNLOAD")
);

const categoryPolicyValidator = v.object({
  LAB_RESULT: v.number(),
  EXTERNAL_RESULT: v.number(),
  RADIOLOGY_IMAGE: v.number(),
  LETTER: v.number(),
  BILLING: v.number(),
  MISC: v.number(),
});

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/dicom",
  "application/dicom+json",
]);

type DocumentCategory =
  | "LAB_RESULT"
  | "EXTERNAL_RESULT"
  | "RADIOLOGY_IMAGE"
  | "LETTER"
  | "BILLING"
  | "MISC";

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "LAB_RESULT",
  "EXTERNAL_RESULT",
  "RADIOLOGY_IMAGE",
  "LETTER",
  "BILLING",
  "MISC",
];

const RETENTION_DAYS: Record<DocumentCategory, number> = {
  LAB_RESULT: 3650,       // 10 years
  EXTERNAL_RESULT: 3650,  // 10 years
  RADIOLOGY_IMAGE: 3650,  // 10 years
  LETTER: 1825,           // 5 years
  BILLING: 2555,          // 7 years
  MISC: 180,              // 6 months
};

const ARCHIVED_PURGE_GRACE_DAYS: Record<DocumentCategory, number> = {
  LAB_RESULT: 0,
  EXTERNAL_RESULT: 0,
  RADIOLOGY_IMAGE: 0,
  LETTER: 0,
  BILLING: 0,
  MISC: 30,
};

const SYSTEM_RETENTION_ACTOR_NAME = "SYSTEM_RETENTION_JOB";
const SETTINGS_SINGLETON_KEY = "default";
const DEFAULT_SWEEP_INTERVAL_HOURS = 6;

const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 36500;
const MIN_PURGE_GRACE_DAYS = 0;
const MAX_PURGE_GRACE_DAYS = 36500;
const MIN_SWEEP_INTERVAL_HOURS = 1;
const MAX_SWEEP_INTERVAL_HOURS = 24;

function validateRange(value: number, min: number, max: number, label: string) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number`);
  }
  if (value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
}

async function getChartDocumentSettings(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("chartDocumentSettings")
    .withIndex("by_singleton_key", (q) => q.eq("singletonKey", SETTINGS_SINGLETON_KEY))
    .first();
}

function buildRetentionDaysByCategory(settings?: Doc<"chartDocumentSettings"> | null) {
  const overrides = settings?.retentionDaysByCategory;

  return {
    ...RETENTION_DAYS,
    LAB_RESULT: overrides?.LAB_RESULT ?? RETENTION_DAYS.LAB_RESULT,
    EXTERNAL_RESULT: overrides?.EXTERNAL_RESULT ?? RETENTION_DAYS.EXTERNAL_RESULT,
    RADIOLOGY_IMAGE: overrides?.RADIOLOGY_IMAGE ?? RETENTION_DAYS.RADIOLOGY_IMAGE,
    LETTER: overrides?.LETTER ?? RETENTION_DAYS.LETTER,
    BILLING: overrides?.BILLING ?? RETENTION_DAYS.BILLING,
    MISC: overrides?.MISC ?? settings?.miscRetentionDays ?? RETENTION_DAYS.MISC,
  };
}

function buildPurgeGraceDaysByCategory(settings?: Doc<"chartDocumentSettings"> | null) {
  const overrides = settings?.purgeGraceDaysByCategory;

  return {
    ...ARCHIVED_PURGE_GRACE_DAYS,
    LAB_RESULT: overrides?.LAB_RESULT ?? ARCHIVED_PURGE_GRACE_DAYS.LAB_RESULT,
    EXTERNAL_RESULT: overrides?.EXTERNAL_RESULT ?? ARCHIVED_PURGE_GRACE_DAYS.EXTERNAL_RESULT,
    RADIOLOGY_IMAGE: overrides?.RADIOLOGY_IMAGE ?? ARCHIVED_PURGE_GRACE_DAYS.RADIOLOGY_IMAGE,
    LETTER: overrides?.LETTER ?? ARCHIVED_PURGE_GRACE_DAYS.LETTER,
    BILLING: overrides?.BILLING ?? ARCHIVED_PURGE_GRACE_DAYS.BILLING,
    MISC: overrides?.MISC ?? settings?.miscArchivePurgeGraceDays ?? ARCHIVED_PURGE_GRACE_DAYS.MISC,
  };
}

function hasAllowedExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".dcm") ||
    lower.endsWith(".dicom")
  );
}

function canView(role: "ADMIN" | "DOCTOR" | "NURSE" | "CCMA" | "UNKNOWN") {
  return role === "ADMIN" || role === "DOCTOR" || role === "NURSE" || role === "CCMA";
}

function canUpload(role: "ADMIN" | "DOCTOR" | "NURSE" | "CCMA" | "UNKNOWN") {
  return role === "ADMIN" || role === "DOCTOR" || role === "NURSE" || role === "CCMA";
}

function canDelete(role: "ADMIN" | "DOCTOR" | "NURSE" | "CCMA" | "UNKNOWN") {
  return role === "ADMIN" || role === "DOCTOR" || role === "NURSE";
}

async function writeAuditLog(
  ctx: MutationCtx,
  args: {
    encounterId: Id<"encounters">;
    patientId: Id<"patients">;
    documentId?: Id<"chartDocuments">;
    action: "UPLOAD" | "VIEW" | "DOWNLOAD" | "DELETE" | "RETENTION_ARCHIVE" | "HARD_DELETE" | "ACCESS_DENIED";
    actorName: string;
    actorRole: "ADMIN" | "DOCTOR" | "NURSE" | "CCMA" | "UNKNOWN";
    fileName?: string;
    category?: "LAB_RESULT" | "EXTERNAL_RESULT" | "RADIOLOGY_IMAGE" | "LETTER" | "BILLING" | "MISC";
    note?: string;
  }
) {
  await ctx.db.insert("chartDocumentAuditLogs", {
    encounterId: args.encounterId,
    patientId: args.patientId,
    documentId: args.documentId,
    action: args.action,
    actorName: args.actorName,
    actorRole: args.actorRole,
    fileName: args.fileName,
    category: args.category,
    note: args.note,
    timestamp: Date.now(),
  });
}

async function archiveAndPurgeDocuments(
  ctx: MutationCtx,
  args: {
    docs: Doc<"chartDocuments">[];
    retentionDaysByCategory: Record<DocumentCategory, number>;
    purgeGraceDaysByCategory: Record<DocumentCategory, number>;
    now: number;
    actorName: string;
    actorRole: "ADMIN" | "DOCTOR" | "NURSE" | "CCMA" | "UNKNOWN";
  }
) {
  let archivedCount = 0;
  let hardDeletedCount = 0;

  for (const doc of args.docs) {
    if (doc.isArchived) continue;
    if (!doc.expiresAt) continue;
    if (doc.expiresAt > args.now) continue;

    await ctx.db.patch(doc._id, {
      isArchived: true,
      archivedAt: args.now,
      archivedReason: "retention_policy",
    });

    await writeAuditLog(ctx, {
      encounterId: doc.encounterId,
      patientId: doc.patientId,
      documentId: doc._id,
      action: "RETENTION_ARCHIVE",
      actorName: args.actorName,
      actorRole: args.actorRole,
      fileName: doc.fileName,
      category: doc.category,
      note: `Archived after ${doc.retentionPolicyDays ?? args.retentionDaysByCategory[doc.category]} day retention window`,
    });

    archivedCount += 1;
  }

  for (const doc of args.docs) {
    if (!doc.isArchived) continue;

    const purgeGraceDays = args.purgeGraceDaysByCategory[doc.category];
    if (purgeGraceDays <= 0) continue;

    const archivedAt = doc.archivedAt ?? doc.expiresAt ?? doc.uploadedAt;
    const purgeAt = archivedAt + purgeGraceDays * 24 * 60 * 60 * 1000;
    if (purgeAt > args.now) continue;

    await writeAuditLog(ctx, {
      encounterId: doc.encounterId,
      patientId: doc.patientId,
      documentId: doc._id,
      action: "HARD_DELETE",
      actorName: args.actorName,
      actorRole: args.actorRole,
      fileName: doc.fileName,
      category: doc.category,
      note: `Hard-deleted after archive grace window (${purgeGraceDays} days)`,
    });

    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(doc._id);
    hardDeletedCount += 1;
  }

  return { archivedCount, hardDeletedCount };
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getRetentionSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await getChartDocumentSettings(ctx);
    const retentionDaysByCategory = buildRetentionDaysByCategory(settings);
    const purgeGraceDaysByCategory = buildPurgeGraceDaysByCategory(settings);

    return {
      retentionDaysByCategory,
      purgeGraceDaysByCategory,
      miscRetentionDays: retentionDaysByCategory.MISC,
      miscArchivePurgeGraceDays: purgeGraceDaysByCategory.MISC,
      sweepIntervalHours: settings?.sweepIntervalHours ?? DEFAULT_SWEEP_INTERVAL_HOURS,
      lastGlobalSweepAt: settings?.lastGlobalSweepAt,
      updatedAt: settings?.updatedAt,
      updatedBy: settings?.updatedBy,
      updatedByRole: settings?.updatedByRole,
    };
  },
});

export const updateRetentionSettings = mutation({
  args: {
    retentionDaysByCategory: categoryPolicyValidator,
    purgeGraceDaysByCategory: categoryPolicyValidator,
    sweepIntervalHours: v.number(),
    actorName: v.string(),
    actorRole: staffRole,
  },
  handler: async (ctx, args) => {
    if (args.actorRole !== "ADMIN") {
      throw new Error("Only ADMIN users can update retention settings");
    }

    for (const category of DOCUMENT_CATEGORIES) {
      validateRange(
        args.retentionDaysByCategory[category],
        MIN_RETENTION_DAYS,
        MAX_RETENTION_DAYS,
        `${category} retention days`
      );
      validateRange(
        args.purgeGraceDaysByCategory[category],
        MIN_PURGE_GRACE_DAYS,
        MAX_PURGE_GRACE_DAYS,
        `${category} purge grace days`
      );
    }
    validateRange(args.sweepIntervalHours, MIN_SWEEP_INTERVAL_HOURS, MAX_SWEEP_INTERVAL_HOURS, "Sweep interval hours");

    const now = Date.now();
    const current = await getChartDocumentSettings(ctx);

    if (current) {
      await ctx.db.patch(current._id, {
        miscRetentionDays: args.retentionDaysByCategory.MISC,
        miscArchivePurgeGraceDays: args.purgeGraceDaysByCategory.MISC,
        retentionDaysByCategory: args.retentionDaysByCategory,
        purgeGraceDaysByCategory: args.purgeGraceDaysByCategory,
        sweepIntervalHours: args.sweepIntervalHours,
        updatedAt: now,
        updatedBy: args.actorName,
        updatedByRole: args.actorRole,
      });
    } else {
      await ctx.db.insert("chartDocumentSettings", {
        singletonKey: SETTINGS_SINGLETON_KEY,
        miscRetentionDays: args.retentionDaysByCategory.MISC,
        miscArchivePurgeGraceDays: args.purgeGraceDaysByCategory.MISC,
        retentionDaysByCategory: args.retentionDaysByCategory,
        purgeGraceDaysByCategory: args.purgeGraceDaysByCategory,
        sweepIntervalHours: args.sweepIntervalHours,
        updatedAt: now,
        updatedBy: args.actorName,
        updatedByRole: args.actorRole,
      });
    }

    return {
      retentionDaysByCategory: args.retentionDaysByCategory,
      purgeGraceDaysByCategory: args.purgeGraceDaysByCategory,
      miscRetentionDays: args.retentionDaysByCategory.MISC,
      miscArchivePurgeGraceDays: args.purgeGraceDaysByCategory.MISC,
      sweepIntervalHours: args.sweepIntervalHours,
      updatedAt: now,
      updatedBy: args.actorName,
      updatedByRole: args.actorRole,
    };
  },
});

export const saveUploadedDocument = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    storageId: v.id("_storage"),
    category: documentCategory,
    fileName: v.string(),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    contentType: v.string(),
    sizeBytes: v.number(),
    uploadedBy: v.string(),
    uploadedByRole: staffRole,
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const patient = await ctx.db.get(args.patientId);
    if (!patient) throw new Error("Patient not found");

    if (!canUpload(args.uploadedByRole)) {
      await ctx.storage.delete(args.storageId);
      await writeAuditLog(ctx, {
        encounterId: args.encounterId,
        patientId: args.patientId,
        action: "ACCESS_DENIED",
        actorName: args.uploadedBy,
        actorRole: args.uploadedByRole,
        fileName: args.fileName,
        category: args.category,
        note: "Upload attempted without sufficient permissions",
      });
      throw new Error("You do not have permission to upload chart files");
    }

    if (args.sizeBytes > MAX_FILE_BYTES) {
      await ctx.storage.delete(args.storageId);
      throw new Error("File exceeds 20MB maximum upload size");
    }

    const mimeAllowed = ALLOWED_MIME_TYPES.has(args.contentType.toLowerCase());
    if (!mimeAllowed && !hasAllowedExtension(args.fileName)) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP, DICOM");
    }

    const now = Date.now();
    const settings = await getChartDocumentSettings(ctx);
    const retentionDaysByCategory = buildRetentionDaysByCategory(settings);
    const retentionPolicyDays = retentionDaysByCategory[args.category];
    const expiresAt = now + retentionPolicyDays * 24 * 60 * 60 * 1000;

    const documentId = await ctx.db.insert("chartDocuments", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      storageId: args.storageId,
      category: args.category,
      fileName: args.fileName,
      title: args.title,
      notes: args.notes,
      contentType: args.contentType,
      sizeBytes: args.sizeBytes,
      uploadedBy: args.uploadedBy,
      uploadedByRole: args.uploadedByRole,
      uploadedAt: now,
      retentionPolicyDays,
      expiresAt,
      isArchived: false,
    });

    await writeAuditLog(ctx, {
      encounterId: args.encounterId,
      patientId: args.patientId,
      documentId,
      action: "UPLOAD",
      actorName: args.uploadedBy,
      actorRole: args.uploadedByRole,
      fileName: args.fileName,
      category: args.category,
    });

    return documentId;
  },
});

export const listByEncounter = query({
  args: {
    encounterId: v.id("encounters"),
    category: v.optional(documentCategory),
    actorRole: staffRole,
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!canView(args.actorRole)) {
      return [];
    }

    const rows = await ctx.db
      .query("chartDocuments")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const filtered = args.category
      ? rows.filter((row) => row.category === args.category)
      : rows;

    const visible = args.includeArchived
      ? filtered
      : filtered.filter((row) => !row.isArchived);

    const sorted = [...visible].sort((a, b) => b.uploadedAt - a.uploadedAt);

    return await Promise.all(
      sorted.map(async (doc) => ({
        ...doc,
        fileUrl: await ctx.storage.getUrl(doc.storageId),
      }))
    );
  },
});

export const removeDocument = mutation({
  args: {
    documentId: v.id("chartDocuments"),
    actorName: v.string(),
    actorRole: staffRole,
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");

    if (!canDelete(args.actorRole)) {
      await writeAuditLog(ctx, {
        encounterId: doc.encounterId,
        patientId: doc.patientId,
        documentId: doc._id,
        action: "ACCESS_DENIED",
        actorName: args.actorName,
        actorRole: args.actorRole,
        fileName: doc.fileName,
        category: doc.category,
        note: "Delete attempted without sufficient permissions",
      });
      throw new Error("You do not have permission to delete chart files");
    }

    await writeAuditLog(ctx, {
      encounterId: doc.encounterId,
      patientId: doc.patientId,
      documentId: doc._id,
      action: "DELETE",
      actorName: args.actorName,
      actorRole: args.actorRole,
      fileName: doc.fileName,
      category: doc.category,
    });

    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(args.documentId);
  },
});

export const logDocumentAccess = mutation({
  args: {
    documentId: v.id("chartDocuments"),
    action: accessAction,
    actorName: v.string(),
    actorRole: staffRole,
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");

    if (!canView(args.actorRole)) {
      await writeAuditLog(ctx, {
        encounterId: doc.encounterId,
        patientId: doc.patientId,
        documentId: doc._id,
        action: "ACCESS_DENIED",
        actorName: args.actorName,
        actorRole: args.actorRole,
        fileName: doc.fileName,
        category: doc.category,
        note: `Tried to ${args.action.toLowerCase()} without chart access`,
      });
      throw new Error("You do not have permission to access chart files");
    }

    await writeAuditLog(ctx, {
      encounterId: doc.encounterId,
      patientId: doc.patientId,
      documentId: doc._id,
      action: args.action,
      actorName: args.actorName,
      actorRole: args.actorRole,
      fileName: doc.fileName,
      category: doc.category,
    });
  },
});

export const applyRetentionByEncounter = mutation({
  args: {
    encounterId: v.id("encounters"),
    actorName: v.string(),
    actorRole: staffRole,
  },
  handler: async (ctx, args) => {
    if (!canView(args.actorRole)) {
      throw new Error("You do not have permission to apply retention policies");
    }

    const now = Date.now();
    const settings = await getChartDocumentSettings(ctx);
    const retentionDaysByCategory = buildRetentionDaysByCategory(settings);
    const purgeGraceDaysByCategory = buildPurgeGraceDaysByCategory(settings);
    const docs = await ctx.db
      .query("chartDocuments")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    return await archiveAndPurgeDocuments(ctx, {
      docs,
      retentionDaysByCategory,
      purgeGraceDaysByCategory,
      now,
      actorName: args.actorName,
      actorRole: args.actorRole,
    });
  },
});

export const runGlobalRetentionSweep = internalMutation({
  args: {
    actorName: v.optional(v.string()),
    actorRole: v.optional(staffRole),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const actorName = args.actorName?.trim() || SYSTEM_RETENTION_ACTOR_NAME;
    const actorRole = args.actorRole ?? "ADMIN";
    const settings = await getChartDocumentSettings(ctx);
    const retentionDaysByCategory = buildRetentionDaysByCategory(settings);
    const purgeGraceDaysByCategory = buildPurgeGraceDaysByCategory(settings);
    const sweepIntervalHours = settings?.sweepIntervalHours ?? DEFAULT_SWEEP_INTERVAL_HOURS;
    const sweepIntervalMs = sweepIntervalHours * 60 * 60 * 1000;

    if (settings?.lastGlobalSweepAt && now - settings.lastGlobalSweepAt < sweepIntervalMs) {
      return {
        scannedCount: 0,
        archivedCount: 0,
        hardDeletedCount: 0,
        skipped: true,
        nextEligibleAt: settings.lastGlobalSweepAt + sweepIntervalMs,
      };
    }

    const docs = await ctx.db.query("chartDocuments").collect();
    const { archivedCount, hardDeletedCount } = await archiveAndPurgeDocuments(ctx, {
      docs,
      retentionDaysByCategory,
      purgeGraceDaysByCategory,
      now,
      actorName,
      actorRole,
    });

    if (settings) {
      await ctx.db.patch(settings._id, {
        lastGlobalSweepAt: now,
      });
    } else {
      const defaultRetentionDaysByCategory = buildRetentionDaysByCategory(undefined);
      const defaultPurgeGraceDaysByCategory = buildPurgeGraceDaysByCategory(undefined);

      await ctx.db.insert("chartDocumentSettings", {
        singletonKey: SETTINGS_SINGLETON_KEY,
        miscRetentionDays: defaultRetentionDaysByCategory.MISC,
        miscArchivePurgeGraceDays: defaultPurgeGraceDaysByCategory.MISC,
        retentionDaysByCategory: defaultRetentionDaysByCategory,
        purgeGraceDaysByCategory: defaultPurgeGraceDaysByCategory,
        sweepIntervalHours: DEFAULT_SWEEP_INTERVAL_HOURS,
        lastGlobalSweepAt: now,
        updatedAt: now,
        updatedBy: actorName,
        updatedByRole: actorRole,
      });
    }

    return {
      scannedCount: docs.length,
      archivedCount,
      hardDeletedCount,
      skipped: false,
    };
  },
});

export const getAuditByEncounter = query({
  args: {
    encounterId: v.id("encounters"),
    actorRole: staffRole,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!canView(args.actorRole)) {
      return [];
    }

    const logs = await ctx.db
      .query("chartDocumentAuditLogs")
      .withIndex("by_encounter_timestamp", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const sorted = [...logs].sort((a, b) => b.timestamp - a.timestamp);
    return sorted.slice(0, args.limit ?? 25);
  },
});
