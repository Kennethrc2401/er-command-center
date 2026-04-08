"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import GlobalSearch from "@/components/clinical/GlobalSearch";
import TriageTabs from "@/components/clinical/TriageTabs";
import { Activity, ArrowUpRight, Clock, Copy, Download, Lock, Rows3, Star } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useStaffSession } from "@/lib/hooks/useStaffSession";
import { calculateNEWS2 } from "@/lib/helpers/news2";
import { toast } from "sonner";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { usePresentationMode } from "@/lib/hooks/usePresentationMode";
import { saveAIToolsPrefill } from "@/lib/helpers/aiTools";

const PATIENT_LIST_CRITICAL_ONLY_KEY = "triage-patient-list-critical-only";
const PATIENT_LIST_SORT_KEY = "triage-patient-list-sort";
const PATIENT_LIST_LAST_BULK_RUN_KEY = "triage-patient-list-last-bulk-run";
const PATIENT_LIST_WATCHLIST_KEY = "triage-patient-list-watchlist";
const PATIENT_LIST_WATCHLIST_NOTES_KEY = "triage-patient-list-watchlist-notes";
const PATIENT_LIST_SHIFT_HEADER_KEY = "triage-patient-list-shift-header";
const PATIENT_LIST_SHIFT_SNAPSHOTS_KEY = "triage-patient-list-shift-snapshots";
const PATIENT_LIST_SHIFT_DASHBOARD_COLLAPSED_KEY = "triage-patient-list-shift-dashboard-collapsed";
const PATIENT_LIST_SAVED_VIEWS_COLLAPSED_KEY = "triage-patient-list-saved-views-collapsed";
type PatientListSortMode = "wait" | "acuity" | "risk";
type PatientListQuickView = "all" | "critical" | "boarding" | "longWait" | "watchlist" | "unassigned" | "breaches";
type LastBulkRunSummary = { at: number; applied: number; candidates: number };
type ShiftHeaderDraft = { owner: string; unit: string; shiftNote: string };
type ShiftSnapshot = {
  id: string;
  at: number;
  owner: string;
  unit: string;
  shiftNote: string;
  watchlistEncounterIds: string[];
  watchlistNotesByEncounter: Record<string, string>;
};

export default function TriagePatientListPage() {
  const { isSignedIn } = useAuth();
  const staffSession = useStaffSession();
  const isAuthenticated = Boolean(isSignedIn || staffSession.authenticated);

  if (!isSignedIn && staffSession.loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center space-y-6 p-6 text-center">
        <div className="rounded-full bg-slate-100 p-6 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
          <Lock className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-slate-100">Clinical Access Restricted</h1>
          <p className="mx-auto max-w-sm font-medium text-slate-500 dark:text-slate-300">
            This system contains Protected Health Information (PHI). Please sign in to access the patient list.
          </p>
        </div>
        <Link
          href="/staff-login"
          className="rounded-xl bg-blue-600 px-8 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-blue-100 transition-all hover:bg-blue-700"
        >
          Staff Login
        </Link>
      </div>
    );
  }

  return <TriagePatientListContent />;
}

function TriagePatientListContent() {
  const router = useRouter();
  const activeEncounters = useQuery(api.encounters.getActive);
  const runSlaEscalationSweep = useMutation(api.workflow.runSlaEscalationSweep);
  const updateEncounterFlow = useMutation(api.encounters.updateEncounterFlow);
  const routeRoleNotification = useMutation(api.workflow.routeRoleNotification);
  const upsertSharedWatchlist = useMutation(api.workflow.upsertSharedWatchlistEntry);
  const { actorName, actorRole, isAdmin } = useResolvedActor();
  const { isDemoMode, toggleDemoMode } = usePresentationMode();
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [searchTerm, setSearchTerm] = useState("");
  const [quickView, setQuickView] = useState<PatientListQuickView>("all");
  const [watchlistEncounterIds, setWatchlistEncounterIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem(PATIENT_LIST_WATCHLIST_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((value): value is string => typeof value === "string");
    } catch {
      return [];
    }
  });
  const [watchlistNotesByEncounter, setWatchlistNotesByEncounter] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = window.localStorage.getItem(PATIENT_LIST_WATCHLIST_NOTES_KEY);
      if (!saved) return {};
      const parsed = JSON.parse(saved) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string") {
          normalized[key] = value;
        }
      }
      return normalized;
    } catch {
      return {};
    }
  });
  const [shiftHeader, setShiftHeader] = useState<ShiftHeaderDraft>(() => {
    if (typeof window === "undefined") {
      return { owner: "", unit: "ER-4B", shiftNote: "" };
    }
    try {
      const saved = window.localStorage.getItem(PATIENT_LIST_SHIFT_HEADER_KEY);
      if (!saved) return { owner: "", unit: "ER-4B", shiftNote: "" };
      const parsed = JSON.parse(saved) as Partial<ShiftHeaderDraft>;
      return {
        owner: typeof parsed.owner === "string" ? parsed.owner : "",
        unit: typeof parsed.unit === "string" && parsed.unit.trim() ? parsed.unit : "ER-4B",
        shiftNote: typeof parsed.shiftNote === "string" ? parsed.shiftNote : "",
      };
    } catch {
      return { owner: "", unit: "ER-4B", shiftNote: "" };
    }
  });
  const [shiftSnapshots, setShiftSnapshots] = useState<ShiftSnapshot[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem(PATIENT_LIST_SHIFT_SNAPSHOTS_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((snapshot): snapshot is ShiftSnapshot => {
        return (
          snapshot &&
          typeof snapshot === "object" &&
          typeof (snapshot as ShiftSnapshot).id === "string" &&
          typeof (snapshot as ShiftSnapshot).at === "number" &&
          Array.isArray((snapshot as ShiftSnapshot).watchlistEncounterIds)
        );
      });
    } catch {
      return [];
    }
  });
  const [isShiftDashboardCollapsed, setIsShiftDashboardCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PATIENT_LIST_SHIFT_DASHBOARD_COLLAPSED_KEY) === "1";
  });
  const [isSavedViewsCollapsed, setIsSavedViewsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PATIENT_LIST_SAVED_VIEWS_COLLAPSED_KEY) === "1";
  });
  const [isRunningBulkAction, setIsRunningBulkAction] = useState(false);

  const sharedWatchlist = useQuery(api.workflow.getSharedWatchlist, {
    unit: shiftHeader.unit.trim() || "ER-4B",
  });
  const [lastBulkRun, setLastBulkRun] = useState<LastBulkRunSummary | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = window.localStorage.getItem(PATIENT_LIST_LAST_BULK_RUN_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved) as LastBulkRunSummary;
      if (typeof parsed?.at !== "number" || typeof parsed?.applied !== "number" || typeof parsed?.candidates !== "number") {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [criticalOnly, setCriticalOnly] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PATIENT_LIST_CRITICAL_ONLY_KEY) === "1";
  });
  const [sortMode, setSortMode] = useState<PatientListSortMode>(() => {
    if (typeof window === "undefined") return "wait";
    const savedSort = window.localStorage.getItem(PATIENT_LIST_SORT_KEY);
    if (savedSort === "acuity" || savedSort === "risk" || savedSort === "wait") {
      return savedSort;
    }
    return "wait";
  });

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PATIENT_LIST_CRITICAL_ONLY_KEY, criticalOnly ? "1" : "0");
  }, [criticalOnly]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PATIENT_LIST_SORT_KEY, sortMode);
  }, [sortMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!lastBulkRun) {
      window.localStorage.removeItem(PATIENT_LIST_LAST_BULK_RUN_KEY);
      return;
    }
    window.localStorage.setItem(PATIENT_LIST_LAST_BULK_RUN_KEY, JSON.stringify(lastBulkRun));
  }, [lastBulkRun]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PATIENT_LIST_WATCHLIST_KEY, JSON.stringify(watchlistEncounterIds));
  }, [watchlistEncounterIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PATIENT_LIST_WATCHLIST_NOTES_KEY, JSON.stringify(watchlistNotesByEncounter));
  }, [watchlistNotesByEncounter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PATIENT_LIST_SHIFT_HEADER_KEY, JSON.stringify(shiftHeader));
  }, [shiftHeader]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PATIENT_LIST_SHIFT_SNAPSHOTS_KEY, JSON.stringify(shiftSnapshots));
  }, [shiftSnapshots]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PATIENT_LIST_SHIFT_DASHBOARD_COLLAPSED_KEY, isShiftDashboardCollapsed ? "1" : "0");
  }, [isShiftDashboardCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PATIENT_LIST_SAVED_VIEWS_COLLAPSED_KEY, isSavedViewsCollapsed ? "1" : "0");
  }, [isSavedViewsCollapsed]);

  useEffect(() => {
    if (!sharedWatchlist || !Array.isArray(sharedWatchlist.entries)) return;

    const ids = sharedWatchlist.entries.map((entry: { encounterId: string }) => entry.encounterId);
    const notes = sharedWatchlist.entries.reduce((acc: Record<string, string>, entry: { encounterId: string; note?: string }) => {
      if (entry.note && entry.note.trim()) {
        acc[entry.encounterId] = entry.note;
      }
      return acc;
    }, {});

    setWatchlistEncounterIds(ids);
    setWatchlistNotesByEncounter(notes);
  }, [sharedWatchlist]);

  const watchlistSet = useMemo(() => new Set(watchlistEncounterIds), [watchlistEncounterIds]);
  const watchlistEncounters = useMemo(
    () => (activeEncounters ?? []).filter((encounter) => watchlistSet.has(String(encounter._id))),
    [activeEncounters, watchlistSet]
  );
  const canAssignOwner = isAdmin || ["NURSE", "CCMA", "UNIT_COORDINATOR"].includes(actorRole);
  const canAssignProvider = isAdmin || ["DOCTOR", "SURGEON", "ANESTHESIOLOGIST", "PHARMACIST", "RESPIRATORY_THERAPIST"].includes(actorRole);
  const canEscalate = isAdmin || ["NURSE", "CCMA", "UNIT_COORDINATOR", "DOCTOR"].includes(actorRole);
  const canBroadcast = isAdmin || ["NURSE", "DOCTOR", "UNIT_COORDINATOR"].includes(actorRole);

  const filteredEncounters = useMemo(
    () => {
      const filtered = (activeEncounters ?? []).filter((encounter) => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;

        if (isDemoMode) {
          const displayName = formatPatientListName(encounter.patientName).toLowerCase();
          const safeStatus = String(encounter.status ?? "").toLowerCase();
          const safeAcuity = `esi ${encounter.acuity}`.toLowerCase();
          return displayName.includes(q) || safeStatus.includes(q) || safeAcuity.includes(q);
        }

        return encounter.patientName.toLowerCase().includes(q) || encounter.mrn.toLowerCase().includes(q);
      });

      const triaged = criticalOnly ? filtered.filter((encounter) => isEncounterCritical(encounter)) : filtered;

      const viewScoped = triaged.filter((encounter) => {
        if (quickView === "critical") return isEncounterCritical(encounter);
        if (quickView === "boarding") return isBoardingEncounter(encounter.status);
        if (quickView === "longWait") {
          const waitMinutes = Math.max(0, Math.floor((currentTime - encounter._creationTime) / 60000));
          return waitMinutes >= 60;
        }
        if (quickView === "watchlist") return watchlistSet.has(String(encounter._id));
        if (quickView === "unassigned") return !encounter.flowOwner?.trim() || !encounter.assignedProvider?.trim();
        if (quickView === "breaches") {
          const stageAgeMinutes = Math.max(0, Math.floor((currentTime - (encounter.flowStageUpdatedAt ?? encounter._creationTime)) / 60000));
          return stageAgeMinutes >= 15;
        }
        return true;
      });

      return [...viewScoped].sort((a, b) => {
        if (sortMode === "acuity") {
          return a.acuity - b.acuity;
        }

        if (sortMode === "risk") {
          const riskA = calculateNEWS2(a.vitals).score;
          const riskB = calculateNEWS2(b.vitals).score;
          return riskB - riskA;
        }

        return a._creationTime - b._creationTime;
      });
    },
    [activeEncounters, searchTerm, criticalOnly, sortMode, currentTime, isDemoMode, quickView, watchlistSet]
  );

  const criticalCount = useMemo(
    () => (activeEncounters ?? []).filter((encounter) => isEncounterCritical(encounter)).length,
    [activeEncounters]
  );

  const queueMetrics = useMemo(() => {
    if (filteredEncounters.length === 0) {
      return {
        longestWaitMinutes: 0,
        averageWaitMinutes: 0,
        highRiskNewsCount: 0,
      };
    }

    let longestWaitMinutes = 0;
    let totalWaitMinutes = 0;
    let highRiskNewsCount = 0;

    for (const encounter of filteredEncounters) {
      const waitMinutes = Math.max(0, Math.floor((currentTime - encounter._creationTime) / 60000));
      longestWaitMinutes = Math.max(longestWaitMinutes, waitMinutes);
      totalWaitMinutes += waitMinutes;
      if (calculateNEWS2(encounter.vitals).score >= 5) {
        highRiskNewsCount += 1;
      }
    }

    return {
      longestWaitMinutes,
      averageWaitMinutes: Math.round(totalWaitMinutes / filteredEncounters.length),
      highRiskNewsCount,
    };
  }, [filteredEncounters, currentTime]);

  const watchlistSuggestions = useMemo(() => {
    return (activeEncounters ?? [])
      .filter((encounter) => !watchlistSet.has(String(encounter._id)))
      .map((encounter) => {
        const waitMinutes = Math.max(0, Math.floor((currentTime - encounter._creationTime) / 60000));
        const newsScore = calculateNEWS2(encounter.vitals).score;
        const critical = isEncounterCritical(encounter);
        const reason = critical
          ? "Critical trigger"
          : newsScore >= 5
            ? "NEWS2 5+"
            : waitMinutes >= 60
              ? "Long wait 60+"
              : encounter.acuity <= 2
                ? "High acuity"
                : "";

        return {
          encounter,
          waitMinutes,
          newsScore,
          score: (critical ? 4 : 0) + (newsScore >= 5 ? 3 : 0) + (waitMinutes >= 60 ? 2 : 0) + (encounter.acuity <= 2 ? 2 : 0),
          reason,
        };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || b.waitMinutes - a.waitMinutes)
      .slice(0, 3);
  }, [activeEncounters, watchlistSet, currentTime]);

  const operationalSummary = useMemo(() => {
    const pinnedWithNotes = watchlistEncounterIds.filter((encounterId) => (watchlistNotesByEncounter[encounterId] ?? "").trim().length > 0).length;
    const unassigned = (activeEncounters ?? []).filter((encounter) => !encounter.flowOwner?.trim() || !encounter.assignedProvider?.trim()).length;
    const stageBreaches = (activeEncounters ?? []).filter((encounter) => {
      const elapsed = Math.max(0, Math.floor((currentTime - (encounter.flowStageUpdatedAt ?? encounter._creationTime)) / 60000));
      return elapsed >= 15;
    }).length;

    return {
      active: activeEncounters?.length ?? 0,
      watchlist: watchlistEncounterIds.length,
      pinnedWithNotes,
      suggestions: watchlistSuggestions.length,
      unassigned,
      stageBreaches,
    };
  }, [activeEncounters, watchlistEncounterIds, watchlistNotesByEncounter, watchlistSuggestions.length, currentTime]);

  const quickViewLabel: Record<PatientListQuickView, string> = {
    all: "All Active",
    critical: "Critical",
    boarding: "Boarding",
    longWait: "Long Wait 60+",
    watchlist: "Watchlist",
    unassigned: "Unassigned",
    breaches: "Breaches",
  };

  const sortLabel: Record<PatientListSortMode, string> = {
    wait: "Longest Wait",
    acuity: "Highest Acuity",
    risk: "Highest Risk",
  };

  const trimmedSearch = searchTerm.trim();

  const exportCurrentViewCsv = () => {
    if (filteredEncounters.length === 0) {
      toast.message("No rows available to export.");
      return;
    }

    const headers = ["patient", "mrn", "esi", "waitMinutes", "news2", "status", "critical"];
    const rows = filteredEncounters.map((encounter) => {
      const waitMinutes = Math.max(0, Math.floor((currentTime - encounter._creationTime) / 60000));
      const news2 = calculateNEWS2(encounter.vitals).score;
      const patient = isDemoMode ? formatPatientListName(encounter.patientName) : encounter.patientName;
      const mrn = isDemoMode ? "masked" : encounter.mrn;
      const critical = isEncounterCritical(encounter) ? "yes" : "no";

      return [patient, mrn, String(encounter.acuity), String(waitMinutes), String(news2), encounter.status, critical];
    });

    const csv = [headers, ...rows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `triage-patient-list-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} row(s).`);
  };

  const runBulkCriticalAssignment = async () => {
    setIsRunningBulkAction(true);
    try {
      const preview = await runSlaEscalationSweep({ actorName, dryRun: true });
      if (preview.candidateCount === 0) {
        setLastBulkRun({ at: Date.now(), applied: 0, candidates: 0 });
        toast.message("No delayed critical candidates found for assignment.");
        return;
      }

      const result = await runSlaEscalationSweep({ actorName, dryRun: false });
      setLastBulkRun({ at: Date.now(), applied: result.appliedCount, candidates: result.candidateCount });
      toast.success(`Assigned ${result.appliedCount} of ${result.candidateCount} delayed encounter(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk assignment failed.");
    } finally {
      setIsRunningBulkAction(false);
    }
  };

  const toggleWatchlist = (encounterId: string) => {
    const nextPinned = !watchlistEncounterIds.includes(encounterId);
    setWatchlistEncounterIds((prev) => {
      if (prev.includes(encounterId)) {
        setWatchlistNotesByEncounter((current) => {
          const next = { ...current };
          delete next[encounterId];
          return next;
        });
        return prev.filter((id) => id !== encounterId);
      }
      return [...prev, encounterId];
    });

    void upsertSharedWatchlist({
      unit: shiftHeader.unit.trim() || "ER-4B",
      encounterId: encounterId as Id<"encounters">,
      pinned: nextPinned,
      note: nextPinned ? watchlistNotesByEncounter[encounterId] : undefined,
    }).catch(() => {
      // Local state remains source of truth if sync fails.
    });
  };

  const updateWatchlistNote = (encounterId: string, note: string) => {
    const trimmed = note.slice(0, 240);
    setWatchlistNotesByEncounter((current) => {
      if (!trimmed.trim()) {
        const next = { ...current };
        delete next[encounterId];
        return next;
      }
      return {
        ...current,
        [encounterId]: trimmed,
      };
    });

    if (watchlistSet.has(encounterId)) {
      void upsertSharedWatchlist({
        unit: shiftHeader.unit.trim() || "ER-4B",
        encounterId: encounterId as Id<"encounters">,
        pinned: true,
        note: trimmed,
      }).catch(() => {
        // Local note remains if sync fails.
      });
    }
  };

  const copyHandoffSnapshot = async () => {
    if (watchlistEncounters.length === 0) {
      toast.message("No watchlist patients to include in snapshot.");
      return;
    }

    const owner = shiftHeader.owner.trim() || actorName;
    const unit = shiftHeader.unit.trim() || "ER-4B";
    const shiftNote = shiftHeader.shiftNote.trim();
    const header = [
      `ER Watchlist Handoff Snapshot`,
      `Timestamp: ${new Date().toLocaleString()}`,
      `Owner: ${isDemoMode ? "masked" : owner}`,
      `Unit: ${unit}`,
      `Shift Note: ${isDemoMode ? "hidden in presentation mode" : shiftNote || "none"}`,
    ].join("\n");
    const body = [...watchlistEncounters]
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((encounter) => {
        const encounterId = String(encounter._id);
        const waitMinutes = Math.max(0, Math.floor((currentTime - encounter._creationTime) / 60000));
        const news2 = calculateNEWS2(encounter.vitals).score;
        const patientName = isDemoMode ? formatPatientListName(encounter.patientName) : encounter.patientName;
        const mrn = isDemoMode ? "masked" : encounter.mrn;
        const note = watchlistNotesByEncounter[encounterId]?.trim();
        const noteText = isDemoMode ? "hidden in presentation mode" : note || "none";

        return `- ${patientName} (MRN: ${mrn}) | ESI ${encounter.acuity} | Wait ${waitMinutes}m | NEWS2 ${news2} | ${encounter.status}\n  Note: ${noteText}`;
      })
      .join("\n");

    const snapshot = `${header}\n\n${body}`;
    try {
      await copyTextToClipboard(snapshot);
      toast.success(`Copied handoff snapshot for ${watchlistEncounters.length} patient(s).`);
    } catch {
      toast.error("Unable to copy handoff snapshot.");
    }
  };

  const sendSnapshotToAiTools = () => {
    if (watchlistEncounters.length === 0) {
      toast.message("No watchlist patients to include in AI handoff.");
      return;
    }

    const owner = shiftHeader.owner.trim() || actorName;
    const unit = shiftHeader.unit.trim() || "ER-4B";
    const header = [
      `ER Watchlist Handoff Snapshot`,
      `Timestamp: ${new Date().toLocaleString()}`,
      `Owner: ${owner}`,
      `Unit: ${unit}`,
    ].join("\n");

    const body = [...watchlistEncounters]
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((encounter) => {
        const encounterId = String(encounter._id);
        const waitMinutes = Math.max(0, Math.floor((currentTime - encounter._creationTime) / 60000));
        const news2 = calculateNEWS2(encounter.vitals).score;
        const note = watchlistNotesByEncounter[encounterId]?.trim() || "none";
        return `- ${encounter.patientName} | ESI ${encounter.acuity} | Wait ${waitMinutes}m | NEWS2 ${news2} | ${encounter.status}\n  Note: ${note}`;
      })
      .join("\n");

    saveAIToolsPrefill({
      version: 1,
      target: "handoff",
      handoffSource: `${header}\n\n${body}`,
    });
    void router.push("/dashboard/ai-tools?tool=handoff");
  };

  const clearShiftContext = () => {
    setShiftHeader({ owner: "", unit: "ER-4B", shiftNote: "" });
    toast.success("Shift context cleared.");
  };

  const toggleShiftDashboardCollapsed = () => {
    setIsShiftDashboardCollapsed((current) => !current);
  };

  const toggleSavedViewsCollapsed = () => {
    setIsSavedViewsCollapsed((current) => !current);
  };

  const resetOperationalView = () => {
    setQuickView("all");
    setCriticalOnly(false);
    setSortMode("wait");
    setSearchTerm("");
    toast.success("Operational view reset.");
  };

  const openShiftDashboardAndSetView = (view: PatientListQuickView) => {
    setIsShiftDashboardCollapsed(false);
    setQuickView(view);
    if (view === "critical") {
      setCriticalOnly(true);
      setSortMode("risk");
    } else if (view === "boarding" || view === "watchlist" || view === "unassigned" || view === "breaches") {
      setCriticalOnly(false);
      setSortMode(view === "breaches" ? "risk" : "wait");
    } else if (view === "longWait") {
      setCriticalOnly(false);
      setSortMode("wait");
    } else {
      setCriticalOnly(false);
      setSortMode("wait");
    }
  };

  const saveShiftSnapshot = () => {
    const snapshot: ShiftSnapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
      owner: shiftHeader.owner,
      unit: shiftHeader.unit,
      shiftNote: shiftHeader.shiftNote,
      watchlistEncounterIds,
      watchlistNotesByEncounter,
    };

    setShiftSnapshots((prev) => [snapshot, ...prev].slice(0, 12));
    toast.success("Shift snapshot archived.");
  };

  const reopenShiftSnapshot = (snapshotId: string) => {
    const snapshot = shiftSnapshots.find((item) => item.id === snapshotId);
    if (!snapshot) return;

    setShiftHeader({
      owner: snapshot.owner,
      unit: snapshot.unit || "ER-4B",
      shiftNote: snapshot.shiftNote,
    });
    setWatchlistEncounterIds(snapshot.watchlistEncounterIds);
    setWatchlistNotesByEncounter(snapshot.watchlistNotesByEncounter);
    toast.success("Shift snapshot restored.");
  };

  const sendSnapshotToShiftReport = async () => {
    if (!canBroadcast) {
      toast.error("Your role cannot broadcast shift reports.");
      return;
    }

    if (watchlistEncounters.length === 0) {
      toast.message("No watchlist patients to broadcast.");
      return;
    }

    const owner = shiftHeader.owner.trim() || actorName;
    const summary = `Shift ${shiftHeader.unit || "ER-4B"} • Owner ${owner} • Watchlist ${watchlistEncounters.length} patient(s)`;

    try {
      await routeRoleNotification({
        role: "UNIT_COORDINATOR",
        message: summary,
        suppressionWindowMinutes: 5,
      });
      toast.success("Snapshot broadcast to shift report queue.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to broadcast snapshot.");
    }
  };

  const applyQuickAction = async (
    encounterId: string,
    action: "assignOwner" | "assignProvider" | "escalate"
  ) => {
    try {
      if (action === "assignOwner") {
        if (!canAssignOwner) {
          toast.error("Your role cannot assign flow owners.");
          return;
        }
        await updateEncounterFlow({ encounterId: encounterId as Id<"encounters">, flowOwner: actorName });
        toast.success("Flow owner assigned.");
        return;
      }

      if (action === "assignProvider") {
        if (!canAssignProvider) {
          toast.error("Your role cannot assign providers.");
          return;
        }
        await updateEncounterFlow({ encounterId: encounterId as Id<"encounters">, assignedProvider: actorName });
        toast.success("Provider assigned.");
        return;
      }

      if (!canEscalate) {
        toast.error("Your role cannot send escalations.");
        return;
      }

      await routeRoleNotification({
        role: "DOCTOR",
        message: `Escalation requested for encounter ${encounterId}`,
        suppressionWindowMinutes: 10,
      });
      toast.success("Escalation sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Quick action failed.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50/50 p-4 pt-24 text-slate-900 dark:bg-slate-950/30 dark:text-slate-100 md:p-10 md:pt-28">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Triage</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Patient List</h1>
            {isDemoMode && (
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">
                Presentation Mode Active: Identifiers Masked
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TriageTabs activeTab="patients" />
            <button
              type="button"
              onClick={toggleDemoMode}
              className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                isDemoMode
                  ? "border-blue-300 bg-blue-600 text-white dark:border-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {isDemoMode ? "Presentation: ON" : "Presentation: OFF"}
            </button>
            <Badge className="bg-slate-900 text-white">
              <Rows3 className="mr-1 h-3 w-3" /> {filteredEncounters.length} Active
            </Badge>
          </div>
        </div>

        <Card className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="space-y-3 border-b border-slate-200 bg-slate-50/70 pb-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/90 p-2 dark:border-slate-700 dark:bg-slate-900/70">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Shift Dashboard</span>
                <Badge className="border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {isShiftDashboardCollapsed ? "Collapsed" : "Expanded"}
                </Badge>
              </div>
              <button
                type="button"
                onClick={toggleShiftDashboardCollapsed}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {isShiftDashboardCollapsed ? "Show Shift Dashboard" : "Hide Shift Dashboard"}
              </button>
            </div>
            {isShiftDashboardCollapsed && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                <ShortcutMetricButton label={`Active ${operationalSummary.active}`} tooltip="Open All Active view" onClick={() => openShiftDashboardAndSetView("all")} tone="neutral" />
                <ShortcutMetricButton label={`Watchlist ${operationalSummary.watchlist}`} tooltip="Open Watchlist view" onClick={() => openShiftDashboardAndSetView("watchlist")} tone="blue" />
                <ShortcutMetricButton label={`Unassigned ${operationalSummary.unassigned}`} tooltip="Open Unassigned view" onClick={() => openShiftDashboardAndSetView("unassigned")} tone="amber" />
                <ShortcutMetricButton label={`Breaches ${operationalSummary.stageBreaches}`} tooltip="Open Breaches view" onClick={() => openShiftDashboardAndSetView("breaches")} tone="rose" />
              </div>
            )}
            {!isShiftDashboardCollapsed && (
              <>
                <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white/90 p-2 md:grid-cols-3 dark:border-slate-700 dark:bg-slate-900/70">
                  <input
                    value={isDemoMode ? "Hidden in Presentation Mode" : shiftHeader.owner}
                    onChange={(event) => setShiftHeader((current) => ({ ...current, owner: event.target.value.slice(0, 60) }))}
                    readOnly={isDemoMode}
                    placeholder="Shift Owner"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                  <input
                    value={shiftHeader.unit}
                    onChange={(event) => setShiftHeader((current) => ({ ...current, unit: event.target.value.slice(0, 30) }))}
                    placeholder="Unit"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                  <input
                    value={isDemoMode ? "Hidden in Presentation Mode" : shiftHeader.shiftNote}
                    onChange={(event) => setShiftHeader((current) => ({ ...current, shiftNote: event.target.value.slice(0, 120) }))}
                    readOnly={isDemoMode}
                    placeholder="Shift Note"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={saveShiftSnapshot}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Archive Shift
                  </button>
                  <select
                    value=""
                    onChange={(event) => {
                      if (!event.target.value) return;
                      reopenShiftSnapshot(event.target.value);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <option value="">Reopen Archived Shift</option>
                    {shiftSnapshots.map((snapshot) => (
                      <option key={snapshot.id} value={snapshot.id}>
                        {new Date(snapshot.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {snapshot.unit || "ER-4B"} · {snapshot.watchlistEncounterIds.length} pinned
                      </option>
                    ))}
                  </select>
                  {watchlistSuggestions.length > 0 && (
                    <Badge className="border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                      Suggestions: {watchlistSuggestions.length}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={resetOperationalView}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Reset To Shift Start
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
                  <StatBadge label="Active" value={operationalSummary.active} />
                  <StatBadge label="Watchlist" value={operationalSummary.watchlist} />
                  <StatBadge label="Pinned+Notes" value={operationalSummary.pinnedWithNotes} />
                  <StatBadge label="Suggestions" value={operationalSummary.suggestions} />
                  <StatBadge label="Unassigned" value={operationalSummary.unassigned} />
                  <StatBadge label="15m+ Breaches" value={operationalSummary.stageBreaches} tone="warning" />
                </div>
              </>
            )}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-200">
                <Activity className="h-4 w-4 text-blue-600" /> Active Triage Queue
              </CardTitle>

              <div className="flex flex-wrap items-center gap-2">
                {isAdmin ? (
                  <Badge className="border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    Admin Mode: Full Access
                  </Badge>
                ) : (
                  <Badge className="border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    Role Access: {actorRole}
                  </Badge>
                )}
                <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                  {criticalCount} Critical
                </Badge>
                <button
                  type="button"
                  onClick={runBulkCriticalAssignment}
                  disabled={isRunningBulkAction}
                  className="rounded-xl border border-blue-200 bg-blue-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-700"
                >
                  {isRunningBulkAction ? "Assigning..." : "Auto-Assign Delayed Critical"}
                </button>
                {lastBulkRun && (
                  <Badge className="border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                    Last Bulk: {new Date(lastBulkRun.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {lastBulkRun.applied}/{lastBulkRun.candidates}
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={() => setCriticalOnly((prev) => !prev)}
                  className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                    criticalOnly
                      ? "border-red-300 bg-red-600 text-white dark:border-red-800 dark:bg-red-600"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {criticalOnly ? "Critical Only" : "All Patients"}
                </button>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Sort
                </label>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as PatientListSortMode)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <option value="wait">Longest Wait</option>
                  <option value="acuity">Highest Acuity</option>
                  <option value="risk">Highest Risk</option>
                </select>
                <button
                  type="button"
                  onClick={exportCurrentViewCsv}
                  disabled={filteredEncounters.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export View
                </button>
                <button
                  type="button"
                  onClick={copyHandoffSnapshot}
                  disabled={watchlistEncounters.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Handoff Snapshot
                </button>
                <button
                  type="button"
                  onClick={sendSnapshotToAiTools}
                  disabled={watchlistEncounters.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-700 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-900/50"
                >
                  Send Snapshot To AI Tools
                </button>
                <button
                  type="button"
                  onClick={sendSnapshotToShiftReport}
                  disabled={watchlistEncounters.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50"
                >
                  Send To Shift Report
                </button>
                <button
                  type="button"
                  onClick={clearShiftContext}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Clear Shift Context
                </button>
              </div>
            </div>
            {watchlistSuggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300">
                <span>Smart Suggestions</span>
                {watchlistSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.encounter._id}
                    type="button"
                    onClick={() => toggleWatchlist(String(suggestion.encounter._id))}
                    className="rounded-lg border border-violet-300 bg-white px-2 py-1 transition-colors hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/40 dark:hover:bg-violet-900/70"
                  >
                    Pin {isDemoMode ? formatPatientListName(suggestion.encounter.patientName) : suggestion.encounter.patientName} ({suggestion.reason})
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Saved Views</span>
              <Badge className="border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {isSavedViewsCollapsed ? "Collapsed" : "Expanded"}
              </Badge>
              <button
                type="button"
                onClick={toggleSavedViewsCollapsed}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {isSavedViewsCollapsed ? "Show Views" : "Hide Views"}
              </button>
            </div>
            {!isSavedViewsCollapsed && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openShiftDashboardAndSetView("all")}
                  className={quickViewButtonClasses(quickView, "all")}
                >
                  All Active
                </button>
                <button
                  type="button"
                  onClick={() => openShiftDashboardAndSetView("critical")}
                  className={quickViewButtonClasses(quickView, "critical")}
                >
                  Critical
                </button>
                <button
                  type="button"
                  onClick={() => openShiftDashboardAndSetView("boarding")}
                  className={quickViewButtonClasses(quickView, "boarding")}
                >
                  Boarding
                </button>
                <button
                  type="button"
                  onClick={() => openShiftDashboardAndSetView("longWait")}
                  className={quickViewButtonClasses(quickView, "longWait")}
                >
                  Long Wait 60+
                </button>
                <button
                  type="button"
                  onClick={() => openShiftDashboardAndSetView("watchlist")}
                  className={quickViewButtonClasses(quickView, "watchlist")}
                >
                  Watchlist ({watchlistEncounterIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => openShiftDashboardAndSetView("unassigned")}
                  className={quickViewButtonClasses(quickView, "unassigned")}
                >
                  Unassigned
                </button>
                <button
                  type="button"
                  onClick={() => openShiftDashboardAndSetView("breaches")}
                  className={quickViewButtonClasses(quickView, "breaches")}
                >
                  Breaches
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
              <Badge className="border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                Longest Wait: {queueMetrics.longestWaitMinutes}m
              </Badge>
              <Badge className="border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                Avg Wait: {queueMetrics.averageWaitMinutes}m
              </Badge>
              <Badge className="border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                NEWS2 5+: {queueMetrics.highRiskNewsCount}
              </Badge>
              <Badge className="border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                Watchlist: {watchlistEncounterIds.length}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
              <SummaryActionChip onClick={() => setQuickView("all")} tooltip="Reset to All Active view">
                View: {quickViewLabel[quickView]}
              </SummaryActionChip>
              <SummaryActionChip onClick={() => setCriticalOnly((prev) => !prev)} tooltip="Toggle critical-only filter">
                Critical-only: {criticalOnly ? "On" : "Off"}
              </SummaryActionChip>
              <SummaryActionChip onClick={() => setSortMode("wait")} tooltip="Reset sorting to Longest Wait">
                Sort: {sortLabel[sortMode]}
              </SummaryActionChip>
              <SummaryActionChip onClick={() => setSearchTerm("")} tooltip="Clear search" disabled={!trimmedSearch}>
                Search: {trimmedSearch ? `\"${trimmedSearch}\"` : "None"}
              </SummaryActionChip>
              <SummaryActionChip
                onClick={() => {
                  setQuickView("all");
                  setCriticalOnly(false);
                  setSortMode("wait");
                  setSearchTerm("");
                }}
                tooltip="Reset all filters and controls"
              >
                Rows: {filteredEncounters.length}
              </SummaryActionChip>
            </div>
            <GlobalSearch
              onQueryChange={setSearchTerm}
              placeholder={isDemoMode ? "Search by display alias, status, or ESI..." : "Search by patient name or MRN..."}
              className="max-w-none mx-0 md:w-2/3 lg:w-1/2"
            />
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader className="border-b bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24 text-center text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">ESI</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Patient Details</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Wait</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Live Vitals</TableHead>
                  <TableHead className="w-28 text-center text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Risk</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Clinical Phase</TableHead>
                  <TableHead className="pr-8 text-right text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEncounters.map((encounter) => {
                  const waitTime = Math.floor((currentTime - encounter._creationTime) / 60000);
                  const news2 = calculateNEWS2(encounter.vitals);
                  const isCriticalVitals = (encounter.vitals.spO2 < 92 && encounter.vitals.spO2 > 0) || encounter.vitals.hr > 120;
                  const isHighRisk = isHighRiskComplaint(encounter.chiefComplaint ?? "");
                  const patientDisplayName = isDemoMode ? formatPatientListName(encounter.patientName) : encounter.patientName;
                  const patientDisplayMrn = isDemoMode ? "• • • • •" : encounter.mrn;
                  const inWatchlist = watchlistSet.has(String(encounter._id));
                  const handoffNote = watchlistNotesByEncounter[String(encounter._id)] ?? "";
                  const stageAgeMinutes = Math.max(0, Math.floor((currentTime - (encounter.flowStageUpdatedAt ?? encounter._creationTime)) / 60000));
                  const sla15 = getSlaCountdown(stageAgeMinutes, 15);
                  const sla30 = getSlaCountdown(stageAgeMinutes, 30);

                  return (
                    <TableRow
                      key={encounter._id}
                      className={`${isCriticalVitals || isHighRisk ? "bg-red-50/40 dark:bg-red-950/20" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"}`}
                    >
                      <TableCell className="text-center">
                        <div
                          className={`mx-auto flex h-12 w-12 flex-col items-center justify-center rounded-2xl shadow-sm ${
                            encounter.acuity === 1
                              ? "animate-pulse bg-red-600 text-white"
                              : encounter.acuity === 2
                                ? "bg-orange-500 text-white"
                                : "bg-yellow-400 text-slate-900"
                          }`}
                        >
                          <span className="text-[10px] font-black leading-none uppercase">ESI</span>
                          <span className="text-xl font-black">{encounter.acuity}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-black text-slate-900 dark:text-slate-100">{patientDisplayName}</div>
                        <div className="text-[10px] font-mono text-slate-400">MRN: {patientDisplayMrn}</div>
                        {inWatchlist && quickView === "watchlist" && (
                          <div className="mt-2 space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                              Handoff Note
                            </label>
                            <textarea
                              value={isDemoMode ? "Hidden in Presentation Mode" : handoffNote}
                              onChange={(event) => updateWatchlistNote(String(encounter._id), event.target.value)}
                              readOnly={isDemoMode}
                              placeholder="Add quick handoff context for this pinned patient..."
                              className="min-h-15.5 w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700 outline-none transition-colors focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              maxLength={240}
                            />
                            {!isDemoMode && (
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                {handoffNote.length}/240
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 text-xs font-black ${waitTime > 60 ? "text-red-600" : "text-slate-600 dark:text-slate-300"}`}>
                          <Clock className="h-3.5 w-3.5" /> {waitTime}m
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge className={`border px-1.5 py-0 text-[9px] font-black ${sla15.breached ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>
                            SLA15 {sla15.label}
                          </Badge>
                          <Badge className={`border px-1.5 py-0 text-[9px] font-black ${sla30.breached ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>
                            SLA30 {sla30.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          <VitalLabel label="HR" value={encounter.vitals.hr} alert={encounter.vitals.hr > 110} />
                          <VitalLabel label="BP" value={encounter.vitals.bp || "---/--"} />
                          <VitalLabel label="O2" value={encounter.vitals.spO2} alert={encounter.vitals.spO2 < 93} suffix="%" />
                          <VitalLabel label="T" value={encounter.vitals.temp} alert={encounter.vitals.temp > 100.4} suffix="°" />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="mx-auto inline-flex min-w-16 flex-col items-center rounded-xl border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">NEWS2</span>
                          <span className={`text-lg font-black ${news2.color}`}>{news2.score}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          {encounter.status}
                        </span>
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => toggleWatchlist(String(encounter._id))}
                            className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                              inWatchlist
                                ? "border-blue-700 bg-blue-700 text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            }`}
                          >
                            <Star className={`h-3.5 w-3.5 ${inWatchlist ? "fill-white" : ""}`} />
                            {inWatchlist ? "Pinned" : "Pin"}
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuickAction(String(encounter._id), "assignOwner")}
                            disabled={!canAssignOwner}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Assign Owner
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuickAction(String(encounter._id), "assignProvider")}
                            disabled={!canAssignProvider}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Assign Provider
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuickAction(String(encounter._id), "escalate")}
                            disabled={!canEscalate}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
                          >
                            Escalate
                          </button>
                          {inWatchlist && handoffNote.trim().length > 0 && (
                            <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                              Note Saved
                            </Badge>
                          )}
                          <Link href={`/patient/${encounter.patientId}`}>
                            <button className="inline-flex items-center gap-2 rounded-[1.5rem] bg-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-blue-600 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-blue-500 dark:hover:text-white">
                              Enter Chart <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function SummaryActionChip({
  children,
  onClick,
  tooltip,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  tooltip: string;
  disabled?: boolean;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={tooltip}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        {children}
      </button>
      <div className="pointer-events-none absolute left-1/2 top-0 z-20 hidden -translate-x-1/2 -translate-y-[115%] whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold normal-case tracking-normal text-slate-700 shadow-sm group-hover:block group-focus-within:block dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        {tooltip}
      </div>
    </div>
  );
}

function StatBadge({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warning";
}) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${tone === "warning" ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}>
      <div className={`text-lg font-black ${tone === "warning" ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-slate-100"}`}>{value}</div>
      <div className={`text-[9px] font-black uppercase tracking-widest ${tone === "warning" ? "text-amber-700/80 dark:text-amber-300/80" : "text-slate-500 dark:text-slate-400"}`}>{label}</div>
    </div>
  );
}

function quickViewButtonClasses(activeView: PatientListQuickView, buttonView: PatientListQuickView) {
  const base = "rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors";
  const isActive = activeView === buttonView;

  if (buttonView === "all") {
    return `${base} ${isActive ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"}`;
  }

  if (buttonView === "critical") {
    return `${base} ${isActive ? "border-red-600 bg-red-600 text-white" : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50"}`;
  }

  if (buttonView === "boarding") {
    return `${base} ${isActive ? "border-indigo-600 bg-indigo-600 text-white" : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50"}`;
  }

  if (buttonView === "longWait") {
    return `${base} ${isActive ? "border-amber-600 bg-amber-500 text-white" : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50"}`;
  }

  if (buttonView === "watchlist") {
    return `${base} ${isActive ? "border-blue-700 bg-blue-700 text-white" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50"}`;
  }

  if (buttonView === "unassigned") {
    return `${base} ${isActive ? "border-amber-700 bg-amber-600 text-white" : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50"}`;
  }

  return `${base} ${isActive ? "border-rose-700 bg-rose-600 text-white" : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"}`;
}

function ShortcutMetricButton({
  label,
  tooltip,
  onClick,
  tone = "neutral",
}: {
  label: string;
  tooltip: string;
  onClick: () => void;
  tone?: "neutral" | "blue" | "amber" | "rose";
}) {
  const toneClasses: Record<typeof tone, string> = {
    neutral: "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
    blue: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50",
    amber: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50",
    rose: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50",
  };

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        title={tooltip}
        className={`rounded-lg border px-2 py-1 transition-colors ${toneClasses[tone]}`}
      >
        {label}
      </button>
      <div className="pointer-events-none absolute left-1/2 top-0 z-20 hidden -translate-x-1/2 -translate-y-[115%] whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold normal-case tracking-normal text-slate-700 shadow-sm group-hover:block group-focus-within:block dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        {tooltip}
      </div>
    </div>
  );
}

function VitalLabel({
  label,
  value,
  alert,
  suffix = "",
}: {
  label: string;
  value: string | number;
  alert?: boolean;
  suffix?: string;
}) {
  if (!value) {
    return <span className="text-[10px] font-bold uppercase text-slate-300 dark:text-slate-600">{label}: --</span>;
  }

  return (
    <div className={`text-[10px] font-bold uppercase ${alert ? "font-black text-red-600" : "text-slate-600 dark:text-slate-300"}`}>
      {label}: {value}
      {suffix}
    </div>
  );
}

const isHighRiskComplaint = (complaint: string): boolean => {
  const highRiskKeywords = [
    "chest pain", "cardiac", "heart attack", "stroke", "cva", "difficulty breathing", "respiratory distress",
    "severe abdominal pain", "uncontrolled bleeding", "shock", "sepsis", "anaphylaxis", "overdose", "trauma",
  ];
  const lowerComplaint = complaint.toLowerCase();
  return highRiskKeywords.some((keyword) => lowerComplaint.includes(keyword));
};

const isEncounterCritical = (encounter: { vitals: { spO2: number; hr: number }; chiefComplaint?: string }) => {
  const isCriticalVitals = (encounter.vitals.spO2 < 92 && encounter.vitals.spO2 > 0) || encounter.vitals.hr > 120;
  const isHighRisk = isHighRiskComplaint(encounter.chiefComplaint ?? "");
  return isCriticalVitals || isHighRisk;
};

const isBoardingEncounter = (status: string) => {
  const normalized = status.toLowerCase();
  return normalized.includes("board") || normalized.includes("admit") || normalized.includes("hold");
};

const formatPatientListName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}. ${parts[1]}`;
  }
  const first = name.charAt(0) || "P";
  return `Patient-${first.toUpperCase()}${name.length}`;
};

const getSlaCountdown = (elapsedMinutes: number, thresholdMinutes: number) => {
  const remaining = thresholdMinutes - elapsedMinutes;
  if (remaining <= 0) {
    return {
      breached: true,
      label: `+${Math.abs(remaining)}m`,
    };
  }

  return {
    breached: false,
    label: `${remaining}m`,
  };
};

async function copyTextToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is not available");
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "absolute";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!copied) {
    throw new Error("Clipboard copy failed");
  }
}
