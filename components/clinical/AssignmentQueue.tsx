"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { usePresentationMode } from "@/lib/hooks/usePresentationMode";
import { UserRound, BriefcaseMedical, ListChecks, Activity, Users, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

type ClaimMode = "flowOwner" | "assignedProvider";

const SELF_SELECTION_VALUE = "__me__";
const ASSIGNMENT_PREFILL_KEY = "assignment-queue:prefill-staff-id";
const ASSIGNMENT_PREFILL_EVENT = "assignment-queue:prefill";

type ProviderWorkloadRow = {
  name: string;
  assignedCount: number;
  highAcuityCount: number;
  acuityWeightedLoad: number;
  blockedCount: number;
  readyDischargeCount: number;
  openAlertCount: number;
};

export default function AssignmentQueue() {
  const roster = useQuery(api.users.getActiveRoster);
  const encounters = useQuery(api.workflow.getThroughputBoard);
  const providerWorkload = useQuery(api.workflow.getProviderWorkload);
  const assignmentRecommendations = useQuery(api.workflow.getAssignmentRecommendations);
  const updateEncounterFlow = useMutation(api.encounters.updateEncounterFlow);
  const { actorName, actorRole } = useResolvedActor();
  const isDemoMode = usePresentationMode((state) => state.isDemoMode);
  const queueRootRef = useRef<HTMLDivElement>(null);
  const [isPrefillHighlightVisible, setIsPrefillHighlightVisible] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(ASSIGNMENT_PREFILL_KEY) ?? "";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!selectedStaffId) {
      window.localStorage.removeItem(ASSIGNMENT_PREFILL_KEY);
      return;
    }

    window.localStorage.setItem(ASSIGNMENT_PREFILL_KEY, selectedStaffId);
  }, [selectedStaffId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPrefill = (event: Event) => {
      const custom = event as CustomEvent<{ staffId?: string }>;
      const staffId = custom.detail?.staffId?.trim();
      if (!staffId) return;

      setSelectedStaffId(staffId);
      queueRootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      queueRootRef.current?.focus();
      setIsPrefillHighlightVisible(true);

      window.setTimeout(() => {
        setIsPrefillHighlightVisible(false);
      }, 1400);
    };

    window.addEventListener(ASSIGNMENT_PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(ASSIGNMENT_PREFILL_EVENT, onPrefill);
  }, []);

  const claimableEncounters = useMemo(
    () =>
      (encounters ?? []).filter(
        (encounter) => encounter.status !== "discharged" && (!encounter.flowOwner?.trim() || !encounter.assignedProvider?.trim())
      ),
    [encounters]
  );

  const rosterByRole = useMemo(() => {
    const counts = new Map<string, number>();
    for (const staff of roster ?? []) {
      counts.set(staff.role, (counts.get(staff.role) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((left, right) => left.role.localeCompare(right.role));
  }, [roster]);

  const workloadByName = useMemo(() => {
    const map = new Map<string, ProviderWorkloadRow>();
    for (const row of providerWorkload ?? []) {
      map.set(row.name, row);
    }
    return map;
  }, [providerWorkload]);

  const rosterCards = useMemo(
    () =>
      (roster ?? [])
        .map((staff) => ({
          ...staff,
          workload: workloadByName.get(staff.name),
          queueCount: workloadByName.get(staff.name)?.assignedCount ?? 0,
        }))
        .sort((left, right) => right.queueCount - left.queueCount || left.role.localeCompare(right.role) || left.name.localeCompare(right.name)),
    [roster, workloadByName]
  );

  const recommendedFlowOwner = assignmentRecommendations?.flowOwner ?? null;
  const recommendedProvider = assignmentRecommendations?.assignedProvider ?? null;
  const recommendedFallback = recommendedProvider ?? recommendedFlowOwner ?? rosterCards[0] ?? null;
  const selectedStaff = selectedStaffId && selectedStaffId !== SELF_SELECTION_VALUE ? roster?.find((staff) => staff._id === selectedStaffId) ?? null : null;
  const selectedAssigneeLabel = selectedStaffId === SELF_SELECTION_VALUE ? actorName : selectedStaff?.name ?? recommendedFallback?.name ?? actorName;

  const claimEncounter = async (encounterId: string, mode: ClaimMode) => {
    const recommendedAssignee = mode === "flowOwner" ? recommendedFlowOwner ?? recommendedFallback : recommendedProvider ?? recommendedFallback;
    const assigneeName = selectedStaffId === SELF_SELECTION_VALUE ? actorName : selectedStaff?.name?.trim() || recommendedAssignee?.name?.trim() || actorName;

    try {
      await updateEncounterFlow({
        encounterId: encounterId as never,
        ...(mode === "flowOwner" ? { flowOwner: assigneeName } : { assignedProvider: assigneeName }),
      });
      toast.success(`${mode === "flowOwner" ? "Flow owner" : "Provider"} assigned to ${assigneeName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to claim encounter.";
      toast.error(message);
    }
  };

  return (
    <div ref={queueRootRef} tabIndex={-1} className="focus:outline-hidden">
    <Card className={`overflow-hidden rounded-[2.5rem] border bg-white shadow-sm transition-all duration-500 dark:bg-slate-900 ${
      isPrefillHighlightVisible
        ? "border-blue-400 shadow-[0_0_0_3px_rgba(59,130,246,0.24)] dark:border-blue-500"
        : "border-slate-200 dark:border-slate-800"
    }`}>
      <CardHeader className="border-b border-slate-200 bg-slate-50/70 pb-4 dark:border-slate-800 dark:bg-slate-950/40">
        <CardTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-200">
          <ListChecks className="h-4 w-4 text-blue-600" /> Assignment Queue
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Active Staff</p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{roster?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Unassigned Encounters</p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{claimableEncounters.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Your Role</p>
            <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{actorRole}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Active Roster</p>
            <Badge className="bg-slate-900 text-white">
              <Users className="mr-1 h-3 w-3" /> {rosterCards.length} on duty
            </Badge>
          </div>

          <div className="grid gap-2 rounded-2xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/70 dark:bg-blue-950/25 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-200">Recommended Flow Owner</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{recommendedFlowOwner?.name ?? "No active match"}</p>
              <p className="text-[10px] text-slate-600 dark:text-slate-300">
                {recommendedFlowOwner
                  ? `${recommendedFlowOwner.role.replaceAll("_", " ")} · ${recommendedFlowOwner.assignedCount} open / score ${recommendedFlowOwner.loadScore}`
                  : "Open roster needed for automatic owner assignment."}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-200">Recommended Provider</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{recommendedProvider?.name ?? "No active match"}</p>
              <p className="text-[10px] text-slate-600 dark:text-slate-300">
                {recommendedProvider
                  ? `${recommendedProvider.role.replaceAll("_", " ")} · ${recommendedProvider.assignedCount} open / score ${recommendedProvider.loadScore}`
                  : "Open roster needed for automatic provider assignment."}
              </p>
            </div>
          </div>

          {recommendedFallback && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950/50">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Auto-assign default</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {recommendedFallback.name} · {recommendedFallback.role.replaceAll("_", " ")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full border-slate-300 px-3 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50"
                onClick={() => setSelectedStaffId(recommendedFallback._id)}
              >
                Use Recommendation
              </Button>
            </div>
          )}

          {rosterByRole.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {rosterByRole.map((item) => (
                <Badge key={item.role} className="bg-slate-900 text-white">
                  {item.role.replaceAll("_", " ")} · {item.count}
                </Badge>
              ))}
            </div>
          )}

          <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
            {rosterCards.slice(0, 9).map((staff) => (
              <button
                key={staff._id}
                type="button"
                onClick={() => setSelectedStaffId(staff._id)}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
                  selectedStaffId === staff._id
                    ? "border-blue-400 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-950/30"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-slate-700"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{staff.name}</p>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {staff.role.replaceAll("_", " ")} · {staff.department}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge className="bg-slate-900 text-white">
                    <Activity className="mr-1 h-3 w-3" /> {staff.queueCount}
                  </Badge>
                  {selectedStaffId === staff._id && (
                    <Badge className="border border-blue-200 bg-blue-50 text-[9px] font-black uppercase tracking-widest text-blue-700">
                      Selected
                    </Badge>
                  )}
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Select</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40 md:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Assign To Staff Member</p>
            <Select
              value={selectedStaffId || SELF_SELECTION_VALUE}
              onValueChange={(value) => setSelectedStaffId(value === SELF_SELECTION_VALUE ? SELF_SELECTION_VALUE : value)}
            >
              <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/50">
                <SelectValue placeholder="Claim to the recommended staff member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELF_SELECTION_VALUE}>Me ({actorName})</SelectItem>
                {roster?.map((staff) => (
                  <SelectItem key={staff._id} value={staff._id}>
                    {staff.name} · {staff.role.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950/50">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Selected</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{selectedAssigneeLabel}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {claimableEncounters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-500">
              No unassigned encounters right now
            </div>
          ) : (
            claimableEncounters.slice(0, 6).map((encounter) => (
              <div key={encounter._id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{isDemoMode ? "Patient Hidden" : encounter.patientName}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {encounter.location} · {encounter.flowStage.replaceAll("_", " ")}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {!encounter.flowOwner?.trim() && (
                        <Badge className="border border-blue-200 bg-blue-50 text-[9px] font-black uppercase tracking-widest text-blue-700">
                          Needs Flow Owner
                        </Badge>
                      )}
                      {!encounter.assignedProvider?.trim() && (
                        <Badge className="border border-violet-200 bg-violet-50 text-[9px] font-black uppercase tracking-widest text-violet-700">
                          Needs Provider
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!encounter.flowOwner?.trim() && (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500"
                        onClick={() => void claimEncounter(encounter._id, "flowOwner")}
                      >
                        <UserRound className="mr-1 h-3.5 w-3.5" /> Claim Owner
                      </Button>
                    )}
                    {!encounter.assignedProvider?.trim() && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full border-violet-300 px-3 text-[10px] font-black uppercase tracking-widest text-violet-700 hover:bg-violet-50"
                        onClick={() => void claimEncounter(encounter._id, "assignedProvider")}
                      >
                        <BriefcaseMedical className="mr-1 h-3.5 w-3.5" /> Claim Provider
                      </Button>
                    )}
                    {(encounter.flowOwner?.trim() || encounter.assignedProvider?.trim()) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full border-slate-300 px-3 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50"
                        onClick={() => void claimEncounter(encounter._id, encounter.flowOwner?.trim() ? "flowOwner" : "assignedProvider")}
                      >
                        <ArrowRightLeft className="mr-1 h-3.5 w-3.5" /> Transfer
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}