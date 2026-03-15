import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

const checklistCategoryValidator = v.optional(v.union(v.literal("care"), v.literal("discharge")));

const DISCHARGE_TASKS = [
  { taskKey: "repeat-vitals", item: "Repeat vitals and final RN reassessment", required: true },
  { taskKey: "med-rec", item: "Medication reconciliation completed", required: true },
  { taskKey: "instructions", item: "Discharge instructions reviewed with patient", required: true },
  { taskKey: "follow-up", item: "Follow-up appointment or PCP guidance documented", required: true },
  { taskKey: "ride-home", item: "Safe ride / disposition plan confirmed", required: true },
  { taskKey: "education-signoff", item: "Education and signature workflow completed", required: true },
] as const;

function matchesCategory(
  category: "care" | "discharge" | undefined,
  selected: "care" | "discharge"
) {
  if (selected === "care") {
    return category === undefined || category === "care";
  }
  return category === "discharge";
}

export const getByEncounter = query({
  args: {
    encounterId: v.id("encounters"),
    category: checklistCategoryValidator,
  },
  handler: async (ctx, args) => {
    const selectedCategory = args.category ?? "care";
    const tasks = await ctx.db
      .query("checklists")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    return tasks.filter((task) => matchesCategory(task.category, selectedCategory));
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
      completedAt: !task.completed ? Date.now() : undefined,
    });
  },
});

export const create = mutation({
  args: {
    encounterId: v.id("encounters"),
    item: v.string(),
    category: checklistCategoryValidator,
    required: v.optional(v.boolean()),
    taskKey: v.optional(v.string()),
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
      taskKey: args.taskKey,
      item: trimmedItem,
      completed: false,
      category: args.category ?? "care",
      required: args.required,
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
  args: {
    encounterId: v.id("encounters"),
    category: checklistCategoryValidator,
  },
  handler: async (ctx, args) => {
    const selectedCategory = args.category ?? "care";
    const tasks = await ctx.db
      .query("checklists")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const completedTasks = tasks.filter(
      (task) => task.completed && matchesCategory(task.category, selectedCategory)
    );
    await Promise.all(completedTasks.map((task) => ctx.db.delete(task._id)));

    return { removedCount: completedTasks.length };
  },
});

export const ensureDischargeChecklist = mutation({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("checklists")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const existingKeys = new Set(
      tasks.filter((task) => task.category === "discharge").map((task) => task.taskKey ?? task.item)
    );

    let createdCount = 0;

    for (const task of DISCHARGE_TASKS) {
      if (existingKeys.has(task.taskKey)) continue;

      await ctx.db.insert("checklists", {
        encounterId: args.encounterId,
        taskKey: task.taskKey,
        item: task.item,
        completed: false,
        category: "discharge",
        required: task.required,
      });
      createdCount += 1;
    }

    return { createdCount };
  },
});

export const getDischargeReadiness = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("checklists")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    const dischargeTasks = tasks
      .filter((task) => task.category === "discharge")
      .sort((left, right) => {
        const leftIndex = DISCHARGE_TASKS.findIndex((task) => task.taskKey === (left.taskKey ?? left.item));
        const rightIndex = DISCHARGE_TASKS.findIndex((task) => task.taskKey === (right.taskKey ?? right.item));
        return leftIndex - rightIndex;
      });

    const requiredTasks = dischargeTasks.filter((task) => task.required !== false);
    const completedRequired = requiredTasks.filter((task) => task.completed).length;

    return {
      tasks: dischargeTasks,
      summary: {
        total: dischargeTasks.length,
        completed: dischargeTasks.filter((task) => task.completed).length,
        requiredTotal: requiredTasks.length,
        requiredCompleted: completedRequired,
        requiredRemaining: Math.max(0, requiredTasks.length - completedRequired),
        canDischarge: requiredTasks.length > 0 && completedRequired === requiredTasks.length,
      },
    };
  },
});