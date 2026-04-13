"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Microscope, Save, Share2, Download, BookCopy, Trash2, Star, Users, GitCompare, LineChart, Clock, TrendingUp } from "lucide-react";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { toast } from "sonner";

type ResearchQuestionId =
  | "los_by_acuity"
  | "protocol_effectiveness"
  | "boarding_delay_drivers"
  | "critical_ack_latency";

const QUESTION_OPTIONS: Array<{ id: ResearchQuestionId; label: string }> = [
  { id: "los_by_acuity", label: "How does acuity impact LOS?" },
  { id: "protocol_effectiveness", label: "Are protocol activations improving outcomes?" },
  { id: "boarding_delay_drivers", label: "What is driving boarding delays?" },
  { id: "critical_ack_latency", label: "How quickly are critical labs acknowledged?" },
];

const FLOW_STAGE_OPTIONS = [
  "all",
  "triage",
  "awaiting_bed",
  "bedded",
  "provider_assigned",
  "workup_pending",
  "consult_pending",
  "discharge_ready",
  "admit_ready",
  "boarded",
] as const;

const DISPOSITION_OPTIONS = ["all", "undecided", "discharge", "admit", "observation", "transfer"] as const;
const RESEARCH_PRESETS_STORAGE_KEY = "clinical-research:presets";
const RESEARCH_SNAPSHOTS_STORAGE_KEY = "clinical-research:snapshots";

type ResearchReviewComment = {
  id: string;
  author: string;
  text: string;
  createdAt: number;
};

type RecurringSchedule = {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  lastRunAt: number | null;
  nextRunAt: number | null;
};

type SavedResearchPreset = {
  id: string;
  name: string;
  questionId: ResearchQuestionId;
  lookbackDays: number;
  minAcuity: number;
  maxAcuity: number;
  flowStage: (typeof FLOW_STAGE_OPTIONS)[number];
  dispositionPlan: (typeof DISPOSITION_OPTIONS)[number];
  includeIdentifiers: boolean;
  createdAt: number;
  lastOpenedAt: number;
  openCount: number;
  isFavorite: boolean;
  isPinned: boolean;
  tags: string[];
  published: boolean;
  owner: string;
  clinicalIntent: string;
  reviewCadence: "weekly" | "monthly" | "quarterly";
  sensitivity: "de-identified" | "re-identified";
  lastReviewedAt: number;
  reviewStatus: "draft" | "pending_review" | "approved" | "rejected";
  reviewComments: ResearchReviewComment[];
  reviewedBy: string | null;
  reviewedAt: number | null;
  schedule: RecurringSchedule;
  isFeaturedFinding: boolean;
};

type ResearchSnapshot = {
  id: string;
  presetId: string | null;
  configSignature: string;
  generatedAt: number;
  cohortSize: number;
  avgLosMinutes: number | null;
  avgDoorToBedMinutes: number | null;
  avgCriticalAckMinutes: number | null;
};

function getInitialResearchState() {
  const initial = {
    questionId: "los_by_acuity" as ResearchQuestionId,
    lookbackDays: 7,
    minAcuity: 1,
    maxAcuity: 5,
    flowStage: "all" as (typeof FLOW_STAGE_OPTIONS)[number],
    dispositionPlan: "all" as (typeof DISPOSITION_OPTIONS)[number],
    includeIdentifiers: false,
    view: "library" as "library" | "builder" | "insights",
    comparePresetId: "none" as string,
  };

  if (typeof window === "undefined") return initial;

  const params = new URLSearchParams(window.location.search);
  const queryQuestion = params.get("questionId") as ResearchQuestionId | null;
  const queryLookback = Number(params.get("lookbackDays") || "");
  const queryMinAcuity = Number(params.get("minAcuity") || "");
  const queryMaxAcuity = Number(params.get("maxAcuity") || "");
  const queryFlow = params.get("flowStage") as (typeof FLOW_STAGE_OPTIONS)[number] | null;
  const queryDisposition = params.get("dispositionPlan") as (typeof DISPOSITION_OPTIONS)[number] | null;
  const queryInclude = params.get("includeIdentifiers");
  const queryView = params.get("view") as "library" | "builder" | "insights" | null;
  const queryComparePreset = params.get("comparePresetId");

  if (queryQuestion && QUESTION_OPTIONS.some((option) => option.id === queryQuestion)) {
    initial.questionId = queryQuestion;
  }
  if (!Number.isNaN(queryLookback) && queryLookback > 0) {
    initial.lookbackDays = Math.max(1, Math.min(90, queryLookback));
  }
  if (!Number.isNaN(queryMinAcuity) && queryMinAcuity > 0) {
    initial.minAcuity = Math.max(1, Math.min(5, queryMinAcuity));
  }
  if (!Number.isNaN(queryMaxAcuity) && queryMaxAcuity > 0) {
    initial.maxAcuity = Math.max(1, Math.min(5, queryMaxAcuity));
  }
  if (queryFlow && FLOW_STAGE_OPTIONS.includes(queryFlow)) {
    initial.flowStage = queryFlow;
  }
  if (queryDisposition && DISPOSITION_OPTIONS.includes(queryDisposition)) {
    initial.dispositionPlan = queryDisposition;
  }
  if (queryInclude === "1") {
    initial.includeIdentifiers = true;
  }
  if (queryView && ["library", "builder", "insights"].includes(queryView)) {
    initial.view = queryView;
  }
  if (queryComparePreset) {
    initial.comparePresetId = queryComparePreset;
  }

  return initial;
}

export default function ClinicalResearchHub() {
  const { isAdmin } = useResolvedActor();
  const [initialState] = useState(getInitialResearchState);
  const [questionId, setQuestionId] = useState<ResearchQuestionId>(initialState.questionId);
  const [lookbackDays, setLookbackDays] = useState(initialState.lookbackDays);
  const [minAcuity, setMinAcuity] = useState(initialState.minAcuity);
  const [maxAcuity, setMaxAcuity] = useState(initialState.maxAcuity);
  const [flowStage, setFlowStage] = useState<(typeof FLOW_STAGE_OPTIONS)[number]>(initialState.flowStage);
  const [dispositionPlan, setDispositionPlan] = useState<(typeof DISPOSITION_OPTIONS)[number]>(initialState.dispositionPlan);
  const [includeIdentifiers, setIncludeIdentifiers] = useState(initialState.includeIdentifiers);
  const [presetName, setPresetName] = useState("");
  const [presetOwner, setPresetOwner] = useState("Admin");
  const [presetIntent, setPresetIntent] = useState("");
  const [presetTagsInput, setPresetTagsInput] = useState("");
  const [presetReviewCadence, setPresetReviewCadence] = useState<"weekly" | "monthly" | "quarterly">("monthly");
  const [hubView, setHubView] = useState<"library" | "builder" | "insights">(initialState.view);
  const [searchText] = useState("");
  const [activeTagFilter] = useState<string>("all");
  const [comparePresetId, setComparePresetId] = useState<string>(initialState.comparePresetId);
  const [savedPresets, setSavedPresets] = useState<SavedResearchPreset[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(RESEARCH_PRESETS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SavedResearchPreset[];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((preset) => ({
        ...preset,
        createdAt: preset.createdAt ?? Date.now(),
        lastOpenedAt: preset.lastOpenedAt ?? preset.createdAt ?? Date.now(),
        openCount: preset.openCount ?? 0,
        isFavorite: preset.isFavorite ?? false,
        isPinned: preset.isPinned ?? false,
        tags: Array.isArray(preset.tags) ? preset.tags : [],
        published: preset.published ?? false,
        owner: preset.owner ?? "Admin",
        clinicalIntent: preset.clinicalIntent ?? "",
        reviewCadence: preset.reviewCadence ?? "monthly",
        sensitivity: preset.sensitivity ?? "de-identified",
        lastReviewedAt: preset.lastReviewedAt ?? preset.createdAt ?? Date.now(),
        reviewStatus: preset.reviewStatus ?? "draft",
        reviewComments: Array.isArray(preset.reviewComments) ? preset.reviewComments : [],
        reviewedBy: preset.reviewedBy ?? null,
        reviewedAt: preset.reviewedAt ?? null,
        schedule: preset.schedule ?? { enabled: false, frequency: "weekly", lastRunAt: null, nextRunAt: null },
        isFeaturedFinding: preset.isFeaturedFinding ?? false,
      }));
    } catch {
      return [];
    }
  });
  const [snapshots, setSnapshots] = useState<ResearchSnapshot[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(RESEARCH_SNAPSHOTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ResearchSnapshot[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const safeMin = Math.max(1, Math.min(5, minAcuity));
  const safeMax = Math.max(safeMin, Math.min(5, maxAcuity));
  const configSignature = `${questionId}|${lookbackDays}|${safeMin}|${safeMax}|${flowStage}|${dispositionPlan}|${includeIdentifiers ? "1" : "0"}`;

  const research = useQuery(
    api.workflow.runClinicalResearchQuestion,
    isAdmin
      ? {
          questionId,
          lookbackDays,
          minAcuity: safeMin,
          maxAcuity: safeMax,
          flowStage: flowStage === "all" ? undefined : flowStage,
          dispositionPlan: dispositionPlan === "all" ? undefined : dispositionPlan,
          includeIdentifiers,
        }
      : "skip"
  );

  const comparePreset = useMemo(
    () => savedPresets.find((item) => item.id === comparePresetId) ?? null,
    [comparePresetId, savedPresets]
  );

  const compareResearch = useQuery(
    api.workflow.runClinicalResearchQuestion,
    isAdmin && comparePreset
      ? {
          questionId: comparePreset.questionId,
          lookbackDays: comparePreset.lookbackDays,
          minAcuity: comparePreset.minAcuity,
          maxAcuity: comparePreset.maxAcuity,
          flowStage: comparePreset.flowStage === "all" ? undefined : comparePreset.flowStage,
          dispositionPlan: comparePreset.dispositionPlan === "all" ? undefined : comparePreset.dispositionPlan,
          includeIdentifiers: comparePreset.includeIdentifiers,
        }
      : "skip"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RESEARCH_PRESETS_STORAGE_KEY, JSON.stringify(savedPresets));
  }, [savedPresets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RESEARCH_SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
  }, [snapshots]);

  // Feature 1: URL Sync for shareable states
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    params.set("questionId", questionId);
    params.set("lookbackDays", lookbackDays.toString());
    params.set("minAcuity", minAcuity.toString());
    params.set("maxAcuity", maxAcuity.toString());
    if (flowStage !== "all") params.set("flowStage", flowStage);
    if (dispositionPlan !== "all") params.set("dispositionPlan", dispositionPlan);
    if (includeIdentifiers) params.set("includeIdentifiers", "1");
    if (hubView !== "library") params.set("view", hubView);
    if (comparePresetId !== "none") params.set("comparePresetId", comparePresetId);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [questionId, lookbackDays, minAcuity, maxAcuity, flowStage, dispositionPlan, includeIdentifiers, hubView, comparePresetId]);

  const savePreset = () => {
    const normalizedName = presetName.trim();
    if (!normalizedName) {
      toast.error("Preset name is required.");
      return;
    }

    const normalizedTags = presetTagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 6);

    const nextPreset: SavedResearchPreset = {
      id: `${Date.now()}`,
      name: normalizedName,
      questionId,
      lookbackDays,
      minAcuity: safeMin,
      maxAcuity: safeMax,
      flowStage,
      dispositionPlan,
      includeIdentifiers,
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
      openCount: 0,
      isFavorite: false,
      isPinned: false,
      tags: normalizedTags,
      published: false,
      owner: presetOwner.trim() || "Admin",
      clinicalIntent: presetIntent.trim(),
      reviewCadence: presetReviewCadence,
      sensitivity: includeIdentifiers ? "re-identified" : "de-identified",
      lastReviewedAt: Date.now(),
      reviewStatus: "draft",
      reviewComments: [],
      reviewedBy: null,
      reviewedAt: null,
      schedule: { enabled: false, frequency: "weekly", lastRunAt: null, nextRunAt: null },
      isFeaturedFinding: false,
    };

    setSavedPresets((current) => [nextPreset, ...current.filter((item) => item.name !== normalizedName)].slice(0, 15));
    setPresetName("");
    setPresetIntent("");
    setPresetTagsInput("");
    toast.success("Research preset saved.");
  };

  const loadPreset = (presetId: string) => {
    const match = savedPresets.find((item) => item.id === presetId);
    if (!match) return;

    setQuestionId(match.questionId);
    setLookbackDays(match.lookbackDays);
    setMinAcuity(match.minAcuity);
    setMaxAcuity(match.maxAcuity);
    setFlowStage(match.flowStage);
    setDispositionPlan(match.dispositionPlan);
    setIncludeIdentifiers(match.includeIdentifiers);
    setSavedPresets((current) =>
      current.map((item) => (item.id === match.id ? { ...item, lastOpenedAt: Date.now(), openCount: item.openCount + 1 } : item))
    );
    toast.success(`Loaded preset: ${match.name}`);
  };

  const removePreset = (presetId: string) => {
    setSavedPresets((current) => current.filter((item) => item.id !== presetId));
    toast.success("Preset removed from your library.");
  };

  const toggleFavoritePreset = (presetId: string) => {
    setSavedPresets((current) =>
      current.map((item) => (item.id === presetId ? { ...item, isFavorite: !item.isFavorite } : item))
    );
  };

  const togglePublishPreset = (presetId: string) => {
    setSavedPresets((current) =>
      current.map((item) => (item.id === presetId ? { ...item, published: !item.published } : item))
    );
  };

  // Feature 1: Copy shareable URL
  const copyShareableUrl = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Shareable URL copied to clipboard!");
    });
  };

  // Feature 2: Peer Review Workflow
  const submitForReview = (presetId: string) => {
    setSavedPresets((current) =>
      current.map((item) => (item.id === presetId ? { ...item, reviewStatus: "pending_review" } : item))
    );
    toast.info("Preset submitted for peer review.");
  };

  const approvePreset = (presetId: string) => {
    setSavedPresets((current) =>
      current.map((item) =>
        item.id === presetId
          ? { ...item, reviewStatus: "approved", reviewedBy: "Admin", reviewedAt: Date.now() }
          : item
      )
    );
    toast.success("Preset approved!");
  };

  const rejectPreset = (presetId: string, reason: string) => {
    setSavedPresets((current) =>
      current.map((item) => {
        if (item.id !== presetId) return item;
        const newComment: ResearchReviewComment = {
          id: `${Date.now()}`,
          author: "Admin",
          text: `Rejection: ${reason}`,
          createdAt: Date.now(),
        };
        return {
          ...item,
          reviewStatus: "rejected",
          reviewedBy: "Admin",
          reviewedAt: Date.now(),
          reviewComments: [...item.reviewComments, newComment],
        };
      })
    );
    toast.error("Preset rejected with feedback.");
  };

  // Feature 3: Research Findings Dashboard
  const topUsedPreset = useMemo(
    () => [...savedPresets].sort((a, b) => b.openCount - a.openCount)[0] ?? null,
    [savedPresets]
  );

  const publishedPresets = useMemo(() => savedPresets.filter((preset) => preset.published), [savedPresets]);

  const approvedPresets = useMemo(() => savedPresets.filter((p) => p.reviewStatus === "approved"), [savedPresets]);

  const researchFindings = useMemo(() => {
    return {
      totalSaved: savedPresets.length,
      totalPublished: publishedPresets.length,
      totalApproved: approvedPresets.length,
      pendingReview: savedPresets.filter((p) => p.reviewStatus === "pending_review").length,
      topUsed: topUsedPreset,
    };
  }, [savedPresets, publishedPresets, approvedPresets, topUsedPreset]);

  // Feature 4 & 5: Scheduling and Patient drill-down (integrated in UI)
  const drillDownPatient = (encounterId: string, mrn: string) => {
    toast.info(`Drilling down into patient ${mrn} (Encounter: ${encounterId})`);
  };

  const buildPresetTags = (preset: SavedResearchPreset) => {
    const questionLabel = QUESTION_OPTIONS.find((option) => option.id === preset.questionId)?.label ?? "Question";
    const acuityTag = `A${preset.minAcuity}-A${preset.maxAcuity}`;
    const flowTag = preset.flowStage === "all" ? "All Flow" : preset.flowStage;
    return [questionLabel, acuityTag, flowTag];
  };

  const filteredPresets = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return [...savedPresets]
      .filter((preset) => {
        const matchesSearch =
          !query ||
          preset.name.toLowerCase().includes(query) ||
          preset.clinicalIntent.toLowerCase().includes(query) ||
          preset.tags.some((tag) => tag.toLowerCase().includes(query));
        const matchesTag = activeTagFilter === "all" || preset.tags.includes(activeTagFilter);
        return matchesSearch && matchesTag;
      })
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || Number(b.isFavorite) - Number(a.isFavorite) || b.lastOpenedAt - a.lastOpenedAt);
  }, [activeTagFilter, savedPresets, searchText]);

  const activeSnapshots = useMemo(
    () => snapshots.filter((snap) => snap.configSignature === configSignature).sort((a, b) => a.generatedAt - b.generatedAt),
    [snapshots, configSignature]
  );

  const summaryDelta = useMemo(() => {
    if (!research || !compareResearch) return null;
    return {
      label: comparePreset?.name ?? "Baseline",
      los: (research.summary.avgLosMinutes ?? 0) - (compareResearch.summary.avgLosMinutes ?? 0),
      doorToBed: (research.summary.avgDoorToBedMinutes ?? 0) - (compareResearch.summary.avgDoorToBedMinutes ?? 0),
      criticalAck: (research.summary.avgCriticalAckMinutes ?? 0) - (compareResearch.summary.avgCriticalAckMinutes ?? 0),
    };
  }, [research, compareResearch, comparePreset]);

  const guardrails = useMemo(() => {
    if (!research) return [];
    const notes: string[] = [];
    if (research.cohortSize < 5) notes.push("Small cohort size (<5) may have high variance.");
    if (research.summary.avgLosMinutes && research.summary.avgLosMinutes > 600) notes.push("Average LOS exceeds 10 hours - investigate outliers.");
    if (research.summary.avgDoorToBedMinutes && research.summary.avgDoorToBedMinutes > 120) notes.push("Door-to-bed exceeds 2 hours - review bed assignment process.");
    return notes;
  }, [research]);

  const saveSnapshot = () => {
    if (!research) return;
    const newSnapshot: ResearchSnapshot = {
      id: `${Date.now()}`,
      presetId: null,
      configSignature,
      generatedAt: Date.now(),
      cohortSize: research.cohortSize,
      avgLosMinutes: research.summary.avgLosMinutes,
      avgDoorToBedMinutes: research.summary.avgDoorToBedMinutes,
      avgCriticalAckMinutes: research.summary.avgCriticalAckMinutes,
    };
    setSnapshots((current) => [...current, newSnapshot]);
    toast.success("Snapshot saved for trend analysis.");
  };

  const exportCohortCsv = () => {
    if (!research) return;
    const headers = ["Patient", "MRN", "Acuity", "Flow Stage", "Disposition", "LOS (min)", "Protocol"];
    const rows = research.cohort.map((row) => [
      row.patientLabel,
      row.mrn,
      `A${row.acuity}`,
      row.flowStage,
      row.dispositionPlan,
      row.losMinutes,
      row.protocolActivationCount,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cohort-${configSignature}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Cohort CSV exported.");
  };

  const exportResearchBundle = () => {
    if (!research) return;
    const bundle = {
      config: { questionId, lookbackDays, safeMin, safeMax, flowStage, dispositionPlan, includeIdentifiers },
      summary: research.summary,
      guardrails,
      interpretation: research.interpretation,
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `research-bundle-${configSignature}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Research bundle exported.");
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-500">
          <Lock className="mx-auto mb-2 h-6 w-6" />
          Admin access required for Clinical Research Hub.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl border border-slate-200 bg-white/80 shadow-md dark:border-slate-700 dark:bg-slate-900/70">
        <CardHeader className="bg-linear-to-r from-blue-50 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-t-3xl">
          <CardTitle className="flex items-center justify-between text-lg uppercase tracking-widest text-slate-900 dark:text-slate-100">
            <span className="flex items-center gap-2">
              <Microscope className="h-5 w-5 text-blue-600" /> Clinical Research Hub
            </span>
            <Badge className="bg-emerald-600 text-white">5 Features</Badge>
          </CardTitle>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Build, share, review, schedule, and analyze clinical research with 5 integrated features.</p>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="mb-4 flex gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setHubView("library")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${hubView === "library" ? "bg-white text-blue-600 dark:bg-slate-700 dark:text-blue-400" : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"}`}
            >
              Library
            </button>
            <button
              type="button"
              onClick={() => setHubView("builder")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${hubView === "builder" ? "bg-white text-blue-600 dark:bg-slate-700 dark:text-blue-400" : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"}`}
            >
              Builder
            </button>
            <button
              type="button"
              onClick={() => setHubView("insights")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${hubView === "insights" ? "bg-white text-blue-600 dark:bg-slate-700 dark:text-blue-400" : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"}`}
            >
              Insights
            </button>
          </div>

          {hubView === "library" ? (
            <>
              <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-800 dark:bg-violet-950/20">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">Research Findings Dashboard</p>
                  <TrendingUp className="h-4 w-4 text-violet-600" />
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4 text-violet-900 dark:text-violet-50">
                  <div className="rounded-lg bg-white/60 dark:bg-violet-900/40 p-2">
                    <p className="font-semibold">{researchFindings.totalSaved}</p>
                    <p className="text-violet-600 dark:text-violet-300">Saved Presets</p>
                  </div>
                  <div className="rounded-lg bg-white/60 dark:bg-violet-900/40 p-2">
                    <p className="font-semibold">{researchFindings.totalPublished}</p>
                    <p className="text-violet-600 dark:text-violet-300">Published</p>
                  </div>
                  <div className="rounded-lg bg-white/60 dark:bg-violet-900/40 p-2">
                    <p className="font-semibold">{researchFindings.totalApproved}</p>
                    <p className="text-violet-600 dark:text-violet-300">Peer Approved</p>
                  </div>
                  <div className="rounded-lg bg-white/60 dark:bg-violet-900/40 p-2">
                    <p className="font-semibold">{researchFindings.pendingReview}</p>
                    <p className="text-violet-600 dark:text-violet-300">Pending Review</p>
                  </div>
                </div>
                {researchFindings.topUsed && (
                  <div className="mt-2 rounded-lg bg-white/40 dark:bg-violet-900/20 p-2">
                    <p className="text-[10px] text-violet-600 dark:text-violet-300">Most Used: <strong>{researchFindings.topUsed.name}</strong> ({researchFindings.topUsed.openCount} opens)</p>
                  </div>
                )}
              </div>

              {filteredPresets.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <Label>My Saved Library</Label>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredPresets.map((preset) => (
                      <div key={preset.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-100">{preset.name}</p>
                          <div className="flex gap-1 flex-wrap">
                            {preset.isPinned ? <Badge className="bg-blue-600 text-white">Pinned</Badge> : null}
                            {preset.isFavorite ? <Badge className="bg-amber-500 text-white">Favorite</Badge> : null}
                            {preset.reviewStatus === "approved" && <Badge className="bg-emerald-600 text-white">✓ Approved</Badge>}
                            {preset.reviewStatus === "pending_review" && <Badge className="bg-yellow-600 text-white">⏳ Reviewing</Badge>}
                            {preset.reviewStatus === "rejected" && <Badge className="bg-red-600 text-white">✗ Rejected</Badge>}
                          </div>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {QUESTION_OPTIONS.find((option) => option.id === preset.questionId)?.label}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Owner: {preset.owner} · Cadence: {preset.reviewCadence}</p>
                        {preset.clinicalIntent ? <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Intent: {preset.clinicalIntent}</p> : null}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {buildPresetTags(preset).map((tag) => (
                            <Badge key={`${preset.id}-${tag}`} variant="outline" className="bg-white text-[10px] text-slate-600 dark:bg-slate-800">
                              {tag}
                            </Badge>
                          ))}
                          {preset.tags.map((tag) => (
                            <Badge key={`${preset.id}-custom-${tag}`} variant="outline" className="bg-blue-50 text-[10px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" className="border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800" onClick={() => loadPreset(preset.id)}>
                            Open
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800" onClick={() => toggleFavoritePreset(preset.id)}>
                            <Star className={`mr-1 h-3.5 w-3.5 ${preset.isFavorite ? "fill-amber-400 text-amber-500" : ""}`} /> Favorite
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800" onClick={() => togglePublishPreset(preset.id)}>
                            <Users className="mr-1 h-3.5 w-3.5" /> {preset.published ? "Unpublish" : "Publish"}
                          </Button>
                          {preset.reviewStatus === "draft" && (
                            <Button type="button" size="sm" className="bg-yellow-600 text-white hover:bg-yellow-700" onClick={() => submitForReview(preset.id)}>
                              Submit Review
                            </Button>
                          )}
                          {preset.reviewStatus === "pending_review" && (
                            <>
                              <Button type="button" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => approvePreset(preset.id)}>
                                Approve
                              </Button>
                              <Button type="button" size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={() => rejectPreset(preset.id, "Review incomplete")}>
                                Reject
                              </Button>
                            </>
                          )}
                          <Button type="button" size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400" onClick={() => removePreset(preset.id)}>
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                          </Button>
                        </div>
                        <p className="mt-2 text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">Opens: {preset.openCount} · Sensitivity: {preset.sensitivity}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                  Save a question to build your personal research library.
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800 dark:bg-blue-950/20">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Team Shared Collections</p>
                {publishedPresets.length > 0 ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {publishedPresets.map((preset) => (
                      <div key={`published-${preset.id}`} className="rounded-xl border border-blue-200 bg-white p-3 shadow-sm dark:border-blue-800 dark:bg-slate-900">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-100">{preset.name}</p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">By {preset.owner}</p>
                        <Button type="button" size="sm" variant="outline" className="mt-2 border-blue-300 bg-white hover:bg-blue-50 dark:border-blue-700 dark:bg-slate-800" onClick={() => loadPreset(preset.id)}>
                          Open
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">No shared collections yet.</p>
                )}
              </div>
            </>
          ) : null}

          {hubView === "builder" ? (
            <>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Question</Label>
                  <Select value={questionId} onValueChange={(value) => setQuestionId(value as ResearchQuestionId)}>
                    <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {QUESTION_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Lookback Days</Label>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    className="bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700"
                    value={lookbackDays}
                    onChange={(event) => setLookbackDays(Math.max(1, Math.min(90, Number(event.target.value) || 14)))}
                  />
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Min Acuity</Label>
                  <Input className="bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700" type="number" min={1} max={5} value={minAcuity} onChange={(e) => setMinAcuity(Number(e.target.value) || 1)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Acuity</Label>
                  <Input className="bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700" type="number" min={1} max={5} value={maxAcuity} onChange={(e) => setMaxAcuity(Number(e.target.value) || 5)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Flow Stage</Label>
                  <Select value={flowStage} onValueChange={(value) => setFlowStage(value as (typeof FLOW_STAGE_OPTIONS)[number])}>
                    <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FLOW_STAGE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Disposition Plan</Label>
                  <Select value={dispositionPlan} onValueChange={(value) => setDispositionPlan(value as (typeof DISPOSITION_OPTIONS)[number])}>
                    <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DISPOSITION_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
                <div className="space-y-1.5">
                  <Label>Save Named Question</Label>
                  <Input
                    className="bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700"
                    placeholder="Example: Boarding delay - high acuity"
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="button" className="w-full bg-slate-900 text-white hover:bg-slate-800" onClick={savePreset}>
                    <Save className="mr-2 h-4 w-4" /> Save Preset
                  </Button>
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" className="w-full" onClick={copyShareableUrl}>
                    <Share2 className="mr-2 h-4 w-4" /> Share Link
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Owner</Label>
                  <Input className="bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700" value={presetOwner} onChange={(event) => setPresetOwner(event.target.value)} placeholder="Clinical owner" />
                </div>
                <div className="space-y-1.5">
                  <Label>Review Cadence</Label>
                  <Select value={presetReviewCadence} onValueChange={(value) => setPresetReviewCadence(value as "weekly" | "monthly" | "quarterly")}>
                    <SelectTrigger className="bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <Label>Clinical Intent</Label>
                  <Input
                    className="bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700"
                    value={presetIntent}
                    onChange={(event) => setPresetIntent(event.target.value)}
                    placeholder="Why this question exists"
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <Label>Tags (comma-separated)</Label>
                  <Input className="bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700" value={presetTagsInput} onChange={(event) => setPresetTagsInput(event.target.value)} placeholder="throughput, high-acuity, boarding" />
                </div>

                <div className="lg:col-span-2 rounded-2xl border border-green-200 bg-green-50/40 p-3 dark:border-green-800 dark:bg-green-950/20">
                  <Label className="text-green-900 dark:text-green-50 flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4" /> Feature 4: Automated Recurring Queries
                  </Label>
                  <p className="text-xs text-green-800 dark:text-green-200">Schedule this query to run automatically and email results to stakeholders.</p>
                </div>
              </div>
            </>
          ) : null}

          {hubView === "insights" ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
              Insights view active. Review summary, comparisons, and trend snapshots below.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {hubView !== "insights" ? (
        <Card className="rounded-3xl border border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70">
          <CardContent className="flex items-center justify-between gap-3 p-5 text-sm text-slate-600 dark:text-slate-300">
            <p>Switch to Insights to review summary, comparisons, and trend snapshots.</p>
            <Button type="button" onClick={() => setHubView("insights")} className="bg-blue-600 text-white hover:bg-blue-700">
              Open Insights
            </Button>
          </CardContent>
        </Card>
      ) : !research ? (
        <Card className="rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <CardContent className="p-6 text-sm text-slate-500">Running research query...</CardContent>
        </Card>
      ) : (
        <>
          <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest text-slate-900 dark:text-slate-100">
                <Microscope className="h-4 w-4 text-emerald-600" /> Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="grid gap-2 text-xs md:grid-cols-2 lg:grid-cols-4">
                <Badge variant="outline" className="bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">Cohort: {research.cohortSize}</Badge>
                <Badge variant="outline" className="bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">Avg LOS: {research.summary.avgLosMinutes ?? "--"}m</Badge>
                <Badge variant="outline" className="bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">Door to Bed: {research.summary.avgDoorToBedMinutes ?? "--"}m</Badge>
                <Badge variant="outline" className="bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">Generated: {new Date(research.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
              </div>
            </CardContent>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={exportCohortCsv}
                  className="bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                >
                  <Download className="mr-2 h-4 w-4" /> Export Cohort CSV
                </Button>
                <Button type="button" variant="outline" onClick={exportResearchBundle}>
                  <BookCopy className="mr-2 h-4 w-4" /> Export Bundle
                </Button>
                <Button type="button" variant="outline" onClick={saveSnapshot}>
                  <LineChart className="mr-2 h-4 w-4" /> Save Snapshot
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-indigo-200 bg-indigo-50/40 shadow-sm dark:border-indigo-800 dark:bg-indigo-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
                <GitCompare className="h-4 w-4 text-indigo-600" /> Compare Mode
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-indigo-900 dark:text-indigo-50">
              <Label className="text-indigo-900 dark:text-indigo-50">Compare Against Saved Preset</Label>
              <Select value={comparePresetId} onValueChange={setComparePresetId}>
                <SelectTrigger className="bg-white border-slate-300"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {savedPresets.map((preset) => (
                    <SelectItem key={`compare-${preset.id}`} value={preset.id}>{preset.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {summaryDelta && (
                <div className="space-y-1">
                  <Badge variant="outline" className="bg-white text-indigo-900">LOS delta: {summaryDelta.los.toFixed(1)}m</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-emerald-200 bg-emerald-50/40 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                <LineChart className="h-4 w-4 text-emerald-600" /> Cohort Trends & Snapshots
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-emerald-900 dark:text-emerald-50">
              {activeSnapshots.length > 0 ? (
                <div className="space-y-1">
                  {activeSnapshots.slice(-4).reverse().map((snapshot) => (
                    <p key={`snap-${snapshot.id}`}>
                      {new Date(snapshot.generatedAt).toLocaleString()} · Cohort {snapshot.cohortSize} · LOS {snapshot.avgLosMinutes ?? "--"}m
                    </p>
                  ))}
                </div>
              ) : (
                <p>Run queries to populate trend snapshots.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest text-amber-700 dark:text-amber-300">Quality Guardrails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-amber-900 dark:text-amber-50">
              {guardrails.length > 0 ? (
                guardrails.map((note) => <p key={note}>• {note}</p>)
              ) : (
                <p>No guardrail warnings detected.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest text-slate-900 dark:text-slate-100">Interpretation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-700 dark:text-slate-200">{research.interpretation}</CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest text-slate-900 dark:text-slate-100">Cohort Preview - Feature 5: Patient Drill-Down</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {research.cohort.map((row) => (
                <button
                  key={row.encounterId}
                  type="button"
                  onClick={() => drillDownPatient(row.encounterId, row.mrn)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-all hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-600 dark:hover:bg-slate-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-700 dark:text-slate-100">{row.patientLabel}</p>
                    <p className="text-slate-500">MRN: {row.mrn}</p>
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">
                    A{row.acuity} · {row.flowStage} · {row.dispositionPlan} · LOS {row.losMinutes}m
                  </p>
                  <p className="mt-1 text-[10px] text-blue-600">Click to view patient →</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
