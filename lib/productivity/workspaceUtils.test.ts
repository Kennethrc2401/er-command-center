import { describe, expect, it } from "vitest";
import {
  CURRENT_WORKSPACE_SCHEMA_VERSION,
  applyAiContent,
  buildStructuredAiPrompt,
  containsLikelyPhi,
  lineDiffSummary,
  mergeConflictContent,
  pruneDeletedByRetention,
  pushUndoEntry,
  shiftUndoToRedo,
  toImportState,
  validateWorkspaceBackup,
} from "./workspaceUtils";

describe("workspace backup schema", () => {
  it("validates a supported backup payload", () => {
    const result = validateWorkspaceBackup({
      schemaVersion: CURRENT_WORKSPACE_SCHEMA_VERSION,
      docs: [],
      selectedDocId: null,
      deletedDocs: [],
      sheetRows: [],
      slides: [],
      updatedAt: Date.now(),
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects unsupported/newer schema", () => {
    const result = validateWorkspaceBackup({
      schemaVersion: CURRENT_WORKSPACE_SCHEMA_VERSION + 1,
      docs: [],
      selectedDocId: null,
      deletedDocs: [],
      sheetRows: [],
      slides: [],
      updatedAt: Date.now(),
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("newer"))).toBe(true);
  });

  it("normalizes malformed import payload", () => {
    const state = toImportState({});
    expect(state.docs).toEqual([]);
    expect(state.deletedDocs).toEqual([]);
    expect(state.sheetRows).toEqual([]);
    expect(state.slides).toEqual([]);
    expect(state.selectedDocId).toBeNull();
  });
});

describe("AI safety and prompt templates", () => {
  it("detects likely PHI", () => {
    const result = containsLikelyPhi("MRN: 123456, call me at 555-123-4567");
    expect(result.hasPhi).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("creates structured prompts", () => {
    const prompt = buildStructuredAiPrompt("summarize", "Patient improved overnight.");
    expect(prompt).toContain("clinical documentation assistant");
    expect(prompt).toContain("Input:");
  });
});

describe("versioning and merge utilities", () => {
  it("applies AI content by mode", () => {
    expect(applyAiContent("<p>A</p>", "<p>B</p>", "replace")).toContain("<p>B</p>");
    expect(applyAiContent("<p>A</p>", "<p>B</p>", "append")).toContain("<hr/>");
    expect(applyAiContent("<p>A</p>", "<p>B</p>", "insert")).toContain("<hr/>");
  });

  it("summarizes line-level diffs", () => {
    const diff = lineDiffSummary("a\nb", "a\nc");
    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(1);
  });

  it("merges conflict content blocks", () => {
    const merged = mergeConflictContent("<p>local</p>", "<p>incoming</p>");
    expect(merged).toContain("Local changes");
    expect(merged).toContain("Incoming changes");
  });

  it("pushes undo entries with cap", () => {
    const stack = pushUndoEntry([], { docId: "d1", content: "A", capturedAt: 1 }, 1);
    const capped = pushUndoEntry(stack, { docId: "d1", content: "B", capturedAt: 2 }, 1);
    expect(capped).toHaveLength(1);
    expect(capped[0].content).toBe("B");
  });

  it("moves top undo to redo", () => {
    const result = shiftUndoToRedo(
      [{ docId: "d1", content: "before", capturedAt: 1 }],
      [],
      "current",
      100
    );
    expect(result.snapshot?.content).toBe("before");
    expect(result.undo).toHaveLength(0);
    expect(result.redo).toHaveLength(1);
    expect(result.redo[0].content).toBe("current");
  });

  it("prunes deleted entries by retention", () => {
    const now = 1_000_000;
    const kept = pruneDeletedByRetention(
      [
        { deletedAt: now - 2 * 24 * 60 * 60 * 1000 },
        { deletedAt: now - 10 * 24 * 60 * 60 * 1000 },
      ],
      7,
      now
    );
    expect(kept).toHaveLength(1);
  });
});
