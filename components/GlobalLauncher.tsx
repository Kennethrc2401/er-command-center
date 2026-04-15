"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Command, Search, Sparkles, Star } from "lucide-react";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { toast } from "sonner";

type LauncherItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  tags: string[];
  roles: Array<string | "ANY">;
  kind: "route" | "pack";
};

type LauncherAction = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  roles: Array<string | "ANY">;
  feedback?: string;
  run: () => void;
};

type LauncherBundle = {
  title: string;
  subtitle: string;
  actions: string[];
  routes: string[];
};

type LauncherRunLogEntry = {
  key: string;
  id: string;
  label: string;
  kind: "action" | "route";
  ranAt: number;
};

type LauncherPreferences = {
  version: number;
  favorites: string[];
  recents: string[];
  usageMap: Record<string, number>;
  bundlePinsByRole: Record<string, string[]>;
  runLog: LauncherRunLogEntry[];
};

const FAVORITES_KEY = "global-launcher:favorites";
const RECENTS_KEY = "global-launcher:recents";
const USAGE_KEY = "global-launcher:usage";
const BUNDLE_PINS_KEY = "global-launcher:bundle-pins";
const RUN_LOG_KEY = "global-launcher:run-log";
const PREFERENCES_VERSION = 1;
const OPEN_EVENT = "open-global-launcher";
const PREFERENCES_ACTION_EVENT = "global-launcher-preferences-action";
const OPEN_NEW_PATIENT_EVENT = "open-new-patient-modal";
const OPEN_SCRIBE_EVENT = "open-global-scribe";

const BASE_ITEMS: LauncherItem[] = [
  {
    id: "triage-board",
    title: "Triage Board",
    description: "Open the live patient flow, beds, and acuity board.",
    href: "/dashboard/triage",
    tags: ["patients", "bed board", "acuity", "live"],
    roles: ["ANY"],
    kind: "route",
  },
  {
    id: "training-center",
    title: "Training Center",
    description: "Switch into practice, procedure prep, or protocol guides.",
    href: "/dashboard/training?tab=practice",
    tags: ["training", "practice", "prep", "protocols"],
    roles: ["ANY"],
    kind: "route",
  },
  {
    id: "study-notes",
    title: "Study Notes",
    description: "Review class notes and capture study sessions with AI support.",
    href: "/dashboard/study-notes",
    tags: ["notes", "study", "academic"],
    roles: ["ANY"],
    kind: "route",
  },
  {
    id: "references-hub",
    title: "References Hub",
    description: "Open drug dictionary and clinical bedside reference guides.",
    href: "/dashboard/references",
    tags: ["references", "drug", "labs", "vitals", "procedures"],
    roles: ["ANY"],
    kind: "route",
  },
  {
    id: "ai-tools",
    title: "AI Tools Hub",
    description: "Launch the clinical, handoff, and documentation copilot tools.",
    href: "/dashboard/ai-tools",
    tags: ["scribe", "handoff", "ai", "copilot"],
    roles: ["ANY"],
    kind: "route",
  },
  {
    id: "or-scheduler",
    title: "OR Scheduler",
    description: "Move into operative case scheduling and timeline management.",
    href: "/dashboard/or-scheduler",
    tags: ["or", "surgery", "schedule"],
    roles: ["ANY"],
    kind: "route",
  },
  {
    id: "faxes",
    title: "Faxes",
    description: "Manage incoming and outgoing fax workflow.",
    href: "/dashboard/faxes",
    tags: ["fax", "documents", "referrals"],
    roles: ["ANY"],
    kind: "route",
  },
  {
    id: "procedure-pack",
    title: "Print Procedure Prep",
    description: "Open the procedure prep tab for a printable quick card.",
    href: "/dashboard/training?tab=prep",
    tags: ["print", "procedure", "prep", "checklist"],
    roles: ["ANY"],
    kind: "pack",
  },
  {
    id: "protocol-pack",
    title: "Print Protocol Pack",
    description: "Jump to protocol guides and printable quick references.",
    href: "/dashboard/training?tab=protocols",
    tags: ["print", "protocol", "guide", "reference"],
    roles: ["ANY"],
    kind: "pack",
  },
  {
    id: "admin-suite",
    title: "Admin Suite",
    description: "Open revenue, compliance, and operational management tools.",
    href: "/dashboard/admin",
    tags: ["admin", "revenue", "compliance"],
    roles: ["ADMIN"],
    kind: "route",
  },
  {
    id: "clinical-research",
    title: "Clinical Research",
    description: "Review cohort analytics and export de-identified findings.",
    href: "/dashboard/admin/research",
    tags: ["research", "analytics", "cohort"],
    roles: ["ADMIN"],
    kind: "route",
  },
];

function readStoredList(key: string) {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [] as string[];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [] as string[];
  }
}

function writeStoredList(key: string, values: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(values.slice(0, 12)));
}

function readUsageMap() {
  if (typeof window === "undefined") return {} as Record<string, number>;
  try {
    const raw = window.localStorage.getItem(USAGE_KEY);
    if (!raw) return {} as Record<string, number>;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {} as Record<string, number>;

    return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, value]) => {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        acc[key] = Math.floor(value);
      }
      return acc;
    }, {});
  } catch {
    return {} as Record<string, number>;
  }
}

function writeUsageMap(map: Record<string, number>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USAGE_KEY, JSON.stringify(map));
}

function readBundlePinsMap() {
  if (typeof window === "undefined") return {} as Record<string, string[]>;
  try {
    const raw = window.localStorage.getItem(BUNDLE_PINS_KEY);
    if (!raw) return {} as Record<string, string[]>;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {} as Record<string, string[]>;

    return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, string[]>>((acc, [key, value]) => {
      if (Array.isArray(value)) {
        acc[key] = value.filter((entry): entry is string => typeof entry === "string");
      }
      return acc;
    }, {});
  } catch {
    return {} as Record<string, string[]>;
  }
}

function writeBundlePinsMap(map: Record<string, string[]>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BUNDLE_PINS_KEY, JSON.stringify(map));
}

function readRunLog() {
  if (typeof window === "undefined") return [] as LauncherRunLogEntry[];
  try {
    const raw = window.localStorage.getItem(RUN_LOG_KEY);
    if (!raw) return [] as LauncherRunLogEntry[];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [] as LauncherRunLogEntry[];

    return parsed
      .filter((entry): entry is LauncherRunLogEntry => {
        return Boolean(
          entry &&
          typeof entry === "object" &&
          typeof (entry as LauncherRunLogEntry).key === "string" &&
          typeof (entry as LauncherRunLogEntry).id === "string" &&
          typeof (entry as LauncherRunLogEntry).label === "string" &&
          ((entry as LauncherRunLogEntry).kind === "action" || (entry as LauncherRunLogEntry).kind === "route") &&
          typeof (entry as LauncherRunLogEntry).ranAt === "number"
        );
      })
      .slice(0, 10);
  } catch {
    return [] as LauncherRunLogEntry[];
  }
}

function writeRunLog(runLog: LauncherRunLogEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RUN_LOG_KEY, JSON.stringify(runLog.slice(0, 10)));
}

function normalizeStringArray(value: unknown, max = 12) {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((entry): entry is string => typeof entry === "string").slice(0, max);
}

function parsePreferences(raw: string): LauncherPreferences | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const record = parsed as Record<string, unknown>;
    const version = typeof record.version === "number" ? record.version : 0;
    if (version !== PREFERENCES_VERSION) return null;

    const favorites = normalizeStringArray(record.favorites, 12);
    const recents = normalizeStringArray(record.recents, 8);

    const usageMap = Object.entries((record.usageMap ?? {}) as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, value]) => {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        acc[key] = Math.floor(value);
      }
      return acc;
    }, {});

    const bundlePinsByRole = Object.entries((record.bundlePinsByRole ?? {}) as Record<string, unknown>).reduce<Record<string, string[]>>((acc, [key, value]) => {
      acc[key] = normalizeStringArray(value, 6);
      return acc;
    }, {});

    const rawRunLog = Array.isArray(record.runLog) ? record.runLog : [];
    const normalizedRunLog = rawRunLog
      .filter((entry): entry is LauncherRunLogEntry => {
        return Boolean(
          entry &&
          typeof entry === "object" &&
          typeof (entry as LauncherRunLogEntry).key === "string" &&
          typeof (entry as LauncherRunLogEntry).id === "string" &&
          typeof (entry as LauncherRunLogEntry).label === "string" &&
          ((entry as LauncherRunLogEntry).kind === "action" || (entry as LauncherRunLogEntry).kind === "route") &&
          typeof (entry as LauncherRunLogEntry).ranAt === "number"
        );
      })
      .slice(0, 10);

    return {
      version,
      favorites,
      recents,
      usageMap,
      bundlePinsByRole,
      runLog: normalizedRunLog,
    };
  } catch {
    return null;
  }
}

function mergePreferences(current: LauncherPreferences, imported: LauncherPreferences): LauncherPreferences {
  const favorites = [...imported.favorites, ...current.favorites]
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 12);

  const recents = [...imported.recents, ...current.recents]
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 8);

  const usageMap = Object.entries({ ...current.usageMap, ...imported.usageMap }).reduce<Record<string, number>>((acc, [key]) => {
    const currentValue = current.usageMap[key] ?? 0;
    const importedValue = imported.usageMap[key] ?? 0;
    const total = currentValue + importedValue;
    if (total > 0) {
      acc[key] = total;
    }
    return acc;
  }, {});

  const roleKeys = Array.from(new Set([...Object.keys(current.bundlePinsByRole), ...Object.keys(imported.bundlePinsByRole)]));
  const bundlePinsByRole = roleKeys.reduce<Record<string, string[]>>((acc, key) => {
    const mergedPins = [...(imported.bundlePinsByRole[key] ?? []), ...(current.bundlePinsByRole[key] ?? [])]
      .filter((value, index, array) => array.indexOf(value) === index)
      .slice(0, 6);
    acc[key] = mergedPins;
    return acc;
  }, {});

  const runLog = [...imported.runLog, ...current.runLog]
    .sort((a, b) => b.ranAt - a.ranAt)
    .filter((entry, index, array) => array.findIndex((candidate) => candidate.key === entry.key) === index)
    .slice(0, 10);

  return {
    version: PREFERENCES_VERSION,
    favorites,
    recents,
    usageMap,
    bundlePinsByRole,
    runLog,
  };
}

export default function GlobalLauncher() {
  const router = useRouter();
  const { actorRole, isAdmin } = useResolvedActor();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => readStoredList(FAVORITES_KEY));
  const [recents, setRecents] = useState<string[]>(() => readStoredList(RECENTS_KEY));
  const [usageMap, setUsageMap] = useState<Record<string, number>>(() => readUsageMap());
  const [bundlePinsByRole, setBundlePinsByRole] = useState<Record<string, string[]>>(() => readBundlePinsMap());
  const [runLog, setRunLog] = useState<LauncherRunLogEntry[]>(() => readRunLog());
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importDraft, setImportDraft] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "replace">("replace");
  const roleKey = isAdmin ? "ADMIN" : actorRole;

  const currentPreferences = useMemo<LauncherPreferences>(() => ({
    version: PREFERENCES_VERSION,
    favorites,
    recents,
    usageMap,
    bundlePinsByRole,
    runLog,
  }), [bundlePinsByRole, favorites, recents, runLog, usageMap]);

  const parsedImport = useMemo(() => {
    if (!importDraft.trim()) return null;
    return parsePreferences(importDraft);
  }, [importDraft]);

  const previewPreferences = useMemo(() => {
    if (!parsedImport) return null;
    return importMode === "merge" ? mergePreferences(currentPreferences, parsedImport) : parsedImport;
  }, [currentPreferences, importMode, parsedImport]);

  const importImpact = useMemo(() => {
    if (!previewPreferences) return null;

    const beforeFavorites = new Set(currentPreferences.favorites);
    const afterFavorites = new Set(previewPreferences.favorites);
    const favoritesAdded = previewPreferences.favorites.filter((value) => !beforeFavorites.has(value)).length;
    const favoritesRemoved = currentPreferences.favorites.filter((value) => !afterFavorites.has(value)).length;

    const beforeRecents = new Set(currentPreferences.recents);
    const afterRecents = new Set(previewPreferences.recents);
    const recentsAdded = previewPreferences.recents.filter((value) => !beforeRecents.has(value)).length;
    const recentsRemoved = currentPreferences.recents.filter((value) => !afterRecents.has(value)).length;

    const beforeUsageKeys = Object.keys(currentPreferences.usageMap);
    const afterUsageKeys = Object.keys(previewPreferences.usageMap);
    const usageKeysAdded = afterUsageKeys.filter((key) => !(key in currentPreferences.usageMap)).length;
    const usageKeysRemoved = beforeUsageKeys.filter((key) => !(key in previewPreferences.usageMap)).length;

    const beforeRunLogKeys = new Set(currentPreferences.runLog.map((entry) => entry.key));
    const afterRunLogKeys = new Set(previewPreferences.runLog.map((entry) => entry.key));
    const runLogAdded = previewPreferences.runLog.filter((entry) => !beforeRunLogKeys.has(entry.key)).length;
    const runLogRemoved = currentPreferences.runLog.filter((entry) => !afterRunLogKeys.has(entry.key)).length;

    const rolePinKeys = Array.from(new Set([
      ...Object.keys(currentPreferences.bundlePinsByRole),
      ...Object.keys(previewPreferences.bundlePinsByRole),
    ]));

    const rolePinChanges = rolePinKeys.filter((key) => {
      const before = (currentPreferences.bundlePinsByRole[key] ?? []).join("|");
      const after = (previewPreferences.bundlePinsByRole[key] ?? []).join("|");
      return before !== after;
    }).length;

    return {
      favoritesAdded,
      favoritesRemoved,
      recentsAdded,
      recentsRemoved,
      usageKeysAdded,
      usageKeysRemoved,
      runLogAdded,
      runLogRemoved,
      rolePinChanges,
    };
  }, [currentPreferences, previewPreferences]);

  const items = useMemo(() => {
    const roleKey = isAdmin ? "ADMIN" : actorRole;
    return BASE_ITEMS.filter((item) => item.roles.includes("ANY") || item.roles.includes(roleKey));
  }, [actorRole, isAdmin]);

  const visibleItems = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return items;

    return items.filter((item) => {
      const haystack = [item.title, item.description, ...item.tags].join(" ").toLowerCase();
      return haystack.includes(search);
    });
  }, [items, query]);

  const favoriteItems = useMemo(
    () => items.filter((item) => favorites.includes(item.id)),
    [favorites, items]
  );

  const recentItems = useMemo(
    () => recents.map((itemId) => items.find((item) => item.id === itemId)).filter((item): item is LauncherItem => Boolean(item)),
    [items, recents]
  );

  const recommendedItems = useMemo(() => {
    const orderByRole: Record<string, string[]> = {
      ADMIN: ["admin-suite", "clinical-research", "triage-board", "references-hub"],
      PROVIDER: ["triage-board", "references-hub", "ai-tools", "protocol-pack"],
      RN: ["triage-board", "references-hub", "procedure-pack", "study-notes"],
      CCMA: ["triage-board", "references-hub", "procedure-pack", "faxes"],
    };

    const preferred = orderByRole[actorRole] ?? ["triage-board", "training-center", "ai-tools"];
    return preferred
      .map((itemId) => items.find((item) => item.id === itemId))
      .filter((item): item is LauncherItem => Boolean(item));
  }, [actorRole, items]);

  const actions = useMemo<LauncherAction[]>(() => {
    const baseActions: LauncherAction[] = [
      {
        id: "new-admission",
        title: "New Admission",
        description: "Open the intake modal and start triage registration.",
        tags: ["new", "admit", "patient", "intake"],
        roles: ["ANY"],
        feedback: "New admission workflow opened.",
        run: () => window.dispatchEvent(new CustomEvent(OPEN_NEW_PATIENT_EVENT)),
      },
      {
        id: "open-scribe",
        title: "Open AI Scribe",
        description: "Launch the global clinical scribe overlay.",
        tags: ["scribe", "note", "dictation", "ai"],
        roles: ["ANY"],
        feedback: "Global AI scribe launched.",
        run: () => window.dispatchEvent(new CustomEvent(OPEN_SCRIBE_EVENT)),
      },
      {
        id: "procedure-prep",
        title: "Open Procedure Prep",
        description: "Jump straight to the procedure prep training card.",
        tags: ["prep", "procedure", "print", "setup"],
        roles: ["ANY"],
        run: () => router.push("/dashboard/training?tab=prep"),
      },
      {
        id: "protocol-guides",
        title: "Open Protocol Guides",
        description: "Jump to the triage protocol playbooks.",
        tags: ["protocols", "guides", "triage", "review"],
        roles: ["ANY"],
        run: () => router.push("/dashboard/training?tab=protocols"),
      },
      {
        id: "open-kiosk",
        title: "Open Patient Kiosk",
        description: "Open the check-in screen for arriving patients.",
        tags: ["kiosk", "check-in", "front desk"],
        roles: ["ANY"],
        run: () => router.push("/kiosk"),
      },
      {
        id: "open-references",
        title: "Open References Hub",
        description: "Jump to drug dictionary and clinical quick-reference tools.",
        tags: ["references", "drug", "labs", "vitals", "guide"],
        roles: ["ANY"],
        run: () => router.push("/dashboard/references"),
      },
      {
        id: "print-triage-pack",
        title: "Print Triage Rapid Pack",
        description: "Open protocol guides and launch print for triage escalation cues.",
        tags: ["print", "triage", "protocol", "pack"],
        roles: ["ANY"],
        feedback: "Preparing triage rapid pack print.",
        run: () => router.push("/dashboard/training?tab=protocols&action=print-triage-pack"),
      },
      {
        id: "print-procedure-pack",
        title: "Print Procedure Prep Pack",
        description: "Open protocol guides and launch print for procedure staging reminders.",
        tags: ["print", "procedure", "prep", "pack"],
        roles: ["ANY"],
        feedback: "Preparing procedure prep pack print.",
        run: () => router.push("/dashboard/training?tab=protocols&action=print-procedure-pack"),
      },
      {
        id: "stroke-protocol",
        title: "Open Stroke Protocol Card",
        description: "Jump directly to NIHSS stroke escalation checkpoints.",
        tags: ["stroke", "nihss", "neuro", "protocol"],
        roles: ["ANY"],
        run: () => router.push("/dashboard/training?tab=protocols#protocol-stroke-nihss"),
      },
      {
        id: "stemi-protocol",
        title: "Open STEMI Protocol Card",
        description: "Jump directly to cardiac chest-pain escalation checkpoints.",
        tags: ["stemi", "cardiac", "chest pain", "protocol"],
        roles: ["ANY"],
        run: () => router.push("/dashboard/training?tab=protocols#protocol-stemi-cardiac"),
      },
      {
        id: "sepsis-protocol",
        title: "Open Sepsis Protocol Card",
        description: "Jump directly to sepsis screening and escalation checkpoints.",
        tags: ["sepsis", "infection", "lactate", "protocol"],
        roles: ["ANY"],
        run: () => router.push("/dashboard/training?tab=protocols#protocol-sepsis-criteria"),
      },
    ];

    if (isAdmin) {
      baseActions.unshift({
        id: "open-research",
        title: "Open Clinical Research",
        description: "Jump to de-identified research and cohort analytics.",
        tags: ["research", "analytics", "admin"],
        roles: ["ADMIN"],
        run: () => router.push("/dashboard/admin/research"),
      });
    }

    return baseActions.filter((item) => item.roles.includes("ANY") || item.roles.includes(roleKey));
  }, [isAdmin, roleKey, router]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const bumpUsage = useCallback((key: string) => {
    setUsageMap((current) => {
      const next = {
        ...current,
        [key]: (current[key] ?? 0) + 1,
      };
      writeUsageMap(next);
      return next;
    });
  }, []);

  const recordRun = useCallback((entry: Omit<LauncherRunLogEntry, "ranAt">) => {
    setRunLog((current) => {
      const next = [{ ...entry, ranAt: Date.now() }, ...current.filter((item) => item.key !== entry.key)].slice(0, 10);
      writeRunLog(next);
      return next;
    });
  }, []);

  const openItem = useCallback((item: LauncherItem) => {
    const nextRecents = [item.id, ...recents.filter((value) => value !== item.id)].slice(0, 8);
    setRecents(nextRecents);
    writeStoredList(RECENTS_KEY, nextRecents);
    bumpUsage(`route:${item.id}`);
    recordRun({ key: `route:${item.id}`, id: item.id, label: item.title, kind: "route" });
    close();
    router.push(item.href);
  }, [bumpUsage, close, recents, recordRun, router]);

  const toggleFavorite = useCallback((itemId: string) => {
    setFavorites((current) => {
      const next = current.includes(itemId)
        ? current.filter((value) => value !== itemId)
        : [itemId, ...current];
      writeStoredList(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    const keyHandler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };

    window.addEventListener(OPEN_EVENT, openHandler);
    window.addEventListener("keydown", keyHandler);
    return () => {
      window.removeEventListener(OPEN_EVENT, openHandler);
      window.removeEventListener("keydown", keyHandler);
    };
  }, []);

  const sectionItems = query.trim() ? visibleItems : recommendedItems;
  const visibleActions = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return actions;

    return actions.filter((action) => {
      const haystack = [action.title, action.description, ...action.tags].join(" ").toLowerCase();
      return haystack.includes(search);
    });
  }, [actions, query]);

  const runAction = useCallback((action: LauncherAction) => {
    bumpUsage(`action:${action.id}`);
    recordRun({ key: `action:${action.id}`, id: action.id, label: action.title, kind: "action" });
    if (action.feedback) {
      toast.success(action.feedback);
    }
    close();
    action.run();
  }, [bumpUsage, close, recordRun]);

  const runActionById = useCallback((actionId: string) => {
    const match = actions.find((action) => action.id === actionId);
    if (!match) return;
    runAction(match);
  }, [actions, runAction]);

  const openItemById = useCallback((itemId: string) => {
    const match = items.find((item) => item.id === itemId);
    if (!match) return;
    openItem(match);
  }, [items, openItem]);

  const activeBundleDefaults = useMemo<LauncherBundle>(() => {
    if (isAdmin) {
      return {
        title: "Admin Command Bundle",
        subtitle: "Oversight and escalation tools",
        actions: ["open-research", "print-triage-pack", "open-scribe"],
        routes: ["admin-suite", "triage-board", "references-hub"],
      };
    }

    const isProviderRole = actorRole === "DOCTOR" || actorRole === "SURGEON" || actorRole === "ANESTHESIOLOGIST";

    if (isProviderRole) {
      return {
        title: "Provider Command Bundle",
        subtitle: "Decision support and rapid protocol jumps",
        actions: ["open-scribe", "stroke-protocol", "open-references"],
        routes: ["triage-board", "ai-tools", "references-hub"],
      };
    }

    return {
      title: "Nursing Command Bundle",
      subtitle: "Fast intake and protocol workflow",
      actions: ["new-admission", "sepsis-protocol", "open-references"],
      routes: ["triage-board", "references-hub", "study-notes"],
    };
  }, [actorRole, isAdmin]);

  const bundlePinnedActions = useMemo(
    () => bundlePinsByRole[roleKey] ?? [],
    [bundlePinsByRole, roleKey]
  );

  const activeBundle = useMemo<LauncherBundle>(() => {
    const validPinned = bundlePinnedActions.filter((actionId) => actions.some((action) => action.id === actionId));
    if (validPinned.length === 0) return activeBundleDefaults;
    return {
      ...activeBundleDefaults,
      actions: validPinned,
    };
  }, [actions, activeBundleDefaults, bundlePinnedActions]);

  const toggleBundlePin = useCallback((actionId: string) => {
    setBundlePinsByRole((current) => {
      const existing = current[roleKey] ?? [];
      const nextRolePins = existing.includes(actionId)
        ? existing.filter((id) => id !== actionId)
        : [actionId, ...existing].slice(0, 6);

      const next = {
        ...current,
        [roleKey]: nextRolePins,
      };
      writeBundlePinsMap(next);
      return next;
    });
  }, [roleKey]);

  const moveBundlePin = useCallback((actionId: string, direction: "up" | "down") => {
    setBundlePinsByRole((current) => {
      const existing = [...(current[roleKey] ?? [])];
      const index = existing.indexOf(actionId);
      if (index === -1) return current;

      const swapWith = direction === "up" ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= existing.length) return current;

      const temp = existing[index];
      existing[index] = existing[swapWith];
      existing[swapWith] = temp;

      const next = {
        ...current,
        [roleKey]: existing,
      };
      writeBundlePinsMap(next);
      return next;
    });
  }, [roleKey]);

  const resetBundlePins = useCallback(() => {
    setBundlePinsByRole((current) => {
      if (!current[roleKey]) return current;
      const rest = Object.fromEntries(
        Object.entries(current).filter(([entryKey]) => entryKey !== roleKey)
      );
      writeBundlePinsMap(rest);
      return rest;
    });
    toast.success("Bundle pins reset to role defaults.");
  }, [roleKey]);

  const topUsed = useMemo(() => {
    const actionMap = new Map<string, LauncherAction>(
      actions.map((action) => [`action:${action.id}`, action])
    );
    const routeMap = new Map<string, LauncherItem>(
      items.map((item) => [`route:${item.id}`, item])
    );

    return Object.entries(usageMap)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => {
        if (actionMap.has(key)) {
          const action = actionMap.get(key);
          return action ? { key, count, label: action.title, kind: "action" as const, id: action.id } : null;
        }
        if (routeMap.has(key)) {
          const route = routeMap.get(key);
          return route ? { key, count, label: route.title, kind: "route" as const, id: route.id } : null;
        }
        return null;
      })
      .filter((entry): entry is { key: string; count: number; label: string; kind: "action" | "route"; id: string } => Boolean(entry))
      .slice(0, 4);
  }, [actions, items, usageMap]);

  const quickKeyTargets = useMemo(() => {
    const actionTargets = visibleActions
      .slice(0, 5)
      .map((action) => ({ kind: "action" as const, id: action.id, label: action.title }));

    const routeTargets = sectionItems
      .slice(0, 4)
      .map((item) => ({ kind: "route" as const, id: item.id, label: item.title }));

    return [...actionTargets, ...routeTargets].slice(0, 9);
  }, [sectionItems, visibleActions]);

  const replayRun = useCallback((entry: LauncherRunLogEntry) => {
    if (entry.kind === "action") {
      runActionById(entry.id);
      return;
    }
    openItemById(entry.id);
  }, [openItemById, runActionById]);

  const applyPreferencesState = useCallback((next: LauncherPreferences, modeLabel: "merge" | "replace") => {
    setFavorites(next.favorites);
    setRecents(next.recents);
    setUsageMap(next.usageMap);
    setBundlePinsByRole(next.bundlePinsByRole);
    setRunLog(next.runLog);

    writeStoredList(FAVORITES_KEY, next.favorites);
    writeStoredList(RECENTS_KEY, next.recents);
    writeUsageMap(next.usageMap);
    writeBundlePinsMap(next.bundlePinsByRole);
    writeRunLog(next.runLog);

    toast.success(`Launcher preferences imported (${modeLabel}).`);
  }, []);

  const exportPreferences = useCallback(async () => {
    const payload: LauncherPreferences = {
      version: PREFERENCES_VERSION,
      favorites,
      recents,
      usageMap,
      bundlePinsByRole,
      runLog,
    };

    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Launcher preferences copied to clipboard.");
    } catch {
      toast.error("Clipboard is unavailable. Preferences JSON will open in a prompt.");
      window.prompt("Copy launcher preferences JSON", text);
    }
  }, [bundlePinsByRole, favorites, recents, runLog, usageMap]);

  const downloadPreferences = useCallback(() => {
    const payload: LauncherPreferences = {
      version: PREFERENCES_VERSION,
      favorites,
      recents,
      usageMap,
      bundlePinsByRole,
      runLog,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `launcher-preferences-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Launcher preferences downloaded.");
  }, [bundlePinsByRole, favorites, recents, runLog, usageMap]);

  const beginImportPreferences = useCallback(() => {
    setOpen(true);
    setShowImportPanel(true);
  }, []);

  const applyImportPreview = useCallback(() => {
    if (!parsedImport || !previewPreferences) {
      toast.error("Paste a valid launcher preferences JSON payload first.");
      return;
    }

    applyPreferencesState(previewPreferences, importMode);
    setImportDraft("");
    setShowImportPanel(false);
  }, [applyPreferencesState, importMode, parsedImport, previewPreferences]);

  const resetAllLauncherData = useCallback(() => {
    const confirmed = window.confirm("Reset all launcher data? This clears favorites, recents, usage, pins, and run log.");
    if (!confirmed) return;

    setFavorites([]);
    setRecents([]);
    setUsageMap({});
    setBundlePinsByRole({});
    setRunLog([]);

    window.localStorage.removeItem(FAVORITES_KEY);
    window.localStorage.removeItem(RECENTS_KEY);
    window.localStorage.removeItem(USAGE_KEY);
    window.localStorage.removeItem(BUNDLE_PINS_KEY);
    window.localStorage.removeItem(RUN_LOG_KEY);

    toast.success("Launcher data reset complete.");
  }, []);

  useEffect(() => {
    const preferenceActionHandler = (event: Event) => {
      const customEvent = event as CustomEvent<{ action?: "export" | "download" | "import" | "reset" }>;
      const action = customEvent.detail?.action;
      if (!action) return;

      if (action === "export") {
        void exportPreferences();
        return;
      }
      if (action === "download") {
        downloadPreferences();
        return;
      }
      if (action === "import") {
        beginImportPreferences();
        return;
      }
      if (action === "reset") {
        resetAllLauncherData();
      }
    };

    window.addEventListener(PREFERENCES_ACTION_EVENT, preferenceActionHandler);
    return () => window.removeEventListener(PREFERENCES_ACTION_EVENT, preferenceActionHandler);
  }, [beginImportPreferences, downloadPreferences, exportPreferences, resetAllLauncherData]);

  useEffect(() => {
    if (!open) return;

    const hotkeyHandler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key < "1" || event.key > "9") return;

      const index = Number(event.key) - 1;
      const target = quickKeyTargets[index];
      if (!target) return;

      event.preventDefault();
      if (target.kind === "action") {
        runActionById(target.id);
        return;
      }
      openItemById(target.id);
    };

    window.addEventListener("keydown", hotkeyHandler);
    return () => window.removeEventListener("keydown", hotkeyHandler);
  }, [open, openItemById, quickKeyTargets, runActionById]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-start justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-md sm:py-10">
      <div className="aurora-panel glass-panel w-full max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Global Launcher</p>
            <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
              <Command className="h-4 w-4 text-violet-500" /> Search, Favorites, and Recent
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Close
          </button>
        </div>

        <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search routes, packs, procedures, and tools..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none ring-0 placeholder:text-slate-400 focus:border-violet-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
            Tip: Ctrl+K opens this launcher from anywhere. Press 1-9 to run top commands.
          </p>
        </div>

        <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60 md:border-b-0 md:border-r">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Preferences</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => void exportPreferences()}
                    className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    onClick={downloadPreferences}
                    className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={beginImportPreferences}
                    className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                  >
                    Import
                  </button>
                  <button
                    type="button"
                    onClick={resetAllLauncherData}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-rose-700 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    Reset All
                  </button>
                </div>

                {showImportPanel ? (
                  <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-950">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Import Preview</p>
                    <textarea
                      value={importDraft}
                      onChange={(event) => setImportDraft(event.target.value)}
                      placeholder="Paste launcher preferences JSON"
                      className="mt-2 h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-900 outline-none focus:border-cyan-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />

                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setImportMode("replace")}
                        className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] ${importMode === "replace" ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"}`}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode("merge")}
                        className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] ${importMode === "merge" ? "border-cyan-300 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"}`}
                      >
                        Merge
                      </button>
                    </div>

                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Impact Preview ({importMode})</p>
                      <div className="mt-1 grid grid-cols-2 gap-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        <span>Fav +{importImpact?.favoritesAdded ?? "-"} / -{importImpact?.favoritesRemoved ?? "-"}</span>
                        <span>Recent +{importImpact?.recentsAdded ?? "-"} / -{importImpact?.recentsRemoved ?? "-"}</span>
                        <span>Usage +{importImpact?.usageKeysAdded ?? "-"} / -{importImpact?.usageKeysRemoved ?? "-"}</span>
                        <span>Run +{importImpact?.runLogAdded ?? "-"} / -{importImpact?.runLogRemoved ?? "-"}</span>
                        <span className="col-span-2">Role Pin Sets Changed: {importImpact?.rolePinChanges ?? "-"}</span>
                      </div>
                    </div>

                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={applyImportPreview}
                        disabled={!parsedImport || !previewPreferences}
                        className="rounded-xl border border-cyan-300 bg-cyan-50 px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-700 hover:bg-cyan-100 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300"
                      >
                        Apply Import
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowImportPanel(false);
                          setImportDraft("");
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>

                    {importDraft.trim() && !parsedImport ? (
                      <p className="mt-2 text-[9px] font-black uppercase tracking-[0.2em] text-rose-600 dark:text-rose-300">Invalid JSON payload.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">{activeBundle.title}</p>
                <p className="mb-2 text-[10px] text-slate-500 dark:text-slate-400">{activeBundle.subtitle}</p>
                {bundlePinnedActions.length > 0 ? (
                  <button
                    type="button"
                    onClick={resetBundlePins}
                    className="mb-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                  >
                    Reset Pins
                  </button>
                ) : null}
                <div className="space-y-2">
                  {activeBundle.actions.map((actionId) => {
                    const action = actions.find((entry) => entry.id === actionId);
                    if (!action) return null;
                    const pinnedIndex = bundlePinnedActions.indexOf(action.id);
                    const isPinned = pinnedIndex !== -1;
                    return (
                      <div key={action.id} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-950">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => runActionById(action.id)}
                            className="flex-1 text-left"
                          >
                            <span className="block text-[11px] font-black uppercase text-slate-900 dark:text-slate-100">{action.title}</span>
                          </button>
                          {isPinned && bundlePinnedActions.length > 1 ? (
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => moveBundlePin(action.id, "up")}
                                disabled={pinnedIndex <= 0}
                                className="rounded-lg border border-slate-200 px-1.5 py-0.5 text-[9px] font-black text-slate-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                                aria-label={`Move ${action.title} up`}
                              >
                                ^
                              </button>
                              <button
                                type="button"
                                onClick={() => moveBundlePin(action.id, "down")}
                                disabled={pinnedIndex >= bundlePinnedActions.length - 1}
                                className="rounded-lg border border-slate-200 px-1.5 py-0.5 text-[9px] font-black text-slate-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                                aria-label={`Move ${action.title} down`}
                              >
                                v
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeBundle.routes.map((routeId) => {
                    const route = items.find((entry) => entry.id === routeId);
                    if (!route) return null;
                    return (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => openItemById(route.id)}
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                      >
                        {route.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 text-cyan-500" /> Actions
                </p>
                <div className="space-y-2">
                  {visibleActions.length > 0 ? visibleActions.slice(0, 4).map((action, index) => (
                    <div key={action.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 dark:border-slate-700 dark:bg-slate-950">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => runAction(action)}
                          className="flex-1 text-left"
                        >
                          <span className="flex items-center justify-between gap-2 text-[11px] font-black uppercase text-slate-900 dark:text-slate-100">
                            {action.title}
                            <span className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[8px] tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:text-slate-300">{index + 1}</span>
                          </span>
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">{action.description}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleBundlePin(action.id)}
                          className={`rounded-xl border px-2 py-1.5 ${bundlePinnedActions.includes(action.id) ? "border-amber-200 bg-amber-50 text-amber-600" : "border-slate-200 bg-slate-50 text-slate-400 hover:border-violet-300"}`}
                          aria-label={`Pin action ${action.title} in bundle`}
                        >
                          <Star className={`h-3.5 w-3.5 ${bundlePinnedActions.includes(action.id) ? "fill-amber-400" : ""}`} />
                        </button>
                      </div>
                    </div>
                  )) : (
                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">No actions match your search.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                  <Star className="h-3.5 w-3.5 text-amber-500" /> Favorites
                </p>
                <div className="space-y-2">
                  {favoriteItems.length > 0 ? favoriteItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openItem(item)}
                      className="flex w-full items-start justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm hover:border-violet-300 dark:border-slate-700 dark:bg-slate-950"
                    >
                      <span>
                        <span className="block text-[11px] font-black uppercase text-slate-900 dark:text-slate-100">{item.title}</span>
                        <span className="block text-[10px] text-slate-500 dark:text-slate-400">{item.description}</span>
                      </span>
                      <Star className="mt-0.5 h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    </button>
                  )) : (
                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Pin a few favorites for one-click access.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                  <Clock3 className="h-3.5 w-3.5" /> Recent
                </p>
                <div className="space-y-2">
                  {recentItems.length > 0 ? recentItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openItem(item)}
                      className="flex w-full items-start justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm hover:border-cyan-300 dark:border-slate-700 dark:bg-slate-950"
                    >
                      <span>
                        <span className="block text-[11px] font-black uppercase text-slate-900 dark:text-slate-100">{item.title}</span>
                        <span className="block text-[10px] text-slate-500 dark:text-slate-400">{item.description}</span>
                      </span>
                    </button>
                  )) : (
                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Your recent items will appear here.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Most Used</p>
                <div className="space-y-2">
                  {topUsed.length > 0 ? topUsed.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => entry.kind === "action" ? runActionById(entry.id) : openItemById(entry.id)}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm hover:border-violet-300 dark:border-slate-700 dark:bg-slate-950"
                    >
                      <span className="block text-[11px] font-black uppercase text-slate-900 dark:text-slate-100">{entry.label}</span>
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:text-slate-300">{entry.count}</span>
                    </button>
                  )) : (
                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Run commands to build your usage profile.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Recent Runs</p>
                <div className="space-y-2">
                  {runLog.length > 0 ? runLog.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => replayRun(entry)}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm hover:border-cyan-300 dark:border-slate-700 dark:bg-slate-950"
                    >
                      <span>
                        <span className="block text-[11px] font-black uppercase text-slate-900 dark:text-slate-100">{entry.label}</span>
                        <span className="block text-[9px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{new Date(entry.ranAt).toLocaleTimeString()}</span>
                      </span>
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:text-slate-300">Run</span>
                    </button>
                  )) : (
                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">No commands run yet in this session profile.</p>
                  )}
                </div>
              </div>
            </div>
          </aside>

          <div className="max-h-[70vh] overflow-y-auto p-4 md:p-5">
            {query.trim() === "" && visibleActions.length > 0 ? (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Quick Actions</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => runAction(action)}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                    >
                      <span className="block text-[11px] font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{action.title}</span>
                      <span className="mt-1 block text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{action.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              {sectionItems.map((item) => {
                const isFavorite = favorites.includes(item.id);
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => openItem(item)} className="text-left">
                        <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">{item.kind}</span>
                        <h3 className="mt-1 text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{item.title}</h3>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(item.id)}
                        className={`rounded-xl border px-2 py-2 ${isFavorite ? "border-amber-200 bg-amber-50 text-amber-600" : "border-slate-200 bg-slate-50 text-slate-400 hover:border-violet-300"}`}
                        aria-label={`Toggle favorite for ${item.title}`}
                      >
                        <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-amber-400" : ""}`} />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className="mt-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-violet-600 hover:text-violet-500 dark:text-violet-300"
                    >
                      Open <Sparkles className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}

              {sectionItems.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
                  No matches found. Try a different keyword.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
