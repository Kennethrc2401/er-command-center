"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { Document as DocxDocument, Packer, Paragraph } from "docx";
import mammoth from "mammoth";
import PptxGenJS from "pptxgenjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  applyAiContent,
  buildStructuredAiPrompt,
  containsLikelyPhi,
  CURRENT_WORKSPACE_SCHEMA_VERSION,
  isSignoffChecklistComplete,
  lineDiffSummary,
  mergeConflictContent,
  toImportState,
  validateWorkspaceBackup,
} from "@/lib/productivity/workspaceUtils";
import {
  Briefcase,
  FileText,
  Folder,
  Layout,
  ListChecks,
  Save,
  Search,
  Sheet,
  Sparkles,
  Download,
  Upload,
  ClipboardCheck,
  Signature,
} from "lucide-react";

type DocType = "SOAP" | "Discharge" | "Handoff" | "Letter";
type AccessLevel = "private" | "team" | "shared";
type ApprovalStatus = "draft" | "approved" | "rejected";

type AuditEntry = {
  at: number;
  action: string;
  detail: string;
};

type SignatureEntry = {
  name: string;
  role: string;
  decision: "approve" | "reject";
  timestamp: number;
};

type DocVersion = {
  id: string;
  name: string;
  createdAt: number;
  content: string;
};

type SuiteDocument = {
  id: string;
  title: string;
  type: DocType;
  folder: string;
  tags: string[];
  content: string;
  access: AccessLevel;
  status: ApprovalStatus;
  createdAt: number;
  updatedAt: number;
  versions: DocVersion[];
  audit: AuditEntry[];
  signatures: SignatureEntry[];
};

type SheetRow = {
  id: string;
  task: string;
  owner: string;
  due: string;
  estimateHours: number;
  completedHours: number;
  priority: "Low" | "Med" | "High";
  status: "Open" | "In Progress" | "Done";
  notes: string;
};

type Slide = {
  id: string;
  title: string;
  bullets: string;
};

type DeletedDocEntry = {
  id: string;
  deletedAt: number;
  doc: SuiteDocument;
};

type AiUndoSnapshot = {
  docId: string;
  content: string;
  capturedAt: number;
};

type WorkspaceState = {
  schemaVersion: number;
  docs: SuiteDocument[];
  selectedDocId: string | null;
  deletedDocs: DeletedDocEntry[];
  sheetRows: SheetRow[];
  slides: Slide[];
  updatedAt: number;
};

type ConflictState = {
  payload: WorkspaceState;
  docId: string;
  docTitle: string;
  localContent: string;
  incomingContent: string;
};

type AiOperationLog = {
  id: string;
  at: number;
  action: "rewrite" | "summarize" | "translate" | "patient_friendly";
  mode: "local" | "backend" | "blocked";
  sourceLength: number;
  note: string;
};

const STORAGE_KEY = "productivity-suite:v1";
const RECYCLE_BIN_RETENTION_DAYS = 14;
const WORKFLOW_REMINDER_KEY = "productivity-suite:due-reminders";

const DOC_TEMPLATES: Record<DocType, { title: string; html: string }> = {
  SOAP: {
    title: "SOAP Note",
    html: "<h2>Subjective</h2><p></p><h2>Objective</h2><p></p><h2>Assessment</h2><p></p><h2>Plan</h2><p></p>",
  },
  Discharge: {
    title: "Discharge Summary",
    html: "<h2>Hospital Course</h2><p></p><h2>Discharge Medications</h2><p></p><h2>Follow-up</h2><p></p><h2>Patient Education</h2><p></p>",
  },
  Handoff: {
    title: "Shift Handoff",
    html: "<h2>Current Status</h2><p></p><h2>Pending Items</h2><ul><li></li></ul><h2>Escalation Triggers</h2><p></p>",
  },
  Letter: {
    title: "Clinical Letter",
    html: "<p>Date:</p><p>To whom it may concern,</p><p></p><p>Sincerely,</p><p></p>",
  },
};

function nowTs(): number {
  return Date.now();
}

function withAudit(doc: SuiteDocument, action: string, detail: string): SuiteDocument {
  const now = nowTs();
  return {
    ...doc,
    updatedAt: now,
    audit: [{ at: now, action, detail }, ...doc.audit].slice(0, 30),
  };
}

function makeDocument(type: DocType, folder = "General", tags: string[] = []): SuiteDocument {
  const template = DOC_TEMPLATES[type];
  const now = nowTs();
  return {
    id: uid("doc"),
    title: `${template.title} ${new Date(now).toLocaleDateString()}`,
    type,
    folder,
    tags,
    content: template.html,
    access: "private",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    versions: [],
    audit: [{ at: now, action: "create", detail: `${type} document created` }],
    signatures: [],
  };
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function stripHtml(html: string): string {
  if (typeof window === "undefined") return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function completionPercent(row: SheetRow): number {
  if (row.estimateHours <= 0) return row.status === "Done" ? 100 : 0;
  return Math.min(100, Math.round((row.completedHours / row.estimateHours) * 100));
}

function remainingHours(row: SheetRow): number {
  return Math.max(0, Number((row.estimateHours - row.completedHours).toFixed(1)));
}

function toCsv(rows: SheetRow[]): string {
  const header = ["task", "owner", "due", "estimateHours", "completedHours", "priority", "status", "notes"];
  const lines = rows.map((r) =>
    [r.task, r.owner, r.due, r.estimateHours, r.completedHours, r.priority, r.status, r.notes]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

function parseCsv(text: string): SheetRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];
  const rows: SheetRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i]
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((p) => p.replace(/^"|"$/g, "").replaceAll('""', '"'));
    if (parts.length < 8) continue;
    rows.push({
      id: uid("row"),
      task: parts[0] || "",
      owner: parts[1] || "",
      due: parts[2] || "",
      estimateHours: Number(parts[3]) || 0,
      completedHours: Number(parts[4]) || 0,
      priority: (parts[5] as SheetRow["priority"]) || "Med",
      status: (parts[6] as SheetRow["status"]) || "Open",
      notes: parts[7] || "",
    });
  }
  return rows;
}

function normalizeDocs(docs: SuiteDocument[]): SuiteDocument[] {
  return docs.map((doc) => ({
    ...doc,
    versions: (doc.versions || []).map((version, index) => ({
      ...version,
      name: version.name || `Checkpoint ${index + 1}`,
    })),
  }));
}

function ProductivitySuitePage() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const docxInputRef = useRef<HTMLInputElement | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const workspaceInputRef = useRef<HTMLInputElement | null>(null);
  const aiApplyShortcutRef = useRef<() => void>(() => {});
  const aiPreviewShortcutRef = useRef<() => void>(() => {});
  const aiUndoShortcutRef = useRef<() => void>(() => {});
  const aiRedoShortcutRef = useRef<() => void>(() => {});
  const docsRef = useRef<SuiteDocument[]>([]);
  const selectedDocIdRef = useRef<string | null>(null);
  const applyingRemoteRef = useRef(false);
  const clientIdRef = useRef(uid("client"));
  const lastSyncRef = useRef<number | null>(null);

  const [docs, setDocs] = useState<SuiteDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [deletedDocs, setDeletedDocs] = useState<DeletedDocEntry[]>([]);
  const [docSearch, setDocSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("All");
  const [tagInput, setTagInput] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [signatureRole, setSignatureRole] = useState("Attending");

  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);

  const [aiInput, setAiInput] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [aiApplyMode, setAiApplyMode] = useState<"replace" | "append" | "insert">("replace");
  const [markAiChanges, setMarkAiChanges] = useState(true);
  const [aiUndoStack, setAiUndoStack] = useState<AiUndoSnapshot[]>([]);
  const [aiRedoStack, setAiRedoStack] = useState<AiUndoSnapshot[]>([]);
  const [recycleRetentionDays, setRecycleRetentionDays] = useState(RECYCLE_BIN_RETENTION_DAYS);
  const [aiBackendStatus, setAiBackendStatus] = useState<"idle" | "connected" | "fallback">("idle");
  const [allowPhiOutbound, setAllowPhiOutbound] = useState(false);
  const [aiOps, setAiOps] = useState<AiOperationLog[]>([]);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);
  const [checkpointName, setCheckpointName] = useState("");
  const [leftVersionId, setLeftVersionId] = useState<string>("");
  const [rightVersionId, setRightVersionId] = useState<string>("");
  const [signoffChecklist, setSignoffChecklist] = useState({
    summaryVerified: false,
    medsReconciled: false,
    followUpDocumented: false,
  });
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);

  const selectedDoc = useMemo(
    () => docs.find((d) => d.id === selectedDocId) ?? null,
    [docs, selectedDocId]
  );

  const effectiveLeftVersionId = leftVersionId || selectedDoc?.versions[0]?.id || "";
  const effectiveRightVersionId = rightVersionId || selectedDoc?.versions[1]?.id || selectedDoc?.versions[0]?.id || "";

  const leftVersion = useMemo(
    () => selectedDoc?.versions.find((version) => version.id === effectiveLeftVersionId) ?? null,
    [effectiveLeftVersionId, selectedDoc]
  );
  const rightVersion = useMemo(
    () => selectedDoc?.versions.find((version) => version.id === effectiveRightVersionId) ?? null,
    [effectiveRightVersionId, selectedDoc]
  );
  const versionDiff = useMemo(() => {
    if (!leftVersion || !rightVersion) return null;
    return lineDiffSummary(stripHtml(leftVersion.content), stripHtml(rightVersion.content));
  }, [leftVersion, rightVersion]);

  useEffect(() => {
    docsRef.current = docs;
  }, [docs]);

  useEffect(() => {
    selectedDocIdRef.current = selectedDocId;
  }, [selectedDocId]);

  const folders = useMemo(() => {
    const all = new Set(docs.map((d) => d.folder).filter(Boolean));
    return ["All", ...Array.from(all)];
  }, [docs]);

  const filteredDocs = useMemo(() => {
    const query = docSearch.trim().toLowerCase();
    return docs
      .filter((d) => (folderFilter === "All" ? true : d.folder === folderFilter))
      .filter((d) => {
        if (!query) return true;
        return (
          d.title.toLowerCase().includes(query) ||
          d.tags.some((t) => t.toLowerCase().includes(query)) ||
          stripHtml(d.content).toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [docs, docSearch, folderFilter]);

  const openCount = useMemo(
    () => sheetRows.filter((r) => r.status !== "Done").length,
    [sheetRows]
  );
  const highPriorityCount = useMemo(
    () => sheetRows.filter((r) => r.priority === "High" && r.status !== "Done").length,
    [sheetRows]
  );
  const avgCompletion = useMemo(() => {
    if (sheetRows.length === 0) return 0;
    const total = sheetRows.reduce((sum, row) => sum + completionPercent(row), 0);
    return Math.round(total / sheetRows.length);
  }, [sheetRows]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyInitialState = (state: WorkspaceState) => {
      applyingRemoteRef.current = true;
      setDocs(normalizeDocs(state.docs));
      setSelectedDocId(state.selectedDocId);
      setDeletedDocs(state.deletedDocs);
      setSheetRows(state.sheetRows);
      setSlides(state.slides);
      lastSyncRef.current = state.updatedAt;
      window.setTimeout(() => {
        applyingRemoteRef.current = false;
      }, 0);
    };

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const doc = makeDocument("SOAP", "Clinical", ["initial"]);
      const timeoutId = window.setTimeout(() => {
        applyInitialState({
          schemaVersion: CURRENT_WORKSPACE_SCHEMA_VERSION,
          docs: [doc],
          selectedDocId: doc.id,
          deletedDocs: [],
          sheetRows: [],
          slides: [],
          updatedAt: nowTs(),
        });
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    let timeoutId: number | null = null;

    try {
      const parsedRaw = JSON.parse(raw) as Record<string, unknown>;
      const parsed = toImportState(parsedRaw);
      timeoutId = window.setTimeout(() => {
        applyInitialState({
          schemaVersion: parsed.schemaVersion,
          docs: Array.isArray(parsed.docs) ? (parsed.docs as SuiteDocument[]) : [],
          selectedDocId: parsed.selectedDocId ?? null,
          deletedDocs: Array.isArray(parsed.deletedDocs) ? (parsed.deletedDocs as DeletedDocEntry[]) : [],
          sheetRows: Array.isArray(parsed.sheetRows) ? (parsed.sheetRows as SheetRow[]) : [],
          slides: Array.isArray(parsed.slides) ? (parsed.slides as Slide[]) : [],
          updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : nowTs(),
        });
      }, 0);
    } catch {
      toast.error("Failed to load productivity workspace from local storage.");
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedDoc || !editorRef.current) return;
    if (editorRef.current.innerHTML !== selectedDoc.content) {
      editorRef.current.innerHTML = selectedDoc.content;
    }
  }, [selectedDoc]);

  useEffect(() => {
    if (!selectedDocId) return;
    window.setTimeout(() => {
      editorRef.current?.focus();
    }, 0);
  }, [selectedDocId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (applyingRemoteRef.current) return;

    const updatedAt = nowTs();
    const payload: WorkspaceState = {
      schemaVersion: CURRENT_WORKSPACE_SCHEMA_VERSION,
      docs,
      selectedDocId,
      deletedDocs,
      sheetRows,
      slides,
      updatedAt,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    lastSyncRef.current = updatedAt;

    try {
      channelRef.current?.postMessage({
        sender: clientIdRef.current,
        payload,
      });
    } catch {
      // Ignore channel send failures.
    }
  }, [docs, selectedDocId, deletedDocs, sheetRows, slides]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const REMINDER_KEY = "productivity-suite:last-backup-reminder";
    const THIRTY_MINUTES = 30 * 60 * 1000;

    const remindIfNeeded = () => {
      if (docs.length === 0 && sheetRows.length === 0 && slides.length === 0) return;
      const raw = window.localStorage.getItem(REMINDER_KEY);
      const last = raw ? Number(raw) : 0;
      const current = nowTs();
      if (Number.isFinite(last) && current - last < THIRTY_MINUTES) return;
      toast.message("Reminder: Export a workspace backup for safety.");
      window.localStorage.setItem(REMINDER_KEY, String(current));
    };

    const timeoutId = window.setTimeout(remindIfNeeded, 15000);
    const intervalId = window.setInterval(remindIfNeeded, 10 * 60 * 1000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [docs.length, sheetRows.length, slides.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const retentionDays = Math.max(1, recycleRetentionDays);
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    const pruneExpired = () => {
      const cutoff = nowTs() - retentionMs;
      setDeletedDocs((current) => {
        const filtered = current.filter((entry) => entry.deletedAt >= cutoff);
        if (filtered.length < current.length) {
          toast.message(`Recycle bin auto-cleaned ${current.length - filtered.length} expired document(s).`);
        }
        return filtered;
      });
    };

    const timeoutId = window.setTimeout(pruneExpired, 5000);
    const intervalId = window.setInterval(pruneExpired, 60 * 60 * 1000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [recycleRetentionDays]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const remindDueTasks = () => {
      const now = new Date();
      const remindersRaw = window.localStorage.getItem(WORKFLOW_REMINDER_KEY);
      const reminders = remindersRaw ? (JSON.parse(remindersRaw) as Record<string, number>) : {};
      const nextReminders = { ...reminders };

      sheetRows.forEach((row) => {
        if (!row.due || row.status === "Done") return;
        const dueAt = new Date(`${row.due}T23:59:59`);
        const diffMs = dueAt.getTime() - now.getTime();
        if (diffMs < 0 || diffMs > 24 * 60 * 60 * 1000) return;

        const last = reminders[row.id] ?? 0;
        if (now.getTime() - last < 6 * 60 * 60 * 1000) return;

        toast.message(`Task due soon: ${row.task || "Untitled task"}`);
        nextReminders[row.id] = now.getTime();
      });

      window.localStorage.setItem(WORKFLOW_REMINDER_KEY, JSON.stringify(nextReminders));
    };

    const timeoutId = window.setTimeout(remindDueTasks, 8000);
    const intervalId = window.setInterval(remindDueTasks, 15 * 60 * 1000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [sheetRows]);

  const applyIncomingWorkspace = useCallback((incoming: WorkspaceState) => {
    applyingRemoteRef.current = true;
    setDocs(normalizeDocs(incoming.docs));
    setSelectedDocId(incoming.selectedDocId);
    setDeletedDocs(Array.isArray(incoming.deletedDocs) ? incoming.deletedDocs : []);
    setSheetRows(incoming.sheetRows);
    setSlides(incoming.slides);
    lastSyncRef.current = incoming.updatedAt;
    window.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel("productivity-suite-sync");
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<{ sender: string; payload: WorkspaceState }>) => {
      const message = event.data;
      if (!message || message.sender === clientIdRef.current) return;
      const incoming = message.payload;
      if (!incoming || typeof incoming.updatedAt !== "number") return;

      if (lastSyncRef.current !== null && incoming.updatedAt <= lastSyncRef.current) return;

      const localSelectedId = selectedDocIdRef.current;
      const localDocs = docsRef.current;
      const localSelectedDoc = localDocs.find((doc) => doc.id === localSelectedId) ?? null;
      const incomingSelectedDoc = incoming.docs.find((doc) => doc.id === localSelectedId) ?? null;
      const editorFocused = typeof document !== "undefined" && document.activeElement === editorRef.current;

      if (
        localSelectedId &&
        localSelectedDoc &&
        incomingSelectedDoc &&
        localSelectedDoc.content !== incomingSelectedDoc.content &&
        editorFocused
      ) {
        setConflictState({
          payload: incoming,
          docId: localSelectedId,
          docTitle: localSelectedDoc.title,
          localContent: localSelectedDoc.content,
          incomingContent: incomingSelectedDoc.content,
        });
        toast.message("Incoming edits detected. Choose how to resolve conflict.");
        return;
      }

      applyIncomingWorkspace(incoming);
      toast.message("Workspace synced from another open tab.");
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [applyIncomingWorkspace]);

  const resolveConflictKeepMine = () => {
    setConflictState(null);
    toast.success("Kept local edits.");
  };

  const resolveConflictKeepIncoming = () => {
    if (!conflictState) return;
    applyIncomingWorkspace(conflictState.payload);
    setConflictState(null);
    toast.success("Applied incoming changes.");
  };

  const resolveConflictMerge = () => {
    if (!conflictState) return;
    const merged = mergeConflictContent(conflictState.localContent, conflictState.incomingContent);
    const mergedPayload: WorkspaceState = {
      ...conflictState.payload,
      docs: conflictState.payload.docs.map((doc) =>
        doc.id === conflictState.docId ? withAudit({ ...doc, content: merged }, "merge", "Merged local and incoming edits") : doc
      ),
    };
    applyIncomingWorkspace(mergedPayload);
    setConflictState(null);
    toast.success("Merged local and incoming changes.");
  };

  const updateSelectedDoc = useCallback((updater: (doc: SuiteDocument) => SuiteDocument) => {
    if (!selectedDocId) return;
    setDocs((current) =>
      current.map((d) => (d.id === selectedDocId ? updater(d) : d))
    );
  }, [selectedDocId]);

  const newDocument = (type: DocType) => {
    const doc = makeDocument(type, "Clinical", [type.toLowerCase()]);
    setDocs((current) => [doc, ...current]);
    setSelectedDocId(doc.id);
    toast.success(`${type} document created.`);
  };

  const deleteDocument = (id: string) => {
    const target = docs.find((doc) => doc.id === id);
    if (!target) return;
    setDocs((current) => current.filter((d) => d.id !== id));
    setDeletedDocs((current) => [
      {
        id: uid("trash"),
        deletedAt: nowTs(),
        doc: withAudit(target, "delete", "Moved to recycle bin"),
      },
      ...current,
    ].slice(0, 40));
    setSelectedDocId((current) => (current === id ? null : current));
    toast.success("Document moved to recycle bin.");
  };

  const restoreDeletedDoc = (entryId: string) => {
    const entry = deletedDocs.find((item) => item.id === entryId);
    if (!entry) return;
    const restored = withAudit({ ...entry.doc, updatedAt: nowTs() }, "restore", "Restored from recycle bin");
    setDocs((current) => [restored, ...current]);
    setSelectedDocId(restored.id);
    setDeletedDocs((current) => current.filter((item) => item.id !== entryId));
    toast.success("Document restored.");
  };

  const permanentlyDeleteDoc = (entryId: string) => {
    setDeletedDocs((current) => current.filter((item) => item.id !== entryId));
    toast.success("Document permanently deleted.");
  };

  const restoreAllDeletedDocs = () => {
    if (deletedDocs.length === 0) return;
    const restoredDocs = deletedDocs
      .map((entry) => withAudit({ ...entry.doc, updatedAt: nowTs() }, "restore", "Bulk restore from recycle bin"));
    setDocs((current) => [...restoredDocs, ...current]);
    setSelectedDocId((current) => current ?? restoredDocs[0]?.id ?? null);
    setDeletedDocs([]);
    toast.success(`Restored ${restoredDocs.length} document(s).`);
  };

  const emptyRecycleBin = () => {
    if (deletedDocs.length === 0) return;
    const proceed = window.confirm(`Permanently delete ${deletedDocs.length} document(s) from recycle bin?`);
    if (!proceed) return;
    setDeletedDocs([]);
    toast.success("Recycle bin emptied.");
  };

  const execCmd = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    const html = editorRef.current?.innerHTML ?? "";
    updateSelectedDoc((doc) => withAudit({ ...doc, content: html }, "edit", `Applied ${command}`));
  };

  const saveVersion = useCallback(() => {
    if (!selectedDoc) return;
    const label = checkpointName.trim() || `Checkpoint ${new Date().toLocaleTimeString()}`;
    const nextVersion: DocVersion = {
      id: uid("ver"),
      name: label,
      createdAt: nowTs(),
      content: selectedDoc.content,
    };
    updateSelectedDoc((doc) =>
      withAudit({ ...doc, versions: [nextVersion, ...doc.versions].slice(0, 20) }, "version", "Saved snapshot")
    );
    setCheckpointName("");
    toast.success("Version snapshot saved.");
  }, [checkpointName, selectedDoc, updateSelectedDoc]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.altKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        aiPreviewShortcutRef.current();
        return;
      }
      if (event.altKey && event.key === "/") {
        event.preventDefault();
        setShowShortcutHelp((open) => !open);
        return;
      }
      if (event.altKey && event.key.toLowerCase() === "u") {
        event.preventDefault();
        aiUndoShortcutRef.current();
        return;
      }
      if (event.altKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        aiRedoShortcutRef.current();
        return;
      }
      if (event.altKey && event.key === "Enter") {
        event.preventDefault();
        aiApplyShortcutRef.current();
        return;
      }
      if (event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      saveVersion();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [saveVersion]);

  const duplicateSelectedDocument = () => {
    if (!selectedDoc) return;
    const now = nowTs();
    const duplicate: SuiteDocument = {
      ...selectedDoc,
      id: uid("doc"),
      title: `${selectedDoc.title} (Copy)`,
      createdAt: now,
      updatedAt: now,
      versions: [],
      signatures: [],
      status: "draft",
      audit: [{ at: now, action: "duplicate", detail: `Duplicated from ${selectedDoc.id}` }],
    };

    setDocs((current) => [duplicate, ...current]);
    setSelectedDocId(duplicate.id);
    toast.success("Document duplicated.");
  };

  const restoreVersion = (versionId: string) => {
    if (!selectedDoc) return;
    const version = selectedDoc.versions.find((v) => v.id === versionId);
    if (!version) return;
    updateSelectedDoc((doc) => withAudit({ ...doc, content: version.content }, "restore", "Restored older version"));
    if (editorRef.current) editorRef.current.innerHTML = version.content;
    toast.success("Version restored.");
  };

  const restoreVersionAsNewCopy = (versionId: string) => {
    if (!selectedDoc) return;
    const version = selectedDoc.versions.find((v) => v.id === versionId);
    if (!version) return;
    const now = nowTs();
    const clone: SuiteDocument = {
      ...selectedDoc,
      id: uid("doc"),
      title: `${selectedDoc.title} (${version.name})`,
      content: version.content,
      createdAt: now,
      updatedAt: now,
      signatures: [],
      status: "draft",
      audit: [{ at: now, action: "restore_copy", detail: `Created from ${version.name}` }],
    };
    setDocs((current) => [clone, ...current]);
    setSelectedDocId(clone.id);
    toast.success("Version restored as new copy.");
  };

  const exportDocument = async (format: "txt" | "html" | "pdf" | "doc" | "docx") => {
    if (!selectedDoc) return;
    const plain = stripHtml(selectedDoc.content);

    if (format === "pdf") {
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      pdf.setFontSize(12);
      const lines = pdf.splitTextToSize(plain, 520);
      pdf.text(lines, 40, 60);
      pdf.save(`${selectedDoc.title}.pdf`);
      toast.success("PDF exported.");
      return;
    }

    if (format === "docx") {
      const lines = plain.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const docx = new DocxDocument({
        sections: [
          {
            children: lines.length > 0 ? lines.map((line) => new Paragraph(line)) : [new Paragraph(" ")],
          },
        ],
      });
      const blob = await Packer.toBlob(docx);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedDoc.title}.docx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("DOCX exported.");
      return;
    }

    const blobContent =
      format === "txt"
        ? plain
        : format === "html"
          ? selectedDoc.content
          : `<html><body>${selectedDoc.content}</body></html>`;
    const blobType =
      format === "txt"
        ? "text/plain"
        : format === "html"
          ? "text/html"
          : "application/msword";

    const blob = new Blob([blobContent], { type: blobType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedDoc.title}.${format}`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success(`${format.toUpperCase()} exported.`);
  };

  const importDocx = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value.trim();
      if (!text) {
        toast.message("DOCX had no readable text content.");
        return;
      }

      const html = text
        .split(/\r?\n\r?\n+/)
        .map((block) => `<p>${escapeHtml(block).replaceAll("\n", "<br/>")}</p>`)
        .join("");

      if (!selectedDoc) {
        const imported = makeDocument("Letter", "Imported", ["docx"]);
        imported.title = `${file.name.replace(/\.docx$/i, "")} (Imported)`;
        imported.content = html;
        imported.audit.unshift({ at: nowTs(), action: "import", detail: `Imported from ${file.name}` });
        setDocs((current) => [imported, ...current]);
        setSelectedDocId(imported.id);
      } else {
        updateSelectedDoc((doc) => withAudit({ ...doc, content: html }, "import", `Imported from ${file.name}`));
      }

      if (editorRef.current) {
        editorRef.current.innerHTML = html;
      }
      toast.success("DOCX imported.");
    } catch {
      toast.error("Failed to import DOCX.");
    }
  };

  const addTag = () => {
    const next = tagInput.trim();
    if (!next || !selectedDoc) return;
    updateSelectedDoc((doc) => {
      if (doc.tags.some((t) => t.toLowerCase() === next.toLowerCase())) return doc;
      return withAudit({ ...doc, tags: [...doc.tags, next] }, "tag", `Added tag ${next}`);
    });
    setTagInput("");
  };

  const signDocument = (decision: "approve" | "reject") => {
    if (!selectedDoc) return;
    const name = signatureName.trim();
    if (!name) {
      toast.error("Enter signer name first.");
      return;
    }

    if (decision === "approve" && !isSignoffChecklistComplete(signoffChecklist)) {
      toast.error("Complete all sign-off checklist items before approval.");
      return;
    }

    updateSelectedDoc((doc) => {
      const entry: SignatureEntry = {
        name,
        role: signatureRole || "Staff",
        decision,
        timestamp: nowTs(),
      };
      return withAudit(
        {
          ...doc,
          status: decision === "approve" ? "approved" : "rejected",
          signatures: [entry, ...doc.signatures],
        },
        decision,
        `${name} marked document as ${decision}`
      );
    });

    if (decision === "approve") {
      const due = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setSheetRows((current) => [
        {
          id: uid("row"),
          task: `Follow-up: ${selectedDoc.title}`,
          owner: signatureRole || "Clinical Team",
          due,
          estimateHours: 0.5,
          completedHours: 0,
          priority: "Med",
          status: "Open",
          notes: "Auto-created on document approval.",
        },
        ...current,
      ]);
      toast.message("Auto-created follow-up tracker task.");
    }

    toast.success(`Document ${decision}d.`);
  };

  const addSheetRow = () => {
    setSheetRows((current) => [
      {
        id: uid("row"),
        task: "",
        owner: "",
        due: "",
        estimateHours: 0,
        completedHours: 0,
        priority: "Med",
        status: "Open",
        notes: "",
      },
      ...current,
    ]);
  };

  const updateSheetRow = (id: string, patch: Partial<SheetRow>) => {
    setSheetRows((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const deleteSheetRow = (id: string) => {
    setSheetRows((current) => current.filter((r) => r.id !== id));
  };

  const exportSheetCsv = () => {
    const csv = toCsv(sheetRows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success("Sheet exported as CSV.");
  };

  const importSheetCsv = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        toast.message("No rows found in CSV.");
        return;
      }
      setSheetRows(parsed);
      toast.success(`Imported ${parsed.length} rows.`);
    } catch {
      toast.error("Failed to import CSV.");
    }
  };

  const addSlide = () => {
    setSlides((current) => [
      ...current,
      { id: uid("slide"), title: "New Slide", bullets: "First point\nSecond point" },
    ]);
  };

  const updateSlide = (id: string, patch: Partial<Slide>) => {
    setSlides((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const deleteSlide = (id: string) => {
    setSlides((current) => current.filter((s) => s.id !== id));
  };

  const generateSlidesFromDoc = () => {
    if (!selectedDoc) return;
    const text = stripHtml(selectedDoc.content)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 30);

    const chunks: string[][] = [];
    for (let i = 0; i < text.length; i += 4) chunks.push(text.slice(i, i + 4));

    const generated = chunks.map((chunk, index) => ({
      id: uid("slide"),
      title: index === 0 ? selectedDoc.title : `Key Point ${index + 1}`,
      bullets: chunk.join("\n"),
    }));

    setSlides(generated);
    toast.success(`Generated ${generated.length} slides from active document.`);
  };

  const exportSlidesHtml = () => {
    const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>Slides</title><style>body{font-family:Segoe UI,sans-serif;background:#0f172a;color:#e2e8f0;margin:0}section{min-height:90vh;padding:48px;border-bottom:1px solid #334155}h1{font-size:36px;margin-bottom:20px}li{font-size:20px;margin-bottom:10px}</style></head><body>${slides
      .map(
        (s) => `<section><h1>${s.title}</h1><ul>${s.bullets
          .split(/\n+/)
          .filter(Boolean)
          .map((b) => `<li>${b}</li>`)
          .join("")}</ul></section>`
      )
      .join("")}</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `slides-${new Date().toISOString().slice(0, 10)}.html`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success("Slides exported as HTML.");
  };

  const exportSlidesPptx = async () => {
    if (slides.length === 0) {
      toast.message("No slides to export.");
      return;
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Clinical Productivity Suite";
    pptx.subject = "Generated slide deck";
    pptx.title = "Clinical Slides";

    slides.forEach((slide) => {
      const pptSlide = pptx.addSlide();
      pptSlide.background = { color: "0F172A" };
      pptSlide.addText(slide.title || "Untitled Slide", {
        x: 0.6,
        y: 0.5,
        w: 12,
        h: 0.8,
        color: "E2E8F0",
        bold: true,
        fontSize: 30,
      });

      const bullets = slide.bullets
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ text: line, options: { bullet: { indent: 18 } } }));

      if (bullets.length > 0) {
        pptSlide.addText(bullets, {
          x: 0.9,
          y: 1.6,
          w: 11.5,
          h: 4.8,
          color: "CBD5E1",
          fontSize: 18,
          margin: 2,
        });
      }
    });

    await pptx.writeFile({ fileName: `slides-${new Date().toISOString().slice(0, 10)}.pptx` });
    toast.success("Slides exported as PPTX.");
  };

  const exportWorkspaceBackup = () => {
    const payload: WorkspaceState = {
      schemaVersion: CURRENT_WORKSPACE_SCHEMA_VERSION,
      docs,
      selectedDocId,
      deletedDocs,
      sheetRows,
      slides,
      updatedAt: nowTs(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `productivity-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Workspace backup exported.");
  };

  const importWorkspaceBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsedRaw = JSON.parse(text) as Record<string, unknown>;
      const validation = validateWorkspaceBackup(parsedRaw);
      if (!validation.ok) {
        toast.error(`Invalid workspace backup: ${validation.errors[0] ?? "Unknown error"}`);
        return;
      }
      const parsed = toImportState(parsedRaw);

      const selectedExists =
        typeof parsed.selectedDocId === "string" && parsed.docs.some((doc) => (doc as { id?: string }).id === parsed.selectedDocId);
      const proceed = window.confirm(
        [
          "Import this backup and replace current workspace?",
          `Documents: ${parsed.docs.length}`,
          `Recycle bin docs: ${Array.isArray(parsed.deletedDocs) ? parsed.deletedDocs.length : 0}`,
          `Tracker rows: ${parsed.sheetRows.length}`,
          `Slides: ${parsed.slides.length}`,
          `Selected doc preserved: ${selectedExists ? "Yes" : "No"}`,
        ].join("\n")
      );
      if (!proceed) return;

      applyingRemoteRef.current = true;
      setDocs(normalizeDocs(parsed.docs as SuiteDocument[]));
      setDeletedDocs(Array.isArray(parsed.deletedDocs) ? (parsed.deletedDocs as DeletedDocEntry[]) : []);
      setSheetRows(parsed.sheetRows as SheetRow[]);
      setSlides(parsed.slides as Slide[]);
      setAiUndoStack([]);
      setAiRedoStack([]);

      const selectedId =
        typeof parsed.selectedDocId === "string" && parsed.docs.some((doc) => (doc as { id?: string }).id === parsed.selectedDocId)
          ? parsed.selectedDocId
          : ((parsed.docs[0] as { id?: string } | undefined)?.id ?? null);
      setSelectedDocId(selectedId);

      const updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : nowTs();
      lastSyncRef.current = updatedAt;

      window.setTimeout(() => {
        applyingRemoteRef.current = false;
      }, 0);

      toast.success("Workspace backup imported.");
    } catch {
      toast.error("Failed to import workspace backup.");
    }
  };

  const applyAiOutputToSelectedDoc = useCallback(() => {
    if (!selectedDoc) {
      toast.message("Select a document first.");
      return;
    }
    const nextContent = aiOutput.trim();
    if (!nextContent) {
      toast.message("No AI output to apply yet.");
      return;
    }

    setAiUndoStack((current) => [
      {
        docId: selectedDoc.id,
        content: selectedDoc.content,
        capturedAt: nowTs(),
      },
      ...current,
    ].slice(0, 20));
    setAiRedoStack([]);

    const asHtml = `<p>${escapeHtml(nextContent).replaceAll("\n", "<br/>")}</p>`;
    const stamped = `<div class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2"><p><strong>AI Suggestion</strong> <em>${escapeHtml(new Date().toLocaleString())}</em></p>${asHtml}</div>`;
    const aiBlockHtml = markAiChanges ? stamped : asHtml;
    if (aiApplyMode === "insert") {
      const editor = editorRef.current;
      if (editor) {
        editor.focus();
        const selection = window.getSelection();
        const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (range && editor.contains(range.commonAncestorContainer)) {
          document.execCommand("insertHTML", false, aiBlockHtml);
          const inserted = editor.innerHTML;
          updateSelectedDoc((doc) => withAudit({ ...doc, content: inserted }, "ai_apply", "Inserted AI output at cursor"));
          setAiPreviewOpen(false);
          toast.success("AI output inserted at cursor.");
          return;
        }
      }
      toast.message("Cursor not in editor. Falling back to append mode.");
    }

    const auditDetail = aiApplyMode === "append" || aiApplyMode === "insert"
      ? "Appended AI output to document"
      : "Replaced document with AI output";
    updateSelectedDoc((doc) => {
      const mergedContent = applyAiContent(doc.content, aiBlockHtml, aiApplyMode);
      return withAudit({ ...doc, content: mergedContent }, "ai_apply", auditDetail);
    });
    if (editorRef.current) {
      editorRef.current.innerHTML = applyAiContent(selectedDoc.content, aiBlockHtml, aiApplyMode);
    }
    setAiPreviewOpen(false);
    toast.success(
      aiApplyMode === "append" || aiApplyMode === "insert"
        ? "AI output appended to active document."
        : "AI output replaced active document content."
    );
  }, [aiApplyMode, aiOutput, markAiChanges, selectedDoc, updateSelectedDoc]);

  const undoLastAiApply = useCallback(() => {
    const snapshot = aiUndoStack[0];
    if (!snapshot) {
      toast.message("No AI apply action to undo.");
      return;
    }

    let restored = false;
    let redoSnapshot: AiUndoSnapshot | null = null;
    setDocs((current) =>
      current.map((doc) => {
        if (doc.id !== snapshot.docId) return doc;
        restored = true;
        redoSnapshot = {
          docId: doc.id,
          content: doc.content,
          capturedAt: nowTs(),
        };
        return withAudit({ ...doc, content: snapshot.content }, "ai_undo", "Reverted last AI apply");
      })
    );

    if (!restored) {
      toast.message("Original document no longer exists.");
      setAiUndoStack((current) => current.slice(1));
      return;
    }

    setSelectedDocId(snapshot.docId);
    setAiUndoStack((current) => current.slice(1));
    if (redoSnapshot) {
      setAiRedoStack((current) => [redoSnapshot as AiUndoSnapshot, ...current].slice(0, 20));
    }
    setAiPreviewOpen(false);
    toast.success("Last AI apply undone.");
  }, [aiUndoStack]);

  const redoLastAiApply = useCallback(() => {
    const snapshot = aiRedoStack[0];
    if (!snapshot) {
      toast.message("No AI apply action to redo.");
      return;
    }

    let reapplied = false;
    let undoSnapshot: AiUndoSnapshot | null = null;
    setDocs((current) =>
      current.map((doc) => {
        if (doc.id !== snapshot.docId) return doc;
        reapplied = true;
        undoSnapshot = {
          docId: doc.id,
          content: doc.content,
          capturedAt: nowTs(),
        };
        return withAudit({ ...doc, content: snapshot.content }, "ai_redo", "Reapplied AI change");
      })
    );

    if (!reapplied) {
      toast.message("Original document no longer exists.");
      setAiRedoStack((current) => current.slice(1));
      return;
    }

    setSelectedDocId(snapshot.docId);
    setAiRedoStack((current) => current.slice(1));
    if (undoSnapshot) {
      setAiUndoStack((current) => [undoSnapshot as AiUndoSnapshot, ...current].slice(0, 20));
    }
    setAiPreviewOpen(false);
    toast.success("Last AI apply redone.");
  }, [aiRedoStack]);

  useEffect(() => {
    aiApplyShortcutRef.current = applyAiOutputToSelectedDoc;
    aiPreviewShortcutRef.current = () => {
      setAiPreviewOpen((open) => !open);
    };
    aiUndoShortcutRef.current = undoLastAiApply;
    aiRedoShortcutRef.current = redoLastAiApply;
  }, [applyAiOutputToSelectedDoc, redoLastAiApply, undoLastAiApply]);

  const logAiOperation = useCallback(
    (
      action: "rewrite" | "summarize" | "translate" | "patient_friendly",
      mode: "local" | "backend" | "blocked",
      sourceLength: number,
      note: string
    ) => {
      const entry: AiOperationLog = {
        id: uid("aiop"),
        at: nowTs(),
        action,
        mode,
        sourceLength,
        note,
      };
      setAiOps((current) => [entry, ...current].slice(0, 40));
      if (selectedDocId) {
        updateSelectedDoc((doc) => withAudit(doc, "ai_meta", `${action} (${mode}) - ${note}; src=${sourceLength}`));
      }
    },
    [selectedDocId, updateSelectedDoc]
  );

  const callAiBackend = async (
    action: "rewrite" | "summarize" | "translate" | "patient_friendly",
    input: string,
    target?: "en" | "es"
  ): Promise<string | null> => {
    const phi = containsLikelyPhi(input);
    if (phi.hasPhi && !allowPhiOutbound) {
      logAiOperation(action, "blocked", input.length, `blocked for PHI: ${phi.matches.join(",")}`);
      toast.error("Potential PHI detected. Enable PHI outbound in AI Assist to use backend AI.");
      return null;
    }

    const structuredInput = buildStructuredAiPrompt(action, input, target);

    try {
      const response = await fetch("/api/ai-assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, input: structuredInput, target }),
      });

      if (!response.ok) {
        setAiBackendStatus("fallback");
        logAiOperation(action, "local", input.length, "backend unavailable");
        return null;
      }

      const data = (await response.json()) as { output?: string };
      if (!data.output) {
        setAiBackendStatus("fallback");
        logAiOperation(action, "local", input.length, "backend returned empty output");
        return null;
      }

      setAiBackendStatus("connected");
      logAiOperation(action, "backend", input.length, "backend success");
      return data.output;
    } catch {
      setAiBackendStatus("fallback");
      logAiOperation(action, "local", input.length, "backend exception");
      return null;
    }
  };

  const aiRewrite = async () => {
    const backend = await callAiBackend("rewrite", aiInput);
    if (backend) {
      setAiOutput(backend);
      return;
    }

    const rewritten = aiInput
      .replace(/\s+/g, " ")
      .replace(/\butilize\b/gi, "use")
      .replace(/\bin order to\b/gi, "to")
      .replace(/\bdemonstrates\b/gi, "shows")
      .trim();
    logAiOperation("rewrite", "local", aiInput.length, "deterministic local rewrite");
    setAiOutput(rewritten || "Nothing to rewrite.");
  };

  const aiSummarize = async () => {
    const backend = await callAiBackend("summarize", aiInput);
    if (backend) {
      setAiOutput(backend);
      return;
    }

    const sentences = aiInput.split(/(?<=[.!?])\s+/).filter(Boolean);
    logAiOperation("summarize", "local", aiInput.length, "deterministic local summarize");
    setAiOutput(sentences.slice(0, 3).join(" ") || "No content to summarize.");
  };

  const aiPatientFriendly = async () => {
    const backend = await callAiBackend("patient_friendly", aiInput);
    if (backend) {
      setAiOutput(backend);
      return;
    }

    let text = aiInput;
    const replacements: Array<[RegExp, string]> = [
      [/hypertension/gi, "high blood pressure"],
      [/myocardial infarction/gi, "heart attack"],
      [/dyspnea/gi, "trouble breathing"],
      [/analgesic/gi, "pain medicine"],
      [/administer/gi, "give"],
    ];
    replacements.forEach(([regex, value]) => {
      text = text.replace(regex, value);
    });
    logAiOperation("patient_friendly", "local", aiInput.length, "deterministic local simplify");
    setAiOutput(text || "No content to simplify.");
  };

  const aiTranslate = async (target: "es" | "en") => {
    const backend = await callAiBackend("translate", aiInput, target);
    if (backend) {
      setAiOutput(backend);
      return;
    }

    const dictEnToEs: Record<string, string> = {
      patient: "paciente",
      pain: "dolor",
      fever: "fiebre",
      discharge: "alta",
      medication: "medicamento",
      follow: "seguir",
      blood: "sangre",
      pressure: "presion",
      today: "hoy",
      tomorrow: "manana",
    };
    const dictEsToEn: Record<string, string> = Object.fromEntries(
      Object.entries(dictEnToEs).map(([k, v]) => [v, k])
    );
    const dict = target === "es" ? dictEnToEs : dictEsToEn;

    const translated = aiInput
      .split(/(\s+|[,.!?;:])/)
      .map((token) => {
        const normalized = token.toLowerCase();
        return dict[normalized] ?? token;
      })
      .join("");

    logAiOperation("translate", "local", aiInput.length, `deterministic local translate to ${target}`);
    setAiOutput(
      translated || "No content to translate. For high accuracy, connect a full translation API in the next phase."
    );
  };

  return (
    <main className={`mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8 ${highContrast ? "bg-black text-white" : ""} ${largeText ? "text-base" : ""}`}>
      <header className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Productivity Workspace</p>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          Clinical Productivity Suite
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Word-like documents, Excel-like trackers, slide composition, approvals, and AI helpers in one dashboard page.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant={highContrast ? "default" : "outline"} onClick={() => setHighContrast((v) => !v)}>
            {highContrast ? "High Contrast: On" : "High Contrast: Off"}
          </Button>
          <Button size="sm" variant={largeText ? "default" : "outline"} onClick={() => setLargeText((v) => !v)}>
            {largeText ? "Large Text: On" : "Large Text: Off"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowShortcutHelp((v) => !v)}>
            {showShortcutHelp ? "Hide Shortcut Map" : "Show Shortcut Map"}
          </Button>
        </div>
        {showShortcutHelp && (
          <div className="rounded-md border border-slate-300 p-3 text-xs dark:border-slate-700">
            <p className="font-semibold uppercase tracking-wider text-slate-500">Global Shortcut Map</p>
            <p className="mt-1">Ctrl/Cmd+S: Save checkpoint</p>
            <p>Ctrl/Cmd+Alt+P: Toggle AI preview</p>
            <p>Ctrl/Cmd+Alt+Enter: Apply AI output</p>
            <p>Ctrl/Cmd+Alt+U: Undo AI apply</p>
            <p>Ctrl/Cmd+Alt+R: Redo AI apply</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={exportWorkspaceBackup}>
            <Download className="mr-1 h-4 w-4" />Export Workspace Backup
          </Button>
          <Button size="sm" variant="outline" onClick={() => workspaceInputRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" />Import Workspace Backup
          </Button>
          <input
            ref={workspaceInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void importWorkspaceBackup(file);
              }
              e.target.value = "";
            }}
          />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Documents</p>
            <p className="mt-1 text-2xl font-black">{docs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Open Tasks</p>
            <p className="mt-1 text-2xl font-black">{openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">High Priority</p>
            <p className="mt-1 text-2xl font-black">{highPriorityCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Slides</p>
            <p className="mt-1 text-2xl font-black">{slides.length}</p>
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="documents"><FileText className="mr-2 h-4 w-4" />Docs</TabsTrigger>
          <TabsTrigger value="tracker"><Sheet className="mr-2 h-4 w-4" />Tracker</TabsTrigger>
          <TabsTrigger value="slides"><Layout className="mr-2 h-4 w-4" />Slides</TabsTrigger>
          <TabsTrigger value="approvals"><Signature className="mr-2 h-4 w-4" />Approvals</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="mr-2 h-4 w-4" />AI Assist</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          {conflictState && (
            <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <CardHeader>
                <CardTitle className="text-base">Incoming Changes Detected: {conflictState.docTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <textarea className="h-36 w-full rounded-md border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900" readOnly value={stripHtml(conflictState.localContent)} />
                  <textarea className="h-36 w-full rounded-md border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900" readOnly value={stripHtml(conflictState.incomingContent)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={resolveConflictKeepMine}>Keep Mine</Button>
                  <Button size="sm" variant="outline" onClick={resolveConflictKeepIncoming}>Keep Incoming</Button>
                  <Button size="sm" onClick={resolveConflictMerge}>Merge</Button>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Folder className="h-4 w-4" />Workspace</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={docSearch} onChange={(e) => setDocSearch(e.target.value)} placeholder="Search docs" />
                  <Button size="icon" variant="outline"><Search className="h-4 w-4" /></Button>
                </div>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={folderFilter}
                  onChange={(e) => setFolderFilter(e.target.value)}
                >
                  {folders.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => newDocument("SOAP")}>New SOAP</Button>
                  <Button size="sm" variant="outline" onClick={() => newDocument("Discharge")}>Discharge</Button>
                  <Button size="sm" variant="outline" onClick={() => newDocument("Handoff")}>Handoff</Button>
                  <Button size="sm" variant="outline" onClick={() => newDocument("Letter")}>Letter</Button>
                </div>

                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {filteredDocs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`w-full rounded-md border p-2 text-left transition ${selectedDocId === doc.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-slate-200 dark:border-slate-700"}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-semibold">{doc.title}</p>
                        <Badge variant="outline">{doc.type}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{doc.folder} • {new Date(doc.updatedAt).toLocaleString()}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {doc.tags.slice(0, 3).map((t) => (
                          <Badge key={`${doc.id}-${t}`} variant="secondary" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="space-y-2 rounded-md border border-dashed border-slate-300 p-2 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recycle Bin</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline">{deletedDocs.length}</Badge>
                      <select
                        className="h-8 rounded-md border border-slate-300 bg-white px-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                        value={recycleRetentionDays}
                        onChange={(e) => setRecycleRetentionDays(Number(e.target.value) || RECYCLE_BIN_RETENTION_DAYS)}
                      >
                        <option value={7}>7d retention</option>
                        <option value={14}>14d retention</option>
                        <option value={30}>30d retention</option>
                      </select>
                      <Button size="sm" variant="outline" onClick={restoreAllDeletedDocs} disabled={deletedDocs.length === 0}>Restore All</Button>
                      <Button size="sm" variant="destructive" onClick={emptyRecycleBin} disabled={deletedDocs.length === 0}>Empty</Button>
                    </div>
                  </div>
                  {deletedDocs.length === 0 ? (
                    <p className="text-xs text-slate-500">No deleted documents.</p>
                  ) : (
                    <div className="max-h-40 space-y-2 overflow-y-auto">
                      {deletedDocs.slice(0, 6).map((entry) => (
                        <div key={entry.id} className="rounded border border-slate-200 p-2 text-xs dark:border-slate-700">
                          <p className="truncate font-semibold">{entry.doc.title}</p>
                          <p className="text-slate-500">Deleted {new Date(entry.deletedAt).toLocaleString()}</p>
                          <div className="mt-2 flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => restoreDeletedDoc(entry.id)}>Restore</Button>
                            <Button size="sm" variant="destructive" onClick={() => permanentlyDeleteDoc(entry.id)}>Delete Forever</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2"><Briefcase className="h-4 w-4" />Document Builder</span>
                  {selectedDoc ? (
                    <Badge variant={selectedDoc.status === "approved" ? "default" : selectedDoc.status === "rejected" ? "destructive" : "secondary"}>
                      {selectedDoc.status}
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedDoc ? (
                  <p className="text-sm text-slate-500">Create or select a document to begin.</p>
                ) : (
                  <>
                    <div className="grid gap-2 md:grid-cols-3">
                      <Input
                        value={selectedDoc.title}
                        onChange={(e) => updateSelectedDoc((doc) => withAudit({ ...doc, title: e.target.value }, "rename", "Updated title"))}
                        placeholder="Document title"
                      />
                      <Input
                        value={selectedDoc.folder}
                        onChange={(e) => updateSelectedDoc((doc) => withAudit({ ...doc, folder: e.target.value }, "folder", "Changed folder"))}
                        placeholder="Folder"
                      />
                      <select
                        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                        value={selectedDoc.access}
                        onChange={(e) => updateSelectedDoc((doc) => withAudit({ ...doc, access: e.target.value as AccessLevel }, "access", `Set access ${e.target.value}`))}
                      >
                        <option value="private">Private</option>
                        <option value="team">Team</option>
                        <option value="shared">Shared</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={checkpointName}
                        onChange={(e) => setCheckpointName(e.target.value)}
                        placeholder="Checkpoint name"
                        className="max-w-[180px]"
                      />
                      <Button size="sm" variant="outline" onClick={() => execCmd("bold")}>Bold</Button>
                      <Button size="sm" variant="outline" onClick={() => execCmd("italic")}>Italic</Button>
                      <Button size="sm" variant="outline" onClick={() => execCmd("insertUnorderedList")}>Bullets</Button>
                      <Button size="sm" variant="outline" onClick={() => execCmd("formatBlock", "<h2>")}>H2</Button>
                      <Button size="sm" variant="outline" onClick={() => execCmd("formatBlock", "<p>")}>Paragraph</Button>
                      <Button size="sm" onClick={saveVersion}><Save className="mr-1 h-4 w-4" />Save Version</Button>
                      <Button size="sm" variant="outline" onClick={duplicateSelectedDocument}>Duplicate</Button>
                    </div>

                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) => {
                        const html = (e.currentTarget as HTMLDivElement).innerHTML;
                        updateSelectedDoc((doc) => ({ ...doc, content: html, updatedAt: nowTs() }));
                      }}
                      className="min-h-[280px] rounded-md border border-slate-300 bg-white p-3 text-sm leading-6 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                    />

                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="Add tag"
                        className="max-w-[180px]"
                      />
                      <Button size="sm" variant="outline" onClick={addTag}>Add Tag</Button>
                      <Button size="sm" variant="outline" onClick={() => { void exportDocument("txt"); }}><Download className="mr-1 h-4 w-4" />TXT</Button>
                      <Button size="sm" variant="outline" onClick={() => { void exportDocument("html"); }}><Download className="mr-1 h-4 w-4" />HTML</Button>
                      <Button size="sm" variant="outline" onClick={() => { void exportDocument("doc"); }}><Download className="mr-1 h-4 w-4" />Word (.doc)</Button>
                      <Button size="sm" variant="outline" onClick={() => { void exportDocument("docx"); }}><Download className="mr-1 h-4 w-4" />Word (.docx)</Button>
                      <Button size="sm" variant="outline" onClick={() => { void exportDocument("pdf"); }}><Download className="mr-1 h-4 w-4" />PDF</Button>
                      <Button size="sm" variant="outline" onClick={() => docxInputRef.current?.click()}><Upload className="mr-1 h-4 w-4" />Import DOCX</Button>
                      <input
                        ref={docxInputRef}
                        type="file"
                        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void importDocx(file);
                          }
                          e.target.value = "";
                        }}
                      />
                      <Button size="sm" variant="destructive" onClick={() => deleteDocument(selectedDoc.id)}>Delete</Button>
                    </div>

                    {selectedDoc.versions.length > 0 && (
                      <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Version History</p>
                        <div className="mt-2 space-y-1">
                          {selectedDoc.versions.slice(0, 5).map((version) => (
                            <div key={version.id} className="flex items-center justify-between text-xs">
                              <span>{version.name} • {new Date(version.createdAt).toLocaleString()}</span>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => restoreVersion(version.id)}>Restore</Button>
                                <Button size="sm" variant="ghost" onClick={() => restoreVersionAsNewCopy(version.id)}>Restore as Copy</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        {selectedDoc.versions.length > 1 && (
                          <div className="mt-3 space-y-2 rounded border border-slate-200 p-2 dark:border-slate-700">
                            <p className="text-xs font-semibold">Version Compare</p>
                            <div className="grid gap-2 md:grid-cols-2">
                              <select className="h-9 rounded border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900" value={effectiveLeftVersionId} onChange={(e) => setLeftVersionId(e.target.value)}>
                                {selectedDoc.versions.map((version) => (
                                  <option key={`left-${version.id}`} value={version.id}>{version.name}</option>
                                ))}
                              </select>
                              <select className="h-9 rounded border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900" value={effectiveRightVersionId} onChange={(e) => setRightVersionId(e.target.value)}>
                                {selectedDoc.versions.map((version) => (
                                  <option key={`right-${version.id}`} value={version.id}>{version.name}</option>
                                ))}
                              </select>
                            </div>
                            {leftVersion && rightVersion && (
                              <div className="grid gap-2 md:grid-cols-2">
                                <textarea className="h-28 w-full rounded border border-slate-300 bg-white p-2 text-[11px] dark:border-slate-700 dark:bg-slate-900" readOnly value={stripHtml(leftVersion.content)} />
                                <textarea className="h-28 w-full rounded border border-slate-300 bg-white p-2 text-[11px] dark:border-slate-700 dark:bg-slate-900" readOnly value={stripHtml(rightVersion.content)} />
                              </div>
                            )}
                            {versionDiff && <p className="text-xs text-slate-500">Diff summary: +{versionDiff.added} / -{versionDiff.removed}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tracker" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-4 w-4" />Spreadsheet-like Tracker</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={addSheetRow}>Add Row</Button>
                <Button size="sm" variant="outline" onClick={exportSheetCsv}><Download className="mr-1 h-4 w-4" />Export CSV</Button>
                <Button size="sm" variant="outline" onClick={() => csvInputRef.current?.click()}><Upload className="mr-1 h-4 w-4" />Import CSV</Button>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importSheetCsv(file);
                    e.target.value = "";
                  }}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Badge variant="secondary">Rows: {sheetRows.length}</Badge>
                <Badge variant="secondary">Open: {openCount}</Badge>
                <Badge variant="secondary">High Priority: {highPriorityCount}</Badge>
                <Badge variant="secondary">Avg Completion: {avgCompletion}%</Badge>
              </div>

              <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-2 py-2 text-left">Task</th>
                      <th className="px-2 py-2 text-left">Owner</th>
                      <th className="px-2 py-2 text-left">Due</th>
                      <th className="px-2 py-2 text-left">Est Hrs</th>
                      <th className="px-2 py-2 text-left">Done Hrs</th>
                      <th className="px-2 py-2 text-left">Completion %</th>
                      <th className="px-2 py-2 text-left">Remaining</th>
                      <th className="px-2 py-2 text-left">Priority</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-left">Notes</th>
                      <th className="px-2 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheetRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="px-2 py-1"><Input value={row.task} onChange={(e) => updateSheetRow(row.id, { task: e.target.value })} /></td>
                        <td className="px-2 py-1"><Input value={row.owner} onChange={(e) => updateSheetRow(row.id, { owner: e.target.value })} /></td>
                        <td className="px-2 py-1"><Input type="date" value={row.due} onChange={(e) => updateSheetRow(row.id, { due: e.target.value })} /></td>
                        <td className="px-2 py-1"><Input type="number" min={0} step={0.5} value={row.estimateHours} onChange={(e) => updateSheetRow(row.id, { estimateHours: Number(e.target.value) || 0 })} /></td>
                        <td className="px-2 py-1"><Input type="number" min={0} step={0.5} value={row.completedHours} onChange={(e) => updateSheetRow(row.id, { completedHours: Number(e.target.value) || 0 })} /></td>
                        <td className="px-2 py-1"><Badge variant="outline">{completionPercent(row)}%</Badge></td>
                        <td className="px-2 py-1"><Badge variant="outline">{remainingHours(row)}h</Badge></td>
                        <td className="px-2 py-1">
                          <select className="h-10 rounded-md border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900" value={row.priority} onChange={(e) => updateSheetRow(row.id, { priority: e.target.value as SheetRow["priority"] })}>
                            <option>Low</option>
                            <option>Med</option>
                            <option>High</option>
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <select className="h-10 rounded-md border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900" value={row.status} onChange={(e) => updateSheetRow(row.id, { status: e.target.value as SheetRow["status"] })}>
                            <option>Open</option>
                            <option>In Progress</option>
                            <option>Done</option>
                          </select>
                        </td>
                        <td className="px-2 py-1"><Input value={row.notes} onChange={(e) => updateSheetRow(row.id, { notes: e.target.value })} /></td>
                        <td className="px-2 py-1"><Button size="sm" variant="ghost" onClick={() => deleteSheetRow(row.id)}>Delete</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Layout className="h-4 w-4" />Slide Composer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={addSlide}>Add Slide</Button>
                <Button size="sm" variant="outline" onClick={generateSlidesFromDoc}>Generate from Active Doc</Button>
                <Button size="sm" variant="outline" onClick={exportSlidesHtml}>Export HTML Deck</Button>
                <Button size="sm" variant="outline" onClick={() => { void exportSlidesPptx(); }}>Export PPTX</Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {slides.map((slide, idx) => (
                  <Card key={slide.id} className="border border-slate-200 dark:border-slate-700">
                    <CardContent className="space-y-2 pt-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Slide {idx + 1}</p>
                      <Input value={slide.title} onChange={(e) => updateSlide(slide.id, { title: e.target.value })} />
                      <textarea
                        className="h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                        value={slide.bullets}
                        onChange={(e) => updateSlide(slide.id, { bullets: e.target.value })}
                        placeholder="One bullet per line"
                      />
                      <Button size="sm" variant="ghost" onClick={() => deleteSlide(slide.id)}>Delete Slide</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4" />E-sign & Approvals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedDoc ? (
                <p className="text-sm text-slate-500">Select a document in Docs tab first.</p>
              ) : (
                <>
                  <div className="grid gap-2 md:grid-cols-3">
                    <Input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} placeholder="Signer name" />
                    <Input value={signatureRole} onChange={(e) => setSignatureRole(e.target.value)} placeholder="Role" />
                    <Input value={selectedDoc.title} readOnly />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => signDocument("approve")}>Approve + Sign</Button>
                    <Button variant="destructive" onClick={() => signDocument("reject")}>Reject + Sign</Button>
                  </div>
                  <div className="rounded-md border border-slate-200 p-2 text-xs dark:border-slate-700">
                    <p className="font-semibold uppercase tracking-wider text-slate-500">Ready for Sign-off Checklist</p>
                    <label className="mt-2 flex items-center gap-2">
                      <input type="checkbox" checked={signoffChecklist.summaryVerified} onChange={(e) => setSignoffChecklist((c) => ({ ...c, summaryVerified: e.target.checked }))} />
                      Summary reviewed
                    </label>
                    <label className="mt-1 flex items-center gap-2">
                      <input type="checkbox" checked={signoffChecklist.medsReconciled} onChange={(e) => setSignoffChecklist((c) => ({ ...c, medsReconciled: e.target.checked }))} />
                      Medications reconciled
                    </label>
                    <label className="mt-1 flex items-center gap-2">
                      <input type="checkbox" checked={signoffChecklist.followUpDocumented} onChange={(e) => setSignoffChecklist((c) => ({ ...c, followUpDocumented: e.target.checked }))} />
                      Follow-up documented
                    </label>
                  </div>
                  <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Recent Signatures</p>
                    <div className="mt-2 space-y-1 text-xs">
                      {selectedDoc.signatures.length === 0 ? (
                        <p className="text-slate-500">No signatures yet.</p>
                      ) : (
                        selectedDoc.signatures.slice(0, 8).map((sig) => (
                          <p key={`${sig.name}-${sig.timestamp}`}>
                            {new Date(sig.timestamp).toLocaleString()} - {sig.name} ({sig.role}) - {sig.decision}
                          </p>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Audit Trail</p>
                    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                      {selectedDoc.audit.slice(0, 15).map((entry) => (
                        <p key={`${entry.at}-${entry.action}`}>
                          {new Date(entry.at).toLocaleString()} - {entry.action}: {entry.detail}
                        </p>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" />AI Assistant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="h-36 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Paste document text for rewrite/summarize/translate/simplify"
              />
              <div className="rounded-md border border-slate-200 p-2 text-xs dark:border-slate-700">
                <p className="font-semibold uppercase tracking-wider text-slate-500">AI Governance</p>
                <label className="mt-2 flex items-center gap-2">
                  <input type="checkbox" checked={allowPhiOutbound} onChange={(e) => setAllowPhiOutbound(e.target.checked)} />
                  Allow PHI in backend AI requests
                </label>
                <p className="mt-1 text-slate-500">When disabled, likely PHI content is blocked from outbound AI calls and only local transforms are used.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => { void aiRewrite(); }}>Rewrite for Clarity</Button>
                <Button size="sm" variant="outline" onClick={() => { void aiSummarize(); }}>Summarize</Button>
                <Button size="sm" variant="outline" onClick={() => { void aiTranslate("es"); }}>Translate to Spanish</Button>
                <Button size="sm" variant="outline" onClick={() => { void aiTranslate("en"); }}>Translate to English</Button>
                <Button size="sm" variant="outline" onClick={() => { void aiPatientFriendly(); }}>Patient-friendly</Button>
                <select
                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                  value={aiApplyMode}
                  onChange={(e) => setAiApplyMode(e.target.value as "replace" | "append" | "insert")}
                >
                  <option value="replace">Apply Mode: Replace</option>
                  <option value="append">Apply Mode: Append</option>
                  <option value="insert">Apply Mode: Insert at Cursor</option>
                </select>
                <Button size="sm" variant={markAiChanges ? "default" : "outline"} onClick={() => setMarkAiChanges((v) => !v)}>
                  {markAiChanges ? "AI Marking: On" : "AI Marking: Off"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAiPreviewOpen((open) => !open)}>
                  {aiPreviewOpen ? "Hide Apply Preview" : "Preview Apply"}
                </Button>
                <Button size="sm" variant="outline" onClick={applyAiOutputToSelectedDoc}>Apply Output to Active Doc</Button>
                <Button size="sm" variant="outline" onClick={undoLastAiApply} disabled={aiUndoStack.length === 0}>Undo Last AI Apply</Button>
                <Button size="sm" variant="outline" onClick={redoLastAiApply} disabled={aiRedoStack.length === 0}>Redo Last AI Apply</Button>
              </div>
              <textarea
                className="h-36 w-full rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm dark:border-blue-800 dark:bg-blue-950/30"
                value={aiOutput}
                onChange={() => undefined}
                readOnly
                placeholder="AI output"
              />
              {aiPreviewOpen && (
                <div className="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Current Document Text</p>
                    <textarea
                      className="h-40 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                      readOnly
                      value={selectedDoc ? stripHtml(selectedDoc.content) : "No active document selected."}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">AI Output Preview</p>
                    <textarea
                      className="h-40 w-full rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs dark:border-blue-800 dark:bg-blue-950/30"
                      readOnly
                      value={aiOutput || "No AI output yet."}
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-500">
                These helpers are local deterministic assists. For clinical-grade reasoning, connect this panel to your enterprise AI backend.
              </p>
              <p className="text-xs text-slate-500">
                Shortcuts: Ctrl/Cmd+S save version, Ctrl/Cmd+Alt+P toggle preview, Ctrl/Cmd+Alt+Enter apply AI, Ctrl/Cmd+Alt+U undo, Ctrl/Cmd+Alt+R redo.
              </p>
              {aiUndoStack[0] && (
                <p className="text-xs text-slate-500">
                  Undo available ({aiUndoStack.length} step{aiUndoStack.length === 1 ? "" : "s"}) starting from {new Date(aiUndoStack[0].capturedAt).toLocaleTimeString()}.
                </p>
              )}
              {aiRedoStack[0] && (
                <p className="text-xs text-slate-500">
                  Redo available ({aiRedoStack.length} step{aiRedoStack.length === 1 ? "" : "s"}) starting from {new Date(aiRedoStack[0].capturedAt).toLocaleTimeString()}.
                </p>
              )}
              <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">AI Operation Log</p>
                <div className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs">
                  {aiOps.length === 0 ? (
                    <p className="text-slate-500">No AI operations yet.</p>
                  ) : (
                    aiOps.slice(0, 8).map((op) => (
                      <p key={op.id}>
                        {new Date(op.at).toLocaleTimeString()} - {op.action} ({op.mode}) - {op.note}
                      </p>
                    ))
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Backend status: {aiBackendStatus === "connected" ? "Connected" : aiBackendStatus === "fallback" ? "Fallback mode" : "Idle"}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}

export default ProductivitySuitePage;
