import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Epic FHIR Integration Module
 * Handles bidirectional sync with Epic EHR via FHIR standards
 */

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Fetch sync history for an encounter
 */
export const getSyncHistory = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("epicFhirSync")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .order("desc")
      .collect();
  },
});

/**
 * Fetch FHIR resources for a patient
 */
export const getFhirResources = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("fhirResources")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect();
  },
});

/**
 * Get specific FHIR resource by type
 */
export const getFhirResourcesByType = query({
  args: { patientId: v.id("patients"), resourceType: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("fhirResources")
      .withIndex("by_resource_type", (q) => q.eq("resourceType", args.resourceType))
      .filter((q) => q.eq(q.field("patientId"), args.patientId))
      .collect();
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Record a FHIR sync event (pull from Epic)
 */
export const recordSyncEvent = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    epicMRN: v.string(),
    epicEncounterId: v.string(),
    syncDirection: v.union(v.literal("pull"), v.literal("push"), v.literal("bidirectional")),
    resourceType: v.string(),
    fhirResourceId: v.string(),
    syncedFields: v.array(v.string()),
    conflictNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const syncId = await ctx.db.insert("epicFhirSync", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      epicMRN: args.epicMRN,
      epicEncounterId: args.epicEncounterId,
      syncDirection: args.syncDirection,
      resourceType: args.resourceType,
      fhirResourceId: args.fhirResourceId,
      status: args.conflictNote ? "conflict" : "synced",
      syncedFields: args.syncedFields,
      conflictNote: args.conflictNote,
      lastSyncAt: Date.now(),
      syncedBy: "epic-sync-service",
    });

    // Update encounter with Epic identifiers
    await ctx.db.patch(args.encounterId, {
      epicMRN: args.epicMRN,
      epicEncounterId: args.epicEncounterId,
      fhirResourceId: args.fhirResourceId,
    });

    return syncId;
  },
});

/**
 * Store FHIR resource from Epic
 */
export const storeFhirResource = mutation({
  args: {
    patientId: v.id("patients"),
    encounterId: v.optional(v.id("encounters")),
    resourceType: v.string(),
    fhirId: v.string(),
    resourceContent: v.string(), // JSON stringified
    canonicalUrl: v.optional(v.string()),
    sourceSystem: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const resourceId = await ctx.db.insert("fhirResources", {
      patientId: args.patientId,
      encounterId: args.encounterId,
      resourceType: args.resourceType,
      fhirId: args.fhirId,
      resourceContent: args.resourceContent,
      canonicalUrl: args.canonicalUrl,
      status: "active",
      effectiveAt: Date.now(),
      importedAt: Date.now(),
      sourceSystem: args.sourceSystem || "Epic",
    });

    // Also update patient with Epic patient ID
    if (args.resourceType === "Patient") {
      await ctx.db.patch(args.patientId, {
        epicPatientId: args.fhirId,
        fhirPatientResourceId: args.fhirId,
      });
    }

    return resourceId;
  },
});

/**
 * Pull patient data from Epic FHIR server (simulated)
 */
export const pullPatientFromEpic = mutation({
  args: {
    epicMRN: v.string(),
    encounterId: v.optional(v.id("encounters")),
    patientId: v.optional(v.id("patients")),
  },
  handler: async (ctx, args) => {
    // In production, this would call Epic's FHIR API
    // For now, mock the response
    const mockFhirResources = [
      {
        resourceType: "Patient",
        id: `epic-pat-${args.epicMRN}`,
        name: "Mock Patient",
        resourceContent: JSON.stringify({ resourceType: "Patient", id: `epic-pat-${args.epicMRN}` }),
      },
      {
        resourceType: "Observation",
        id: `epic-obs-vital-${Date.now()}`,
        resourceContent: JSON.stringify({ resourceType: "Observation", code: { coding: [{ code: "85354-9" }] } }),
      },
      {
        resourceType: "Condition",
        id: `epic-cond-${Date.now()}`,
        resourceContent: JSON.stringify({ resourceType: "Condition", code: { coding: [{ code: "I10" }] } }),
      },
    ];

    const results: Array<Id<"fhirResources">> = [];
    for (const resource of mockFhirResources) {
      const resourceId = await ctx.db.insert("fhirResources", {
        patientId: args.patientId || ("dummy" as any),
        encounterId: args.encounterId,
        resourceType: resource.resourceType,
        fhirId: resource.id,
        resourceContent: resource.resourceContent,
        status: "active",
        importedAt: Date.now(),
        sourceSystem: "Epic",
      });
      results.push(resourceId);
    }

    if (args.encounterId) {
      await ctx.db.patch(args.encounterId, {
        epicMRN: args.epicMRN,
        fhirResourceId: `epic-pat-${args.epicMRN}`,
      });
    }

    return results;
  },
});

/**
 * Push encounter disposition to Epic ADT feed
 */
export const pushDispositionToEpic = mutation({
  args: {
    encounterId: v.id("encounters"),
    dispositionPlan: v.union(
      v.literal("discharge"),
      v.literal("admit"),
      v.literal("observation"),
      v.literal("transfer")
    ),
    epicEncounterId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    if (!encounter) throw new Error("Encounter not found");

    // In production, this would push via Epic HL7 ADT interface
    // Mock: Log the disposition change
    const logId = await ctx.db.insert("adtEventLog", {
      encounterId: args.encounterId,
      patientId: encounter.patientId,
      eventType:
        args.dispositionPlan === "discharge"
          ? "discharge"
          : args.dispositionPlan === "admit"
            ? "admit"
            : "transfer",
      epicEventId: args.epicEncounterId,
      eventTimestamp: Date.now(),
      pushedToEpicAt: Date.now(),
      pushedBy: "disposition-service",
      status: "sent",
      retryCount: 0,
    });

    // Update encounter
    await ctx.db.patch(args.encounterId, {
      adtEventPushed: true,
      adtEventPushedAt: Date.now(),
    });

    return logId;
  },
});

/**
 * Sync medication list from Epic
 */
export const syncMedicationsFromEpic = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    epicMRN: v.string(),
  },
  handler: async (ctx, args) => {
    // Mock: Create FHIR MedicationRequest resources
    const mockMedications = [
      { name: "Lisinopril", dosage: "10 mg", route: "PO", frequency: 24 },
      { name: "Atorvastatin", dosage: "20 mg", route: "PO", frequency: 24 },
      { name: "Metformin", dosage: "500 mg", route: "PO", frequency: 12 },
    ];

    const results: Array<Id<"fhirResources">> = [];
    for (const med of mockMedications) {
      const resourceId = await ctx.db.insert("fhirResources", {
        patientId: args.patientId,
        encounterId: args.encounterId,
        resourceType: "MedicationRequest",
        fhirId: `epic-med-${Date.now()}-${Math.random()}`,
        resourceContent: JSON.stringify({
          resourceType: "MedicationRequest",
          medicationCodeableConcept: { text: med.name },
          dosageInstruction: [{ text: `${med.dosage} ${med.route} q${med.frequency}h` }],
        }),
        status: "active",
        importedAt: Date.now(),
        sourceSystem: "Epic",
      });
      results.push(resourceId);
    }

    return results;
  },
});

/**
 * Sync lab results from Epic
 */
export const syncLabResultsFromEpic = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    epicMRN: v.string(),
  },
  handler: async (ctx, args) => {
    // Mock: Create FHIR Observation resources for lab results
    const mockLabs = [
      { code: "2345-7", display: "Glucose [Mass/volume] in Serum or Plasma", value: "105", unit: "mg/dL" },
      { code: "2951-2", display: "Sodium [Moles/volume] in Serum or Plasma", value: "138", unit: "mmol/L" },
      { code: "2823-3", display: "Potassium [Moles/volume] in Serum or Plasma", value: "4.2", unit: "mmol/L" },
    ];

    const results: Array<Id<"fhirResources">> = [];
    for (const lab of mockLabs) {
      const resourceId = await ctx.db.insert("fhirResources", {
        patientId: args.patientId,
        encounterId: args.encounterId,
        resourceType: "Observation",
        fhirId: `epic-lab-${Date.now()}-${Math.random()}`,
        resourceContent: JSON.stringify({
          resourceType: "Observation",
          code: { coding: [{ system: "http://loinc.org", code: lab.code, display: lab.display }] },
          valueQuantity: { value: parseFloat(lab.value), unit: lab.unit },
          status: "final",
        }),
        status: "active",
        effectiveAt: Date.now(),
        importedAt: Date.now(),
        sourceSystem: "Epic",
      });
      results.push(resourceId);
    }

    return results;
  },
});

/**
 * CDS Hooks: Check medication interactions (clinical decision support)
 */
export const checkMedicationInteractions = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const fhirResources = await ctx.db
      .query("fhirResources")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .filter((q) => q.eq(q.field("resourceType"), "MedicationRequest"))
      .collect();

    // Mock: Check for interactions (in production, call CDS service)
    const interactions: Array<{ severity: string; message: string; hook: string }> = [];
    if (fhirResources.length >= 2) {
      interactions.push({
        severity: "warning",
        message: "Potential interaction between Lisinopril and NSAIDs - monitor renal function",
        hook: "medication-prescribe",
      });
    }

    return { interactions, medicationCount: fhirResources.length };
  },
});

/**
 * Get CDA (Continuity of Care Document) for discharge summary
 */
export const generateCDAForDischarge = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    const encounter = await ctx.db.get(args.encounterId);
    const patient = await ctx.db.get(args.patientId);

    if (!encounter || !patient) throw new Error("Missing encounter or patient");

    // Mock: Generate CDA XML structure (in production, use CDA template)
    const cda = {
      resourceType: "Bundle",
      type: "document",
      entry: [
        {
          resource: {
            resourceType: "Composition",
            type: { coding: [{ code: "34133-9", display: "Discharge Summary" }] },
            subject: { reference: `Patient/${patient._id}` },
            date: new Date().toISOString(),
            section: [
              { title: "Discharge Diagnosis", text: encounter.chiefComplaint },
              { title: "Vital Signs", text: JSON.stringify(encounter.vitals) },
            ],
          },
        },
      ],
    };

    // Store as FHIR resource
    const cdaResourceId = await ctx.db.insert("fhirResources", {
      patientId: args.patientId,
      encounterId: args.encounterId,
      resourceType: "Bundle",
      fhirId: `discharge-cda-${args.encounterId}`,
      resourceContent: JSON.stringify(cda),
      canonicalUrl: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-composition",
      status: "active",
      importedAt: Date.now(),
      sourceSystem: "Nexus-ER",
    });

    return { cdaResourceId, cda };
  },
});
