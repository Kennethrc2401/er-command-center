"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Activity, BedDouble, ClipboardList, Clock3, Route, Stethoscope, TriangleAlert, UserRound } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STAGE_OPTIONS = [
  { value: "triage", label: "Triage" },
  { value: "awaiting_bed", label: "Awaiting Bed" },
  { value: "bedded", label: "Bedded" },
  { value: "provider_assigned", label: "Provider Assigned" },
  { value: "workup_pending", label: "Workup Pending" },
  { value: "consult_pending", label: "Consult Pending" },
  { value: "discharge_ready", label: "Discharge Ready" },
  { value: "admit_ready", label: "Admit Ready" },
  { value: "boarded", label: "Boarded" },
] as const;

const DISPOSITION_OPTIONS = [
  { value: "undecided", label: "Undecided" },
  { value: "discharge", label: "Discharge" },
  { value: "admit", label: "Admit" },
  { value: "observation", label: "Observation" },
  { value: "transfer", label: "Transfer" },
] as const;

const DELAY_OPTIONS = [
  { value: "none", label: "No Active Delay" },
  { value: "awaiting_bed", label: "Awaiting Bed" },
  { value: "awaiting_provider", label: "Awaiting Provider" },
  { value: "awaiting_labs", label: "Awaiting Labs" },
  { value: "awaiting_imaging", label: "Awaiting Imaging" },
  { value: "awaiting_consult", label: "Awaiting Consult" },
  { value: "awaiting_transport", label: "Awaiting Transport" },
  { value: "awaiting_inpatient_bed", label: "Awaiting Inpatient Bed" },
  { value: "awaiting_discharge_paperwork", label: "Awaiting Discharge Paperwork" },
  { value: "insurance_hold", label: "Insurance Hold" },
  { value: "registration_hold", label: "Registration Hold" },
  { value: "other", label: "Other" },
] as const;

const COLUMN_CONFIG = [
  {
    key: "frontDoor",
    title: "Front Door",
    description: "Arrivals not yet bedded or still in triage intake.",
    accent: "text-blue-600",
    border: "border-blue-200 dark:border-blue-900/50",
    background: "bg-blue-50/70 dark:bg-blue-950/20",
  },
  {
    key: "workup",
    title: "Workup",
    description: "Bedded patients moving through provider assessment and diagnostics.",
    accent: "text-violet-600",
    border: "border-violet-200 dark:border-violet-900/50",
    background: "bg-violet-50/70 dark:bg-violet-950/20",
  },
  {
    key: "disposition",
    title: "Disposition",
    description: "Patients ready to exit once orders, paperwork, or bed placement clears.",
    accent: "text-emerald-600",
    border: "border-emerald-200 dark:border-emerald-900/50",
    background: "bg-emerald-50/70 dark:bg-emerald-950/20",
  },
  {
    key: "blocked",
    title: "Blocked",
    description: "Boarders and encounters with active delay reasons.",
    accent: "text-amber-600",
    border: "border-amber-200 dark:border-amber-900/50",
    background: "bg-amber-50/70 dark:bg-amber-950/20",
  },
] as const;

type StageValue = (typeof STAGE_OPTIONS)[number]["value"];
type DispositionValue = (typeof DISPOSITION_OPTIONS)[number]["value"];
type DelayValue = (typeof DELAY_OPTIONS)[number]["value"];
type ColumnKey = (typeof COLUMN_CONFIG)[number]["key"];

function formatMinutes(value: number | null, suffix: string) {
  if (value === null) return "Not enough data";
  return `${value}m ${suffix}`;
}

function formatPatientName(name: string, isPrivate: boolean, isDemoMode: boolean) {
  if (isPrivate) return "PRIVATE PATIENT";
  if (!isDemoMode) return name;

  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return `${parts[0][0]}. ${parts[1]}`;
  }

  return `Patient-${name.length}${name.charCodeAt(0)}`;
}

function formatMrn(mrn: string, isPrivate: boolean, isDemoMode: boolean) {
  if (isPrivate) return "HIDDEN";
  if (isDemoMode) return "• • • • •";
  return mrn;
}

export default function ThroughputControlTower({
  isPrivate,
  isDemoMode,
}: {
  isPrivate: boolean;
  isDemoMode: boolean;
}) {
  const board = useQuery(api.encounters.getThroughputBoard);
  const metrics = useQuery(api.encounters.getThroughputMetrics);

  const grouped = useMemo(() => {
    const initial = {
      frontDoor: [] as NonNullable<typeof board>,
      workup: [] as NonNullable<typeof board>,
      disposition: [] as NonNullable<typeof board>,
      blocked: [] as NonNullable<typeof board>,
    };

    for (const encounter of board ?? []) {
      initial[encounter.columnKey as ColumnKey].push(encounter);
    }

    return initial;
  }, [board]);

  if (!board || !metrics) {
    return (
      <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Activity className="h-5 w-5 animate-pulse text-blue-600" />
          <span className="text-[11px] font-black uppercase tracking-[0.24em]">Loading throughput control tower</span>
        </div>
      </section>
    );
  }

  const metricCards = [
    {
      title: "Active Encounters",
      value: metrics.activeCount,
      subtitle: `${metrics.columnCounts.frontDoor} front door · ${metrics.columnCounts.workup} workup`,
      icon: Activity,
      color: "text-blue-600",
    },
    {
      title: "Blocked / Boarded",
      value: metrics.blockedCount,
      subtitle: `${metrics.readyAdmissionCount} admit ready or boarded`,
      icon: TriangleAlert,
      color: "text-amber-600",
    },
    {
      title: "Door To Bed",
      value: formatMinutes(metrics.avgDoorToBedMinutes, "avg"),
      subtitle: `Window: last ${metrics.windowHours}h`,
      icon: BedDouble,
      color: "text-violet-600",
    },
    {
      title: "Provider To Decision",
      value: formatMinutes(metrics.avgProviderToDecisionMinutes, "avg"),
      subtitle: `${formatMinutes(metrics.avgDischargeLagMinutes, "discharge lag")}`,
      icon: Stethoscope,
      color: "text-emerald-600",
    },
  ];

  return (
    <section className="space-y-6 rounded-[2.5rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
            <Route className="h-4 w-4 text-blue-600" />
            Disposition & Throughput Control Tower
          </div>
          <h2 className="text-3xl font-black uppercase italic tracking-tight text-slate-900 dark:text-slate-100">
            Queue Ownership And Delay Control
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            This board surfaces who owns each encounter, what stage the visit is in, and what is currently blocking movement toward discharge or admission.
          </p>
        </div>
        <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Current Backlog</p>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
            {metrics.readyDischargeCount} discharge ready · {metrics.readyAdmissionCount} admit ready
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {metricCards.map((item) => (
          <Card key={item.title} className="rounded-[1.75rem] border border-slate-200 shadow-none dark:border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                {item.title}
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">{item.value}</div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {metrics.blockerCounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[1.75rem] border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700 dark:text-amber-300">Top Delay Reasons</span>
          {metrics.blockerCounts.map((blocker) => (
            <Badge key={blocker.reason} className="bg-amber-600 text-white">
              {blocker.reason.replaceAll("_", " ")} · {blocker.count}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-4">
        {COLUMN_CONFIG.map((column) => (
          <div
            key={column.key}
            className={`rounded-[2rem] border p-4 ${column.border} ${column.background}`}
          >
            <div className="mb-4 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className={`text-sm font-black uppercase tracking-[0.18em] ${column.accent}`}>{column.title}</h3>
                <Badge variant="outline" className="border-current bg-white/70 text-[10px] uppercase dark:bg-slate-950/50">
                  {grouped[column.key].length}
                </Badge>
              </div>
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{column.description}</p>
            </div>

            <div className="space-y-4">
              {grouped[column.key].length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white/70 p-6 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-500">
                  No encounters here
                </div>
              ) : (
                grouped[column.key].map((encounter) => (
                  <ThroughputEncounterCard
                    key={`${encounter._id}-${encounter.flowStage}-${encounter.dispositionPlan}-${encounter.delayReason}-${encounter.flowStageUpdatedAt}`}
                    encounter={encounter}
                    isPrivate={isPrivate}
                    isDemoMode={isDemoMode}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ThroughputEncounterCard({
  encounter,
  isPrivate,
  isDemoMode,
}: {
  encounter: {
    _id: Id<"encounters">;
    patientId: Id<"patients">;
    patientName: string;
    mrn: string;
    acuity: number;
    chiefComplaint: string;
    location: string;
    assignedProvider: string;
    flowOwner: string;
    flowStage: StageValue;
    flowStageUpdatedAt: number;
    dispositionPlan: DispositionValue;
    delayReason: DelayValue;
    delayNote: string;
    pendingLabCount: number;
    pendingImagingCount: number;
    criticalLabCount: number;
    hasActiveConsult: boolean;
    ageMinutes: number;
    stageAgeMinutes: number;
    isBlocked: boolean;
  };
  isPrivate: boolean;
  isDemoMode: boolean;
}) {
  const updateFlow = useMutation(api.encounters.updateEncounterFlow);
  const [flowStage, setFlowStage] = useState<StageValue>(encounter.flowStage);
  const [dispositionPlan, setDispositionPlan] = useState<DispositionValue>(encounter.dispositionPlan);
  const [delayReason, setDelayReason] = useState<DelayValue>(encounter.delayReason);
  const [flowOwner, setFlowOwner] = useState(encounter.flowOwner);
  const [assignedProvider, setAssignedProvider] = useState(encounter.assignedProvider);
  const [delayNote, setDelayNote] = useState(encounter.delayNote);
  const [isSaving, setIsSaving] = useState(false);

  const pushUpdate = async (
    payload: Partial<{
      flowStage: StageValue;
      dispositionPlan: DispositionValue;
      delayReason: DelayValue;
      flowOwner: string;
      assignedProvider: string;
      delayNote: string;
    }>,
    successMessage: string
  ) => {
    try {
      await updateFlow({ encounterId: encounter._id, ...payload });
      toast.success(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update encounter flow.";
      toast.error(message);
    }
  };

  const handleSaveContext = async () => {
    setIsSaving(true);
    try {
      await updateFlow({
        encounterId: encounter._id,
        flowOwner,
        assignedProvider,
        delayReason,
        delayNote,
      });
      toast.success("Ownership fields saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save ownership fields.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = formatPatientName(encounter.patientName, isPrivate, isDemoMode);
  const displayMrn = formatMrn(encounter.mrn, isPrivate, isDemoMode);

  return (
    <Card className={`rounded-[1.75rem] border shadow-sm dark:bg-slate-900 ${encounter.isBlocked ? "border-amber-300 dark:border-amber-800/60" : "border-slate-200 dark:border-slate-800"}`}>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={`${encounter.acuity <= 2 ? "bg-red-600" : "bg-blue-600"} text-white`}>ESI {encounter.acuity}</Badge>
              <Badge variant="outline" className="border-slate-300 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {flowStage.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="truncate text-base font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{displayName}</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">MRN: {displayMrn}</p>
            <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">{encounter.chiefComplaint}</p>
          </div>
          <Link
            href={`/patient/${encounter.patientId}`}
            className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-colors hover:border-blue-600 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
          >
            Open Chart
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Location</p>
            <p className="mt-1">{encounter.location}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Flow Age</p>
            <p className="mt-1">{encounter.stageAgeMinutes}m in stage</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Encounter Age</p>
            <p className="mt-1">{encounter.ageMinutes}m total</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Workup</p>
            <p className="mt-1">{encounter.pendingLabCount} labs · {encounter.pendingImagingCount} imaging</p>
          </div>
        </div>

        {(encounter.criticalLabCount > 0 || encounter.hasActiveConsult || delayReason !== "none") && (
          <div className="flex flex-wrap gap-2">
            {encounter.criticalLabCount > 0 && <Badge className="bg-red-600 text-white">{encounter.criticalLabCount} critical lab</Badge>}
            {encounter.hasActiveConsult && <Badge className="bg-violet-600 text-white">Consult active</Badge>}
            {delayReason !== "none" && <Badge className="bg-amber-600 text-white">Delay: {delayReason.replaceAll("_", " ")}</Badge>}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Flow Stage</Label>
            <Select
              value={flowStage}
              onValueChange={(value) => {
                const nextValue = value as StageValue;
                setFlowStage(nextValue);
                void pushUpdate({ flowStage: nextValue }, "Flow stage updated");
              }}
            >
              <SelectTrigger className="w-full bg-white dark:bg-slate-950">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Disposition Plan</Label>
            <Select
              value={dispositionPlan}
              onValueChange={(value) => {
                const nextValue = value as DispositionValue;
                setDispositionPlan(nextValue);
                void pushUpdate({ dispositionPlan: nextValue }, "Disposition plan updated");
              }}
            >
              <SelectTrigger className="w-full bg-white dark:bg-slate-950">
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {DISPOSITION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Delay Reason</Label>
            <Select
              value={delayReason}
              onValueChange={(value) => {
                const nextValue = value as DelayValue;
                setDelayReason(nextValue);
                if (nextValue === "none") {
                  setDelayNote("");
                }
                void pushUpdate(
                  { delayReason: nextValue, delayNote: nextValue === "none" ? "" : delayNote },
                  nextValue === "none" ? "Delay cleared" : "Delay reason updated"
                );
              }}
            >
              <SelectTrigger className="w-full bg-white dark:bg-slate-950">
                <SelectValue placeholder="Select delay" />
              </SelectTrigger>
              <SelectContent>
                {DELAY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <UserRound className="h-3.5 w-3.5" /> Flow Owner
            </Label>
            <Input
              value={flowOwner}
              onChange={(event) => setFlowOwner(event.target.value)}
              placeholder="Charge nurse / CCMA owner"
              className="bg-white dark:bg-slate-950"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <Stethoscope className="h-3.5 w-3.5" /> Assigned Provider
            </Label>
            <Input
              value={assignedProvider}
              onChange={(event) => setAssignedProvider(event.target.value)}
              placeholder="MD / APP owner"
              className="bg-white dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <ClipboardList className="h-3.5 w-3.5" /> Delay Note
          </Label>
          <Textarea
            value={delayNote}
            onChange={(event) => setDelayNote(event.target.value)}
            placeholder="Add the current blocker, next step, or handoff note"
            className="min-h-20 bg-white text-sm dark:bg-slate-950"
            disabled={delayReason === "none"}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {encounter.ageMinutes}m in ED</span>
            <span className="inline-flex items-center gap-1.5"><BedDouble className="h-3.5 w-3.5" /> {encounter.location}</span>
          </div>
          <Button
            type="button"
            onClick={() => void handleSaveContext()}
            disabled={isSaving}
            className="rounded-full bg-slate-900 px-5 text-[10px] font-black uppercase tracking-[0.18em] text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isSaving ? "Saving..." : "Save Ownership"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}