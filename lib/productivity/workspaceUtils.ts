export const CURRENT_WORKSPACE_SCHEMA_VERSION = 3;

export type AiAction = "rewrite" | "summarize" | "translate" | "patient_friendly";

export type AiApplyMode = "replace" | "append" | "insert";

export type BackupValidationResult = {
  ok: boolean;
  errors: string[];
};

export type BackupImportState = {
  schemaVersion: number;
  docs: unknown[];
  selectedDocId: string | null;
  deletedDocs: unknown[];
  sheetRows: unknown[];
  slides: unknown[];
  favoriteDocIds: string[];
  recentDocIds: string[];
  updatedAt: number;
};

export function validateWorkspaceBackup(payload: unknown): BackupValidationResult {
  const errors: string[] = [];
  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["Backup payload is not an object."] };
  }

  const data = payload as Record<string, unknown>;
  if (typeof data.schemaVersion !== "number") {
    errors.push("schemaVersion must be a number.");
  }
  if (!Array.isArray(data.docs)) errors.push("docs must be an array.");
  if (!(typeof data.selectedDocId === "string" || data.selectedDocId === null)) {
    errors.push("selectedDocId must be string or null.");
  }
  if (!Array.isArray(data.deletedDocs)) errors.push("deletedDocs must be an array.");
  if (!Array.isArray(data.sheetRows)) errors.push("sheetRows must be an array.");
  if (!Array.isArray(data.slides)) errors.push("slides must be an array.");
  if (!Array.isArray(data.favoriteDocIds)) errors.push("favoriteDocIds must be an array.");
  if (!Array.isArray(data.recentDocIds)) errors.push("recentDocIds must be an array.");
  if (typeof data.updatedAt !== "number") errors.push("updatedAt must be a number.");

  if (typeof data.schemaVersion === "number" && data.schemaVersion > CURRENT_WORKSPACE_SCHEMA_VERSION) {
    errors.push("Backup schema version is newer than supported by this client.");
  }

  return { ok: errors.length === 0, errors };
}

export function toImportState(payload: Record<string, unknown>): BackupImportState {
  return {
    schemaVersion:
      typeof payload.schemaVersion === "number" ? payload.schemaVersion : CURRENT_WORKSPACE_SCHEMA_VERSION,
    docs: Array.isArray(payload.docs) ? payload.docs : [],
    selectedDocId: typeof payload.selectedDocId === "string" ? payload.selectedDocId : null,
    deletedDocs: Array.isArray(payload.deletedDocs) ? payload.deletedDocs : [],
    sheetRows: Array.isArray(payload.sheetRows) ? payload.sheetRows : [],
    slides: Array.isArray(payload.slides) ? payload.slides : [],
    favoriteDocIds: Array.isArray(payload.favoriteDocIds)
      ? payload.favoriteDocIds.filter((item): item is string => typeof item === "string")
      : [],
    recentDocIds: Array.isArray(payload.recentDocIds)
      ? payload.recentDocIds.filter((item): item is string => typeof item === "string")
      : [],
    updatedAt: typeof payload.updatedAt === "number" ? payload.updatedAt : Date.now(),
  };
}

export function containsLikelyPhi(input: string): { hasPhi: boolean; matches: string[] } {
  const checks: Array<{ label: string; regex: RegExp }> = [
    { label: "email", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
    { label: "phone", regex: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/ },
    { label: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/ },
    { label: "dob", regex: /\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/ },
    { label: "mrn", regex: /\b(?:MRN|Medical Record Number)[:\s#-]*\d{5,}\b/i },
  ];

  const matches = checks.filter((item) => item.regex.test(input)).map((item) => item.label);
  return { hasPhi: matches.length > 0, matches };
}

export function buildStructuredAiPrompt(action: AiAction, input: string, target?: "en" | "es"): string {
  const templates: Record<AiAction, string> = {
    rewrite: "Rewrite for clinical clarity using concise professional language. Preserve meaning and factual details.",
    summarize: "Summarize into the most important clinical points with concise bullets.",
    patient_friendly: "Rewrite for a patient at about 8th-grade reading level with compassionate tone.",
    translate: target === "es" ? "Translate to Spanish for patient communication." : "Translate to English.",
  };

  return [
    "You are a clinical documentation assistant.",
    templates[action],
    "Do not invent facts.",
    "Input:",
    input,
  ].join("\n\n");
}

export function applyAiContent(baseHtml: string, aiHtml: string, mode: AiApplyMode): string {
  if (mode === "replace") return aiHtml;
  return `${baseHtml}<hr/>${aiHtml}`;
}

export function lineDiffSummary(previousText: string, nextText: string): { added: number; removed: number } {
  const prev = new Set(previousText.split(/\r?\n/).map((v) => v.trim()).filter(Boolean));
  const next = new Set(nextText.split(/\r?\n/).map((v) => v.trim()).filter(Boolean));

  let added = 0;
  let removed = 0;

  next.forEach((line) => {
    if (!prev.has(line)) added += 1;
  });
  prev.forEach((line) => {
    if (!next.has(line)) removed += 1;
  });

  return { added, removed };
}

export function mergeConflictContent(localHtml: string, incomingHtml: string): string {
  return [
    "<h3>Conflict Merge</h3>",
    "<p><strong>Local changes</strong></p>",
    localHtml,
    "<hr/>",
    "<p><strong>Incoming changes</strong></p>",
    incomingHtml,
  ].join("");
}

export function isSignoffChecklistComplete(checklist: Record<string, boolean>): boolean {
  return Object.values(checklist).every(Boolean);
}

export type UndoEntry = {
  docId: string;
  content: string;
  capturedAt: number;
};

export function pushUndoEntry(stack: UndoEntry[], entry: UndoEntry, max = 20): UndoEntry[] {
  return [entry, ...stack].slice(0, max);
}

export function shiftUndoToRedo(
  undoStack: UndoEntry[],
  redoStack: UndoEntry[],
  currentDocContent: string,
  now: number
): { undo: UndoEntry[]; redo: UndoEntry[]; snapshot: UndoEntry | null } {
  const next = undoStack[0] ?? null;
  if (!next) return { undo: undoStack, redo: redoStack, snapshot: null };
  const redoEntry: UndoEntry = {
    docId: next.docId,
    content: currentDocContent,
    capturedAt: now,
  };
  return {
    undo: undoStack.slice(1),
    redo: [redoEntry, ...redoStack].slice(0, 20),
    snapshot: next,
  };
}

export function pruneDeletedByRetention<T extends { deletedAt: number }>(
  items: T[],
  retentionDays: number,
  now: number
): T[] {
  const safeDays = Math.max(1, retentionDays);
  const cutoff = now - safeDays * 24 * 60 * 60 * 1000;
  return items.filter((item) => item.deletedAt >= cutoff);
}
