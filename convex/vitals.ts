import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const staffRole = v.union(
  v.literal("ADMIN"),
  v.literal("DOCTOR"),
  v.literal("NURSE"),
  v.literal("CCMA"),
  v.literal("UNKNOWN")
);

const SEPSIS_ACK_PREFIX = "[SEPSIS_WATCH_ACK]";

function buildSepsisAckContent(payload: {
  triggeredAt: number;
  signals: string[];
  actorRole: "ADMIN" | "DOCTOR" | "NURSE" | "CCMA" | "UNKNOWN";
}) {
  return `${SEPSIS_ACK_PREFIX}${JSON.stringify(payload)}`;
}

function parseSepsisAckContent(content: string) {
  if (!content.startsWith(SEPSIS_ACK_PREFIX)) return null;

  try {
    const raw = content.slice(SEPSIS_ACK_PREFIX.length);
    const parsed = JSON.parse(raw) as {
      triggeredAt?: number;
      signals?: string[];
      actorRole?: "ADMIN" | "DOCTOR" | "NURSE" | "CCMA" | "UNKNOWN";
    };

    if (!parsed || typeof parsed.triggeredAt !== "number") return null;

    return {
      triggeredAt: parsed.triggeredAt,
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      actorRole: parsed.actorRole ?? "UNKNOWN",
    };
  } catch {
    return null;
  }
}

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
      bp: v.bp,
      spO2: v.spO2,
      temp: v.temp,
      recordedAt: v.recordedAt,
    }));
  },
});

export const acknowledgeSepsisWatch = mutation({
  args: {
    encounterId: v.id("encounters"),
    actorName: v.string(),
    actorRole: staffRole,
    triggeredAt: v.number(),
    signals: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    const now = Date.now();

    const ackId = await ctx.db.insert("notes", {
      encounterId: args.encounterId,
      content: buildSepsisAckContent({
        triggeredAt: args.triggeredAt,
        signals: args.signals,
        actorRole: args.actorRole,
      }),
      author: args.actorName,
      category: "Nursing",
      isTemplate: false,
    });

    return {
      ackId,
      acknowledgedAt: now,
      acknowledgedBy: args.actorName,
      acknowledgedByRole: args.actorRole,
      triggeredAt: args.triggeredAt,
      signals: args.signals,
    };
  },
});

export const getLatestSepsisWatchAck = query({
  args: {
    encounterId: v.id("encounters"),
  },
  handler: async (ctx, args) => {
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .order("desc")
      .collect();

    for (const note of notes) {
      const parsed = parseSepsisAckContent(note.content);
      if (!parsed) continue;

      return {
        acknowledgedAt: note._creationTime,
        acknowledgedBy: note.author,
        acknowledgedByRole: parsed.actorRole,
        triggeredAt: parsed.triggeredAt,
        signals: parsed.signals,
      };
    }

    return null;
  },
});