import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { mustBeDoctor } from "./auth";

// Mutation to create a note (Server-side)
export const create = mutation({
  args: {
    encounterId: v.id("encounters"),
    content: v.string(),
    type: v.union(
      v.literal("Progress Note"),
      v.literal("Consult"),
      v.literal("Procedure")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await mustBeDoctor(ctx);

    // Build a professional name: "John Doe" or "Jane Smith"
    // Fallback to identity.name if individual parts are missing
    const fullName = identity.givenName && identity.familyName 
      ? `${identity.givenName} ${identity.familyName}`
      : identity.name || "Unknown Provider";

    return await ctx.db.insert("clinicalNotes", {
      encounterId: args.encounterId,
      content: args.content,
      type: args.type,
      authorName: fullName, // Matches Schema
      authorRole: identity.role as string, // Matches Schema
      signedAt: Date.now(), // Matches Schema
    });
  },
});

// Query to fetch notes (Server-side)
export const getByEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clinicalNotes")
      .filter((q) => q.eq(q.field("encounterId"), args.encounterId))
      .order("desc") // Most recent documentation first
      .collect();
  },
});

// Add Notes
export const addNote = mutation({
  args: {
    encounterId: v.id("encounters"),
    content: v.string(),
    author: v.string(),
    category: v.union(v.literal("Triage"), v.literal("Nursing"), v.literal("Procedure")),
    isTemplate: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await mustBeDoctor(ctx);

    // Build a professional name: "John Doe" or "Jane Smith"
    // Fallback to identity.name if individual parts are missing
    const fullName = identity.givenName && identity.familyName 
      ? `${identity.givenName} ${identity.familyName}`
      : identity.name || "Unknown Provider";

    return await ctx.db.insert("notes", {
      encounterId: args.encounterId,
      content: args.content,
      author: fullName,
      category: args.category,
      isTemplate: args.isTemplate,
    });
  },
});