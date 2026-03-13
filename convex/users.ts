// convex/users.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const userRoleValidator = v.union(
  v.literal("ADMIN"),
  v.literal("DOCTOR"),
  v.literal("NURSE"),
  v.literal("CCMA")
);

const userStatusValidator = v.union(v.literal("ACTIVE"), v.literal("INACTIVE"));

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const normalizeOptionalString = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

// listAll query to fetch all users
// 🔍 Add this query to fix the error
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .order("asc") // Sort alphabetically by name
      .collect();
  },
});

export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: userRoleValidator,
    credentials: v.string(),
    department: v.string(),
    npiNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existingUser) {
      throw new Error("A user with this email already exists.");
    }

    return await ctx.db.insert("users", {
      ...args,
      email: normalizedEmail,
      npiNumber: normalizeOptionalString(args.npiNumber),
      status: "ACTIVE",
    });
  },
});

export const updateUser = mutation({
  args: {
    id: v.id("users"),
    name: v.string(),
    email: v.string(),
    role: userRoleValidator,
    credentials: v.string(),
    department: v.string(),
    status: userStatusValidator,
    npiNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existingUser && existingUser._id !== args.id) {
      throw new Error("A user with this email already exists.");
    }

    await ctx.db.patch(args.id, {
      name: args.name,
      email: normalizedEmail,
      role: args.role,
      credentials: args.credentials,
      department: args.department,
      status: args.status,
      npiNumber: normalizeOptionalString(args.npiNumber),
    });
  },
});

export const updateUserRole = mutation({
  args: { id: v.id("users"), role: userRoleValidator },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { role: args.role });
  },
});

export const deleteUser = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});