import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// 📥 Fetch all faxes (or filter by status)
export const getInbox = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    try {
      if (args.status) {
        return await ctx.db
          .query("faxes")
          .withIndex("by_status", (q) => q.eq("status", args.status))
          .order("desc")
          .collect();
      }
      return await ctx.db.query("faxes").order("desc").collect();
    } catch (error) {
      console.error("faxes:getInbox failed", { error, status: args.status });
      // Return an empty list instead of throwing to the client so the page remains usable.
      return [];
    }
  },
});

// 🔄 Update Fax Status (Process, Archive, Trash)
export const updateStatus = mutation({
  args: { 
    id: v.id("faxes"), 
    status: v.string() 
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// 📤 Simulate receiving a new fax (For testing/demo)
export const simulateIncoming = mutation({
  args: {
    from: v.string(),
    subject: v.string(),
    pages: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("faxes", {
      from: args.from,
      subject: args.subject,
      pages: args.pages,
      faxNumber: "(201) 555-0199",
      status: "received",
      documentUrl: "https://example.com/fax-preview.pdf",
      timestamp: Date.now(),
    });
  },
});

export const linkToPatient = mutation({
  args: {
    faxId: v.id("faxes"),
    patientId: v.id("patients"),
    patientName: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Update the fax to link it to the patient
    await ctx.db.patch(args.faxId, {
      status: "processed",
      patientId: args.patientId,
    });

    // 2. (Optional) You could also add an entry to a 'documents' table 
    // or update the encounter notes here.
    return { success: true };
  },
});