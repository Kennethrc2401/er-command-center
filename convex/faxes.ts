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
      direction: "inbound",
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

export const sendOutbound = mutation({
  args: {
    recipientName: v.string(),
    toFaxNumber: v.string(),
    subject: v.string(),
    coverMessage: v.optional(v.string()),
    patientId: v.optional(v.id("patients")),
    encounterId: v.optional(v.id("encounters")),
    sentBy: v.string(),
    from: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const recipientName = args.recipientName.trim();
    const toFaxNumber = args.toFaxNumber.trim();
    const subject = args.subject.trim();

    if (!recipientName || !toFaxNumber || !subject) {
      throw new Error("Recipient, fax number, and subject are required.");
    }

    return await ctx.db.insert("faxes", {
      from: args.from?.trim() || "Nexus ER Command Center",
      recipientName,
      toFaxNumber,
      faxNumber: toFaxNumber,
      subject,
      coverMessage: args.coverMessage?.trim() || undefined,
      patientId: args.patientId,
      encounterId: args.encounterId,
      sentBy: args.sentBy,
      sentAt: Date.now(),
      timestamp: Date.now(),
      direction: "outbound",
      status: "sent",
      pages: 1,
      documentUrl: "https://example.com/outbound-fax-preview.pdf",
    });
  },
});