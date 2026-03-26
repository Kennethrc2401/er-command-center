import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

function sanitizeForSvg(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type ImagingRegion = "head" | "chest" | "abdomen" | "spine" | "extremity" | "generic";

type RegionTemplate = {
  cx: number;
  cy: number;
  baseRadius: number;
  lesionX: number;
  lesionY: number;
  lesionR: number;
  finding: string;
  impression: string;
};

const REGION_TEMPLATES: Record<ImagingRegion, RegionTemplate> = {
  head: {
    cx: 180,
    cy: 132,
    baseRadius: 74,
    lesionX: 195,
    lesionY: 120,
    lesionR: 8,
    finding: "No acute intracranial hemorrhage, mass effect, or midline shift. Gray-white differentiation is preserved.",
    impression: "No acute intracranial abnormality.",
  },
  chest: {
    cx: 180,
    cy: 142,
    baseRadius: 86,
    lesionX: 214,
    lesionY: 156,
    lesionR: 10,
    finding: "No focal consolidation, pleural effusion, or pneumothorax. Cardiomediastinal silhouette is within expected limits.",
    impression: "No acute cardiopulmonary process.",
  },
  abdomen: {
    cx: 180,
    cy: 146,
    baseRadius: 90,
    lesionX: 160,
    lesionY: 168,
    lesionR: 9,
    finding: "No free intraperitoneal air or fluid. No acute inflammatory change identified in the visualized abdomen.",
    impression: "No acute intra-abdominal abnormality.",
  },
  spine: {
    cx: 182,
    cy: 138,
    baseRadius: 64,
    lesionX: 182,
    lesionY: 152,
    lesionR: 7,
    finding: "Vertebral body heights are maintained. No acute compression deformity or high-grade canal compromise.",
    impression: "No acute spinal abnormality.",
  },
  extremity: {
    cx: 176,
    cy: 144,
    baseRadius: 70,
    lesionX: 198,
    lesionY: 160,
    lesionR: 8,
    finding: "No acute displaced fracture or dislocation. Soft tissues are grossly unremarkable.",
    impression: "No acute osseous abnormality.",
  },
  generic: {
    cx: 180,
    cy: 140,
    baseRadius: 76,
    lesionX: 182,
    lesionY: 164,
    lesionR: 9,
    finding: "No acute abnormality is identified in the simulated acquisition.",
    impression: "No acute abnormality.",
  },
};

function detectRegion(studyName: string, reason: string): ImagingRegion {
  const text = `${studyName} ${reason}`.toLowerCase();
  if (/(head|brain|neuro|stroke|intracranial)/.test(text)) return "head";
  if (/(chest|lung|thorax|pe|pulmonary)/.test(text)) return "chest";
  if (/(abd|abdo|pelvis|flank|appendix|renal|kidney)/.test(text)) return "abdomen";
  if (/(spine|cervical|thoracic|lumbar|vertebra)/.test(text)) return "spine";
  if (/(shoulder|hip|knee|ankle|wrist|elbow|extrem)/.test(text)) return "extremity";
  return "generic";
}

function makeSeed(seedInput: string) {
  let hash = 0;
  for (let i = 0; i < seedInput.length; i += 1) {
    hash = (hash * 31 + seedInput.charCodeAt(i)) % 100000;
  }
  return hash;
}

function simulatedSliceSvg(
  modality: string,
  studyName: string,
  region: ImagingRegion,
  sliceNumber: number,
  total: number,
  seed: number
) {
  const lower = modality.toLowerCase();
  const isCt = lower.includes("ct");
  const bg = isCt ? "#0f172a" : "#111827";
  const ring = isCt ? "#dbeafe" : "#e5e7eb";
  const accent = isCt ? "#60a5fa" : "#93c5fd";
  const lesion = isCt ? "#fca5a5" : "#fdba74";
  const template = REGION_TEMPLATES[region];
  const cx = template.cx;
  const cy = template.cy;
  const baseRadius = template.baseRadius;
  const wobble = ((sliceNumber % 3) - 1) * 4 + (seed % 3) - 1;
  const lesionShiftX = (seed % 5) - 2;
  const lesionShiftY = ((seed >> 1) % 5) - 2;
  const lesionScale = 1 + ((seed % 4) - 1) * 0.06;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="280" viewBox="0 0 360 280">
  <rect width="360" height="280" fill="${bg}"/>
  <text x="14" y="22" fill="#cbd5e1" font-size="11" font-family="monospace">SIMULATED ${sanitizeForSvg(modality.toUpperCase())} VIEW</text>
  <text x="14" y="40" fill="#94a3b8" font-size="10" font-family="monospace">${sanitizeForSvg(studyName.toUpperCase())}</text>
  <circle cx="${cx}" cy="${cy}" r="${baseRadius + wobble}" fill="none" stroke="${ring}" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="${baseRadius - 22 + wobble}" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.8"/>
  <ellipse cx="${cx - 22}" cy="${cy - 6}" rx="16" ry="11" fill="${accent}" opacity="0.25"/>
  <ellipse cx="${cx + 24}" cy="${cy + 4}" rx="15" ry="10" fill="${accent}" opacity="0.2"/>
  <circle cx="${template.lesionX + lesionShiftX}" cy="${template.lesionY + lesionShiftY}" r="${Math.max(5, Math.round(template.lesionR * lesionScale))}" fill="${lesion}" opacity="0.55"/>
  <text x="14" y="262" fill="#94a3b8" font-size="10" font-family="monospace">Slice ${sliceNumber}/${total}</text>
  <text x="14" y="248" fill="#94a3b8" font-size="9" font-family="monospace">REGION ${sanitizeForSvg(region.toUpperCase())}</text>
  <text x="258" y="262" fill="#94a3b8" font-size="10" font-family="monospace">SIM-ONLY</text>
</svg>`;
}

function generateSimulatedSeries(modality: string, studyName: string, reason: string, seedInput: string) {
  const region = detectRegion(studyName, reason);
  const seed = makeSeed(seedInput);
  const total = modality.toLowerCase().includes("mri") ? 8 : 6;
  const slices = Array.from({ length: total }, (_, index) => {
    const sliceNumber = index + 1;
    const svg = simulatedSliceSvg(modality, studyName, region, sliceNumber, total, seed + sliceNumber);
    return {
      label: `Slice ${sliceNumber}`,
      imageDataUri: toDataUri(svg),
    };
  });

  return {
    modality,
    region,
    generatedAt: Date.now(),
    slices,
  };
}

function buildSimulatedReport(studyName: string, modality: string, reason: string) {
  const upperModality = modality.toUpperCase();
  const region = detectRegion(studyName, reason);
  const template = REGION_TEMPLATES[region];

  if (upperModality.includes("CT")) {
    return `TECHNIQUE: Non-contrast ${studyName}. Axial slices reconstructed in sagittal and coronal planes.\n\nFINDINGS: ${template.finding}\n\nIMPRESSION: ${template.impression} Correlate with clinical indication: ${reason}.`;
  }

  if (upperModality.includes("MRI")) {
    return `TECHNIQUE: Multiplanar multisequence ${studyName} obtained without intravenous contrast.\n\nFINDINGS: ${template.finding}\n\nIMPRESSION: ${template.impression} No emergent MRI finding identified for indication: ${reason}.`;
  }

  return `FINDINGS: Simulated ${studyName} demonstrates no acute abnormality.\n\nIMPRESSION: Negative ${modality} exam for emergent process.`;
}

export const getByEncounter = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("imagingOrders")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .order("desc")
      .collect();
  },
});

export const updateStatus = mutation({
  args: { 
    orderId: v.id("imagingOrders"), 
    status: v.union(v.literal("Ordered"), v.literal("In Progress"), v.literal("Resulted")),
    report: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, { 
      status: args.status,
      report: args.report,
      ...(args.status === "Resulted" ? { resultedAt: Date.now() } : {}),
    });
  },
});

export const finalizeSimulatedResult = mutation({
  args: {
    orderId: v.id("imagingOrders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Imaging order not found");

    const report = buildSimulatedReport(order.studyName, order.modality, order.reason);
    const simulatedSeries = generateSimulatedSeries(order.modality, order.studyName, order.reason, String(order._id));

    await ctx.db.patch(args.orderId, {
      status: "Resulted",
      report,
      simulatedSeries,
      resultedAt: Date.now(),
    });
  },
});

export const acknowledgeResult = mutation({
  args: {
    orderId: v.id("imagingOrders"),
    staffName: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Imaging order not found");
    if (order.status !== "Resulted") {
      throw new Error("Only resulted imaging studies can be acknowledged.");
    }

    await ctx.db.patch(args.orderId, {
      acknowledgedBy: args.staffName,
      acknowledgedAt: Date.now(),
    });
  },
});

export const createOrder = mutation({
  args: {
    encounterId: v.id("encounters"),
    studyName: v.string(),
    modality: v.string(),
    reason: v.string(),
    priority: v.string(),
    orderedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("imagingOrders", {
      ...args,
      status: "Ordered",
      orderedAt: Date.now(),
    });
  },
});

export const getPendingCount = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("imagingOrders")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "Ordered"),
          q.eq(q.field("status"), "In Progress")
        )
      )
      .collect();
    return pending.length;
  },
});