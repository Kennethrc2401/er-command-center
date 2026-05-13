import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Patient Portal & Messaging Module
 * After-visit summaries, appointment reminders, medication lists, education materials
 */

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all portal messages for patient
 */
export const getPatientMessages = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portalMessages")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .order("desc")
      .collect();
  },
});

/**
 * Get messages for specific encounter
 */
export const getEncounterMessages = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portalMessages")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();
  },
});

/**
 * Get delivery status for message
 */
export const getDeliveryStatus = query({
  args: { messageId: v.id("portalMessages") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portalDeliveryEvents")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .order("desc")
      .collect();
  },
});

/**
 * Get pending messages to send
 */
export const getPendingMessages = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("portalMessages")
      .filter((q) => q.eq(q.field("readyToSend"), true) && q.eq(q.field("sentAt"), undefined))
      .order("desc")
      .take(50);
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Generate discharge summary for patient portal
 */
export const generateDischargeSummary = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    const [encounter, patient] = await Promise.all([
      ctx.db.get(args.encounterId),
      ctx.db.get(args.patientId),
    ]);

    if (!encounter || !patient) throw new Error("Missing encounter or patient");

    // Build summary content
    const summaryContent = buildDischargeSummaryContent(encounter, patient);

    const messageId = await ctx.db.insert("portalMessages", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      messageType: "discharge_summary",
      subject: `Your Visit Summary from ${new Date().toLocaleDateString()}`,
      content: summaryContent,
      generatedAt: Date.now(),
      generatedBy: "discharge-service",
      readyToSend: true,
    });

    // Update encounter
    await ctx.db.patch(args.encounterId, {
      portalSummaryGenerated: true,
      portalDeliveryStatus: "pending",
    });

    return messageId;
  },
});

/**
 * Generate medication list for portal
 */
export const generateMedicationList = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    // Medications table was removed; attempt to build medication list
    // from the encounter record if available (backwards-compatible).
    const encounter = await ctx.db.get(args.encounterId);
    const medications = ((encounter as any)?.medications as any[]) ?? [];

    if (medications.length === 0) {
      return { status: "no_medications" };
    }

    // Build medication list content from encounter.medications
    let medContent = "# Your Current Medications\n\n";
    for (const med of medications) {
      const name = med?.name ?? "(unknown)";
      const dosage = med?.dosage ?? "";
      const route = med?.route ?? "";
      const frequency = med?.frequency ?? "";
      const status = med?.status ?? "";

      medContent += `- **${name}** ${dosage} ${route}\n`;
      if (frequency) medContent += `  Take every ${frequency} hours\n`;
      if (status) medContent += `  Status: ${status}\n\n`;
    }

    const messageId = await ctx.db.insert("portalMessages", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      messageType: "medication_list",
      subject: "Your Medication List",
      content: medContent,
      generatedAt: Date.now(),
      generatedBy: "pharmacy-service",
      readyToSend: true,
    });

    return messageId;
  },
});

/**
 * Generate patient education content
 */
export const generateEducationContent = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    diagnosis: v.string(),
    literacyLevel: v.union(v.literal("standard"), v.literal("simple")),
  },
  handler: async (ctx, args) => {
    const educationContent = buildPatientEducationContent(args.diagnosis, args.literacyLevel);

    const messageId = await ctx.db.insert("portalMessages", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      messageType: "education",
      subject: `Understanding ${args.diagnosis}`,
      content: educationContent,
      generatedAt: Date.now(),
      generatedBy: "education-service",
      readyToSend: true,
    });

    return messageId;
  },
});

/**
 * Generate appointment reminder
 */
export const generateAppointmentReminder = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    specialty: v.string(),
    provider: v.string(),
    appointmentDate: v.string(),
    appointmentTime: v.string(),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reminderContent = `
# Upcoming Appointment Reminder

Your appointment has been scheduled with **${args.provider}** (${args.specialty}).

**Date:** ${args.appointmentDate}
**Time:** ${args.appointmentTime}
${args.address ? `**Location:** ${args.address}` : ""}

Please arrive 15 minutes early. Bring your insurance card and photo ID.

If you need to reschedule, please call us at least 24 hours in advance.
    `.trim();

    const messageId = await ctx.db.insert("portalMessages", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      messageType: "appointment_reminder",
      subject: `Reminder: Appointment with ${args.provider}`,
      content: reminderContent,
      generatedAt: Date.now(),
      generatedBy: "scheduling-service",
      readyToSend: true,
    });

    return messageId;
  },
});

/**
 * Generate follow-up instructions
 */
export const generateFollowUpInstructions = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    diagnosis: v.string(),
    instructions: v.array(v.string()),
    redFlags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    let content = `# Follow-Up Instructions for ${args.diagnosis}\n\n`;
    content += "## What You Should Do:\n\n";
    for (const instruction of args.instructions) {
      content += `- ${instruction}\n`;
    }

    content += "\n## When to Seek Immediate Care:\n\n";
    for (const flag of args.redFlags) {
      content += `- ${flag}\n`;
    }

    content += "\n**If you experience any of these symptoms, go to the nearest emergency room or call 911.**\n";

    const messageId = await ctx.db.insert("portalMessages", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      messageType: "follow_up_instructions",
      subject: "Your After-Visit Care Instructions",
      content,
      generatedAt: Date.now(),
      generatedBy: "discharge-service",
      readyToSend: true,
    });

    return messageId;
  },
});

/**
 * Send message via portal delivery channel
 */
export const sendPortalMessage = mutation({
  args: {
    messageId: v.id("portalMessages"),
    deliveryChannels: v.array(
      v.union(v.literal("sms"), v.literal("email"), v.literal("portal"), v.literal("push"))
    ),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    // Mark message as sent
    await ctx.db.patch(args.messageId, {
      sentAt: Date.now(),
    });

    // Create delivery events for each channel
    const deliveryIds: Array<Id<"portalDeliveryEvents">> = [];
    for (const channel of args.deliveryChannels) {
      // Mock: Simulate sending (in production, call actual SMS/Email services)
      const deliveryId = await ctx.db.insert("portalDeliveryEvents", {
        messageId: args.messageId,
        encounterId: message.encounterId,
        patientId: message.patientId,
        deliveryChannel: channel,
        deliveryStatus: channel === "portal" ? "delivered" : "sent", // Portal is instant, others pending
        attemptedAt: Date.now(),
        deliveredAt: channel === "portal" ? Date.now() : undefined,
        retryCount: 0,
      });
      deliveryIds.push(deliveryId);
    }

    // Update encounter
    await ctx.db.patch(message.encounterId, {
      portalSummarySentAt: Date.now(),
      portalDeliveryStatus: "sent",
    });

    return { status: "sent", deliveryIds };
  },
});

/**
 * Mark message as read
 */
export const markMessageAsRead = mutation({
  args: {
    messageId: v.id("portalMessages"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      viewedAt: Date.now(),
    });

    return { status: "marked_read" };
  },
});

/**
 * Handle delivery failure and retry
 */
export const retryMessageDelivery = mutation({
  args: {
    deliveryEventId: v.id("portalDeliveryEvents"),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.deliveryEventId);
    if (!event) throw new Error("Delivery event not found");

    if (event.retryCount >= 3) {
      throw new Error("Max retry attempts reached");
    }

    // Update delivery event
    await ctx.db.patch(args.deliveryEventId, {
      retryCount: event.retryCount + 1,
      deliveryStatus: "sent",
      attemptedAt: Date.now(),
    });

    return { status: "retry_queued", retryCount: event.retryCount + 1 };
  },
});

/**
 * Get patient communication preferences
 */
export const getPatientCommunicationPreferences = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const patient = await ctx.db.get(args.patientId);
    if (!patient) throw new Error("Patient not found");

    return {
      portalEnabled: patient.portalEnabled ?? true,
      smsOptIn: patient.smsOptIn ?? true,
      emailOptIn: patient.emailOptIn ?? true,
      preferredLanguage: patient.portalLanguagePreference || "en",
    };
  },
});

/**
 * Update patient communication preferences
 */
export const updateCommunicationPreferences = mutation({
  args: {
    patientId: v.id("patients"),
    portalEnabled: v.optional(v.boolean()),
    smsOptIn: v.optional(v.boolean()),
    emailOptIn: v.optional(v.boolean()),
    languagePreference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    if (args.portalEnabled !== undefined) updates.portalEnabled = args.portalEnabled;
    if (args.smsOptIn !== undefined) updates.smsOptIn = args.smsOptIn;
    if (args.emailOptIn !== undefined) updates.emailOptIn = args.emailOptIn;
    if (args.languagePreference) updates.portalLanguagePreference = args.languagePreference;

    await ctx.db.patch(args.patientId, updates);

    return { status: "updated" };
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildDischargeSummaryContent(encounter: any, patient: any): string {
  const summary = `
# Your Visit Summary

**Date of Visit:** ${new Date(encounter.createdAt || Date.now()).toLocaleDateString()}
**Patient:** ${patient.name}

## Chief Complaint
${encounter.chiefComplaint}

## Vital Signs
- **Heart Rate:** ${encounter.vitals.hr} bpm
- **Blood Pressure:** ${encounter.vitals.bp}
- **Temperature:** ${encounter.vitals.temp}°F
- **Oxygen Saturation:** ${encounter.vitals.spO2}%

## Assessment
You were evaluated for ${encounter.chiefComplaint.toLowerCase()}.

## Plan & Instructions
${encounter.dischargeSummary || "Follow up with your primary care provider as scheduled."}

## Follow-Up
If symptoms worsen or new concerns develop, please contact your physician or return to the emergency department.

---
*This summary is for informational purposes and does not replace professional medical advice.*
  `.trim();

  return summary;
}

function buildPatientEducationContent(diagnosis: string, literacyLevel: string): string {
  if (literacyLevel === "simple") {
    return `
# Understanding ${diagnosis}

## What is ${diagnosis}?
${diagnosis} is a condition that affects your health. Your doctor will help you manage it.

## What You Can Do
1. Take your medicine as told
2. Rest when you feel tired
3. Eat healthy foods
4. Drink plenty of water
5. Follow up with your doctor

## When to Get Help
Go to the emergency room if you:
- Have severe pain
- Can't breathe
- Feel dizzy
- Have chest pain
- Feel faint

## Questions?
Call your doctor's office if you have any questions.
    `.trim();
  }

  return `
# Understanding ${diagnosis}

## What is ${diagnosis}?
${diagnosis} is a medical condition that requires proper management and monitoring.

## Recommended Care Plan
1. Follow all medication instructions exactly as prescribed
2. Attend all scheduled follow-up appointments
3. Monitor your symptoms and report any changes
4. Maintain a healthy lifestyle including diet and exercise
5. Keep detailed records of your health metrics

## When to Seek Urgent Care
Seek immediate medical attention if you experience:
- Severe or worsening symptoms
- Chest pain or difficulty breathing
- Signs of infection (fever, swelling)
- Any symptoms concerning to you

## Additional Resources
Your healthcare provider can direct you to support groups and educational materials specific to your condition.

## Questions?
Contact your provider's office to discuss any concerns about your condition or treatment plan.
  `.trim();
}
