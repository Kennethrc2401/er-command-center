import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Academic Scribe: Study notes management for classes
 * Handles transcription, organization, and topic-based retrieval
 */

// ============ QUERIES ============

export const getStudyClassSessions = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const sessions = await ctx.db
      .query("studyClassSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 50);

    return sessions;
  },
});

export const getStudyNotesBySession = query({
  args: {
    sessionId: v.id("studyClassSessions"),
  },
  async handler(ctx, args) {
    const notes = await ctx.db
      .query("studyNotes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Fetch topics for each note
    const notesWithTopics = await Promise.all(
      notes.map(async (note) => {
        const topics = await ctx.db
          .query("studyNoteTopics")
          .withIndex("by_note", (q) => q.eq("noteId", note._id))
          .collect();
        return {
          ...note,
          topics: topics.map((t) => ({
            topic: t.topic,
            frequency: t.frequency,
            context: t.context,
          })),
        };
      })
    );

    return notesWithTopics;
  },
});

export const getNotesBySubject = query({
  args: {
    userId: v.id("users"),
    subject: v.string(),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const notes = await ctx.db
      .query("studyNotes")
      .withIndex("by_subject", (q) => q.eq("subject", args.subject))
      .order("desc")
      .take(args.limit || 100);

    // Filter by user (convex doesn't support chained indexes well, so filter after)
    const userNotes = notes.filter((n) => n.userId === args.userId);

    // Enrich with topic data
    const enriched = await Promise.all(
      userNotes.map(async (note) => {
        const topics = await ctx.db
          .query("studyNoteTopics")
          .withIndex("by_note", (q) => q.eq("noteId", note._id))
          .collect();
        return {
          ...note,
          topics: topics.map((t) => ({
            topic: t.topic,
            frequency: t.frequency,
          })),
        };
      })
    );

    return enriched;
  },
});

export const getStudyNoteDetail = query({
  args: {
    noteId: v.id("studyNotes"),
  },
  async handler(ctx, args) {
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");

    const topics = await ctx.db
      .query("studyNoteTopics")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    return {
      ...note,
      topics: topics.map((t) => ({
        topic: t.topic,
        frequency: t.frequency,
        context: t.context,
      })),
    };
  },
});

export const getTopicIndex = query({
  args: {
    userId: v.id("users"),
    subject: v.string(),
  },
  async handler(ctx, args) {
    // Get all notes for this subject
    const notes = await ctx.db
      .query("studyNotes")
      .withIndex("by_subject", (q) => q.eq("subject", args.subject))
      .collect();

    const userNotes = notes.filter((n) => n.userId === args.userId);

    // Aggregate topics across all notes
    const topicMap = new Map<
      string,
      { topic: string; frequency: number; noteCount: number; noteIds: Id<"studyNotes">[] }
    >();

    for (const note of userNotes) {
      const topics = await ctx.db
        .query("studyNoteTopics")
        .withIndex("by_note", (q) => q.eq("noteId", note._id))
        .collect();

      for (const t of topics) {
        if (topicMap.has(t.topic)) {
          const existing = topicMap.get(t.topic)!;
          existing.frequency += t.frequency;
          existing.noteCount += 1;
          if (!existing.noteIds.includes(note._id)) {
            existing.noteIds.push(note._id);
          }
        } else {
          topicMap.set(t.topic, {
            topic: t.topic,
            frequency: t.frequency,
            noteCount: 1,
            noteIds: [note._id],
          });
        }
      }
    }

    // Sort by frequency
    return Array.from(topicMap.values()).sort(
      (a, b) => b.frequency - a.frequency
    );
  },
});

export const getStudyToolsState = query({
  args: {
    userId: v.id("users"),
    subject: v.string(),
  },
  async handler(ctx, args) {
    const existing = await ctx.db
      .query("studyToolsState")
      .withIndex("by_user_subject", (q) => q.eq("userId", args.userId).eq("subject", args.subject))
      .first();

    return existing ?? null;
  },
});

// ============ MUTATIONS ============

export const createStudySession = mutation({
  args: {
    userId: v.id("users"),
    subject: v.string(),
    className: v.string(),
    professor: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const sessionId = await ctx.db.insert("studyClassSessions", {
      userId: args.userId,
      subject: args.subject,
      className: args.className,
      professor: args.professor || undefined,
      startedAt: Date.now(),
      status: "recording",
    });

    return sessionId;
  },
});

export const endStudySession = mutation({
  args: {
    sessionId: v.id("studyClassSessions"),
    durationMinutes: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const durationMinutes = Math.max(
      1,
      Math.round(
        args.durationMinutes ?? (Date.now() - session.startedAt) / 1000 / 60
      )
    );

    await ctx.db.patch(args.sessionId, {
      endedAt: Date.now(),
      durationMinutes,
      status: "completed",
    });

    return { success: true, durationMinutes };
  },
});

export const createStudyNote = mutation({
  args: {
    sessionId: v.id("studyClassSessions"),
    userId: v.id("users"),
    rawTranscription: v.string(),
    subject: v.string(),
    topics: v.optional(v.array(v.string())),
  },
  async handler(ctx, args) {
    const now = Date.now();

    const noteId = await ctx.db.insert("studyNotes", {
      sessionId: args.sessionId,
      userId: args.userId,
      rawTranscription: args.rawTranscription,
      content: args.rawTranscription, // Start with raw, will be edited
      subject: args.subject,
      organizationStatus: "raw",
      topics: args.topics || [],
      createdAt: now,
      updatedAt: now,
    });

    // Create topic entries if provided
    if (args.topics && args.topics.length > 0) {
      for (const topic of args.topics) {
        await ctx.db.insert("studyNoteTopics", {
          noteId,
          topic,
          frequency: 1,
        });
      }
    }

    return noteId;
  },
});

export const updateStudyNoteContent = mutation({
  args: {
    noteId: v.id("studyNotes"),
    content: v.string(),
    organizationStatus: v.optional(
      v.union(v.literal("raw"), v.literal("organized"), v.literal("summarized"))
    ),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.noteId, {
      content: args.content,
      organizationStatus: args.organizationStatus || "organized",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const addTopicsToNote = mutation({
  args: {
    noteId: v.id("studyNotes"),
    topics: v.array(
      v.object({
        topic: v.string(),
        context: v.optional(v.string()),
      })
    ),
  },
  async handler(ctx, args) {
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");

    // Get existing topics to update frequencies
    const existingTopics = await ctx.db
      .query("studyNoteTopics")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    const topicMap = new Map(existingTopics.map((t) => [t.topic, t]));

    for (const newTopic of args.topics) {
      if (topicMap.has(newTopic.topic)) {
        const existing = topicMap.get(newTopic.topic)!;
        await ctx.db.patch(existing._id, {
          frequency: existing.frequency + 1,
          context: newTopic.context || existing.context,
        });
      } else {
        await ctx.db.insert("studyNoteTopics", {
          noteId: args.noteId,
          topic: newTopic.topic,
          frequency: 1,
          context: newTopic.context,
        });
      }
    }

    // Update note's topic array
    const allTopics = Array.from(new Set([...note.topics, ...args.topics.map((t) => t.topic)]));
    await ctx.db.patch(args.noteId, {
      topics: allTopics,
      updatedAt: Date.now(),
    });

    return { success: true, topicCount: allTopics.length };
  },
});

export const updateNoteSummary = mutation({
  args: {
    noteId: v.id("studyNotes"),
    summary: v.string(),
    keyPoints: v.optional(v.array(v.string())),
    definitions: v.optional(
      v.array(
        v.object({
          term: v.string(),
          definition: v.string(),
        })
      )
    ),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.noteId, {
      summary: args.summary,
      keyPoints: args.keyPoints,
      definitions: args.definitions,
      organizationStatus: "summarized",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const exportStudyNote = mutation({
  args: {
    noteId: v.id("studyNotes"),
    format: v.union(v.literal("markdown"), v.literal("pdf"), v.literal("txt")),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.noteId, {
      exportedAt: Date.now(),
      exportFormat: args.format,
    });

    return { success: true, exportedAt: Date.now() };
  },
});

export const deleteStudyNote = mutation({
  args: {
    noteId: v.id("studyNotes"),
  },
  async handler(ctx, args) {
    // Delete associated topics
    const topics = await ctx.db
      .query("studyNoteTopics")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    for (const topic of topics) {
      await ctx.db.delete(topic._id);
    }

    // Delete note
    await ctx.db.delete(args.noteId);

    return { success: true };
  },
});

export const upsertStudyToolsState = mutation({
  args: {
    userId: v.id("users"),
    subject: v.string(),
    masteryByTopic: v.record(
      v.string(),
      v.union(v.literal("NEW"), v.literal("LEARNING"), v.literal("CONFIDENT"))
    ),
    reviewCardState: v.record(
      v.string(),
      v.object({
        intervalDays: v.number(),
        dueAt: v.number(),
        lastReviewedAt: v.optional(v.number()),
      })
    ),
    completedActionItems: v.record(v.string(), v.boolean()),
    sourceLinksByNote: v.record(v.string(), v.array(v.string())),
    practiceTests: v.optional(
      v.array(
        v.object({
          id: v.string(),
          numQuestions: v.number(),
          timeLimit: v.number(),
          takenAt: v.number(),
          score: v.number(),
        })
      )
    ),
    weakTopicPerformance: v.optional(
      v.record(
        v.string(),
        v.object({
          correctCount: v.number(),
          totalCount: v.number(),
          lastReviewedAt: v.number(),
        })
      )
    ),
    sessionTimeByTopic: v.optional(
      v.record(
        v.string(),
        v.object({
          totalMinutes: v.number(),
          sessionCount: v.number(),
        })
      )
    ),
    mockExams: v.optional(
      v.array(
        v.object({
          id: v.string(),
          numQuestions: v.number(),
          timeLimit: v.number(),
          targetScore: v.number(),
          takenAt: v.optional(v.number()),
          score: v.optional(v.number()),
          createdAt: v.number(),
        })
      )
    ),
    studyStreak: v.optional(
      v.object({
        currentStreak: v.number(),
        longestStreak: v.number(),
        lastStudyDate: v.number(),
        totalStudyDays: v.number(),
      })
    ),
    performanceHistory: v.optional(
      v.array(
        v.object({
          date: v.number(),
          topic: v.string(),
          accuracy: v.number(),
          averageTimePerQuestion: v.number(),
        })
      )
    ),
    conceptMapLinks: v.optional(
      v.array(
        v.object({
          fromTopic: v.string(),
          toTopic: v.string(),
          relationshipType: v.string(),
        })
      )
    ),
  },
  async handler(ctx, args) {
    const existing = await ctx.db
      .query("studyToolsState")
      .withIndex("by_user_subject", (q) => q.eq("userId", args.userId).eq("subject", args.subject))
      .first();

    const payload = {
      userId: args.userId,
      subject: args.subject,
      masteryByTopic: args.masteryByTopic,
      reviewCardState: args.reviewCardState,
      completedActionItems: args.completedActionItems,
      sourceLinksByNote: args.sourceLinksByNote,
      practiceTests: args.practiceTests ?? [],
      weakTopicPerformance: args.weakTopicPerformance ?? {},
      sessionTimeByTopic: args.sessionTimeByTopic ?? {},
      mockExams: args.mockExams ?? [],
      studyStreak: args.studyStreak ?? { currentStreak: 0, longestStreak: 0, lastStudyDate: 0, totalStudyDays: 0 },
      performanceHistory: args.performanceHistory ?? [],
      conceptMapLinks: args.conceptMapLinks ?? [],
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("studyToolsState", payload);
  },
});
