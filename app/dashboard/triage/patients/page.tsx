"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import GlobalSearch from "@/components/clinical/GlobalSearch";
import TriageTabs from "@/components/clinical/TriageTabs";
import { Activity, ArrowUpRight, Clock, Lock, Rows3 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useStaffSession } from "@/lib/hooks/useStaffSession";
import { calculateNEWS2 } from "@/lib/helpers/news2";
import { toast } from "sonner";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { usePresentationMode } from "@/lib/hooks/usePresentationMode";

const PATIENT_LIST_CRITICAL_ONLY_KEY = "triage-patient-list-critical-only";
const PATIENT_LIST_SORT_KEY = "triage-patient-list-sort";
const PATIENT_LIST_LAST_BULK_RUN_KEY = "triage-patient-list-last-bulk-run";
type PatientListSortMode = "wait" | "acuity" | "risk";
type LastBulkRunSummary = { at: number; applied: number; candidates: number };

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
  const activeEncounters = useQuery(api.encounters.getActive);
  const runSlaEscalationSweep = useMutation(api.workflow.runSlaEscalationSweep);
  const { actorName } = useResolvedActor();
  const { isDemoMode, toggleDemoMode } = usePresentationMode();
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [searchTerm, setSearchTerm] = useState("");
  const [isRunningBulkAction, setIsRunningBulkAction] = useState(false);
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

      return [...triaged].sort((a, b) => {
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
    [activeEncounters, searchTerm, criticalOnly, sortMode, currentTime, isDemoMode]
  );

  const criticalCount = useMemo(
    () => (activeEncounters ?? []).filter((encounter) => isEncounterCritical(encounter)).length,
    [activeEncounters, currentTime]
  );

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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-200">
                <Activity className="h-4 w-4 text-blue-600" /> Active Triage Queue
              </CardTitle>

              <div className="flex flex-wrap items-center gap-2">
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
              </div>
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
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 text-xs font-black ${waitTime > 60 ? "text-red-600" : "text-slate-600 dark:text-slate-300"}`}>
                          <Clock className="h-3.5 w-3.5" /> {waitTime}m
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
                        <Link href={`/patient/${encounter.patientId}`}>
                          <button className="inline-flex items-center gap-2 rounded-[1.5rem] bg-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-blue-600 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-blue-500 dark:hover:text-white">
                            Enter Chart <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                        </Link>
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

const formatPatientListName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}. ${parts[1]}`;
  }
  const first = name.charAt(0) || "P";
  return `Patient-${first.toUpperCase()}${name.length}`;
};
