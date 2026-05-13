import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";

// Lightweight, defensive implementations for workflow APIs that the frontend
// expects. These are intentionally minimal so the dev server exposes the
// expected public functions while relying on existing tables.

export const getThroughputBoard = query({
  args: v.object({}),
  handler: async (ctx: QueryCtx) => {
    const now = Date.now();
    const activeEncounters = await ctx.db
      .query("encounters")
      .withIndex("by_status")
      .filter((q) => q.neq(q.field("status"), "discharged"))
      .collect();

    const rows = await Promise.all(
      activeEncounters.map(async (encounter) => {
        const patient = encounter.patientId ? await ctx.db.get(encounter.patientId) : null;
        const acuity = typeof encounter.acuity === "number" ? encounter.acuity : 5;
        const ageMinutes = Math.max(0, Math.floor((now - (encounter._creationTime ?? now)) / 60000));
        const stageAgeMinutes = Math.max(0, Math.floor((now - (encounter.flowStageUpdatedAt ?? encounter._creationTime ?? now)) / 60000));

        const delayReason = encounter.delayReason ?? "none";
        let columnKey: "frontDoor" | "workup" | "disposition" | "blocked" = "workup";
        if (delayReason !== "none") columnKey = "blocked";
        else if ((encounter.status ?? "") === "waiting") columnKey = "frontDoor";
        else if ((encounter.dispositionPlan ?? "") === "discharge") columnKey = "disposition";

        return {
          _id: encounter._id,
          patientId: encounter.patientId,
          patientName: patient?.name ?? encounter.patientName ?? "Unknown Patient",
          mrn: patient?.mrn ?? "N/A",
          acuity,
          chiefComplaint: encounter.chiefComplaint ?? "Unspecified",
          status: encounter.status ?? "waiting",
          location: encounter.location ?? "",
          assignedProvider: encounter.assignedProvider ?? "",
          flowOwner: encounter.flowOwner ?? "",
          flowStage: encounter.flowStage ?? "unknown",
          flowStageUpdatedAt: encounter.flowStageUpdatedAt ?? encounter._creationTime,
          dispositionPlan: encounter.dispositionPlan ?? "undecided",
          delayReason,
          delayNote: encounter.delayNote ?? "",
          estimatedDischargeTime: encounter.estimatedDischargeTime,
          pendingLabCount: 0,
          pendingImagingCount: 0,
          criticalLabCount: 0,
          hasActiveConsult: false,
          ageMinutes,
          stageAgeMinutes,
          columnKey,
          isBlocked: columnKey === "blocked",
        };
      })
    );

    return rows.sort((a, b) => {
      if (a.columnKey !== b.columnKey) return a.columnKey.localeCompare(b.columnKey);
      if (a.acuity !== b.acuity) return a.acuity - b.acuity;
      return b.ageMinutes - a.ageMinutes;
    });
  },
});

export const getProviderWorkload = query({
  args: v.object({}),
  handler: async (ctx: QueryCtx) => {
    // Simple provider workload: count assigned encounters per provider
    const roster = await ctx.db.query("users").withIndex("by_role").filter((q) => q.eq(q.field("role"), "DOCTOR")).collect();
    const encounters = await ctx.db.query("encounters").collect();

    return roster.map((user) => {
      const assignedCount = encounters.filter((e) => e.assignedProvider === user._id).length;
      return {
        name: user.name ?? "Unknown",
        assignedCount,
        highAcuityCount: 0,
        acuityWeightedLoad: assignedCount,
        blockedCount: 0,
        readyDischargeCount: 0,
        openAlertCount: 0,
      };
    });
  },
});

export const getAssignmentRecommendations = query({
  args: v.object({}),
  handler: async (ctx: QueryCtx) => {
    // Minimal: no recommendations, return empty array for now.
    return [] as { recommendedProviderId: string; reason: string }[];
  },
});

export const getIncidentRoutingDiagnostics = query({
  args: v.object({ limit: v.optional(v.number()) }),
  handler: async (ctx: QueryCtx, args: { limit?: number }) => {
    // Defensive empty diagnostics until a richer implementation is added.
    return [] as { incidentId: string; status: string }[];
  },
});

// Lightweight stub for operations intelligence entrypoint
export const getOperationsIntelligenceSuite = query({
  args: v.object({}),
  handler: async (ctx: QueryCtx) => {
    return { status: "ok", summary: {} } as { status: string; summary: Record<string, unknown> };
  },
});

export const getOperationalAcknowledgementTimeline = query({
  args: v.object({ limit: v.optional(v.number()) }),
  handler: async (ctx: QueryCtx, args: { limit?: number }) => {
    // Return mock operational acknowledgement timeline
    return [] as { id: string; timestamp: number; actor: string; action: string }[];
  },
});

export const getOperationalAlerts = query({
  args: v.object({ limit: v.optional(v.number()) }),
  handler: async (ctx: QueryCtx, args: { limit?: number }) => {
    // Return mock operational alerts
    return [] as { id: string; severity: string; message: string }[];
  },
});

export const getShiftReplay = query({
  args: v.object({ limit: v.optional(v.number()) }),
  handler: async (ctx: QueryCtx, args: { limit?: number }) => {
    // Return mock shift replay
    return [] as { timestamp: number; event: string; actor: string }[];
  },
});

export const getRoomTurnoverQueue = query({
  args: v.object({ limit: v.optional(v.number()) }),
  handler: async (ctx: QueryCtx, args: { limit?: number }) => {
    // Return mock room turnover queue
    return [] as { roomId: string; status: string; estimatedTime: number }[];
  },
});

export const getProviderFairnessSignals = query({
  args: v.object({ limit: v.optional(v.number()) }),
  handler: async (ctx: QueryCtx, args: { limit?: number }) => {
    // Return mock provider fairness signals
    return [] as { providerId: string; signal: string; value: number }[];
  },
});

// Acknowledge an operational alert (no-op stub)
export const acknowledgeOperationalAlert = mutation({
  args: v.object({ alertId: v.string() }),
  handler: async (ctx: MutationCtx, args: { alertId: string }) => {
    return { ok: true } as const;
  },
});

// Get shared watchlist entries for a unit
export const getSharedWatchlist = query({
  args: v.object({ unit: v.string() }),
  handler: async (ctx: QueryCtx, args: { unit: string }) => {
    const entries = await ctx.db
      .query("sharedWatchlists")
      .withIndex("by_unit", (q) => q.eq("unit", args.unit))
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const encounter = await ctx.db.get(entry.encounterId);
        const patient = encounter?.patientId ? await ctx.db.get(encounter.patientId) : null;
        return {
          ...entry,
          encounter: encounter ?? null,
          patient: patient ?? null,
        };
      })
    );

    return { entries: enriched };
  },
});

// Upsert a watchlist entry
export const upsertSharedWatchlistEntry = mutation({
  args: v.object({
    unit: v.string(),
    encounterId: v.id("encounters"),
    note: v.optional(v.string()),
    pinnedBy: v.string(),
  }),
  handler: async (
    ctx: MutationCtx,
    args: { unit: string; encounterId: any; note?: string; pinnedBy: string }
  ) => {
    const now = Date.now();

    // Check if entry already exists
    const existing = await ctx.db
      .query("sharedWatchlists")
      .withIndex("by_unit_encounter", (q) =>
        q.eq("unit", args.unit).eq("encounterId", args.encounterId)
      )
      .first();

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        note: args.note,
        pinnedBy: args.pinnedBy,
        updatedAt: now,
      });
      return { ok: true, _id: existing._id };
    } else {
      // Create new entry
      const _id = await ctx.db.insert("sharedWatchlists", {
        unit: args.unit,
        encounterId: args.encounterId,
        note: args.note,
        pinnedBy: args.pinnedBy,
        pinnedAt: now,
        updatedAt: now,
      });
      return { ok: true, _id };
    }
  },
});
