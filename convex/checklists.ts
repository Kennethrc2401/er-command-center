import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getByEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("checklists")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
  },
});

export const toggle = mutation({
  args: {
    taskId: v.id("checklists"),
    completedBy: v.optional(v.string()),
    completedByRole: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const actor = args.completedBy?.trim();
    const role = args.completedByRole?.trim();
    const attributedActor =
      actor && actor.length > 0
        ? role && role.length > 0
          ? `${actor} (${role})`
          : actor
        : "Clinical Staff";

    await ctx.db.patch(args.taskId, {
      completed: !task.completed,
      completedBy: !task.completed ? attributedActor : undefined,
    });
  },
});

export const create = mutation({
  args: {
    encounterId: v.id("encounters"),
    item: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedItem = args.item.trim();
    if (trimmedItem.length < 3) {
      throw new Error("Checklist item must be at least 3 characters");
    }
    if (trimmedItem.length > 140) {
      throw new Error("Checklist item cannot exceed 140 characters");
    }

    return await ctx.db.insert("checklists", {
      encounterId: args.encounterId,
      item: trimmedItem,
      completed: false,
    });
  },
});

export const remove = mutation({
  args: { taskId: v.id("checklists") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    await ctx.db.delete(args.taskId);
  },
});

export const clearCompleted = mutation({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("checklists")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const completedTasks = tasks.filter((task) => task.completed);
    await Promise.all(completedTasks.map((task) => ctx.db.delete(task._id)));

    return { removedCount: completedTasks.length };
  },
});