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
  args: { taskId: v.id("checklists") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    await ctx.db.patch(args.taskId, {
      completed: !task.completed,
      completedBy: !task.completed ? "Sophia Amanda Ramirez, RN" : undefined,
    });
  },
});