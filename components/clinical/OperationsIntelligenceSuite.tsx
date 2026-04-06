"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import {
  AlertTriangle,
  Ambulance,
  BellRing,
  ClipboardCheck,
  Cpu,
  Gauge,
  ShieldAlert,
  Siren,
  Timer,
  Users,
  Waves,
} from "lucide-react";
import { toast } from "sonner";

export default function OperationsIntelligenceSuite() {
  const intel = useQuery(api.workflow.getOperationsIntelligenceSuite);
  const updateEncounterFlow = useMutation(api.encounters.updateEncounterFlow);
  const acknowledgeLab = useMutation(api.labs.acknowledgeLab);
  const acknowledgeImaging = useMutation(api.imaging.acknowledgeResult);
  const acknowledgeConsult = useMutation(api.consults.acknowledge);
  const ensureDischargeChecklist = useMutation(api.checklists.ensureDischargeChecklist);
  const routeRoleNotification = useMutation(api.workflow.routeRoleNotification);
  const undoCriticalAcknowledgement = useMutation(api.workflow.undoCriticalAcknowledgement);
  const triggerDeteriorationEscalation = useMutation(api.workflow.triggerDeteriorationEscalation);
  const runSlaEscalationSweep = useMutation(api.workflow.runSlaEscalationSweep);
  const { actorName } = useResolvedActor();
  const [replayWindowHours, setReplayWindowHours] = useState<4 | 8 | 24>(24);
  const replay = useQuery(api.workflow.getShiftReplay, { windowHours: replayWindowHours });
  const [replayTypeFilter, setReplayTypeFilter] = useState<Record<"protocol" | "handoff" | "deterioration" | "alert", boolean>>({
    protocol: true,
    handoff: true,
    deterioration: true,
    alert: true,
  });
  const [pendingSla, setPendingSla] = useState<Record<string, boolean>>({});
  const [pendingCritical, setPendingCritical] = useState<Record<string, boolean>>({});
  const [pendingDischarge, setPendingDischarge] = useState<Record<string, boolean>>({});
  const [pendingRoute, setPendingRoute] = useState<Record<"NURSE" | "DOCTOR" | "UNIT_COORDINATOR", boolean>>({
    NURSE: false,
    DOCTOR: false,
    UNIT_COORDINATOR: false,
  });
  const [dismissedSla, setDismissedSla] = useState<Record<string, boolean>>({});
  const [dismissedCritical, setDismissedCritical] = useState<Record<string, boolean>>({});
  const [pendingDeterioration, setPendingDeterioration] = useState<Record<string, boolean>>({});
  const [pendingSlaSweep, setPendingSlaSweep] = useState(false);

  const claimSlaEscalation = async (row: {
    encounterId: string;
    missingOwner: boolean;
    missingProvider: boolean;
  }) => {
    setPendingSla((prev) => ({ ...prev, [row.encounterId]: true }));
    try {
      await updateEncounterFlow({
        encounterId: row.encounterId as Id<"encounters">,
        ...(row.missingOwner ? { flowOwner: actorName } : {}),
        ...(row.missingProvider ? { assignedProvider: actorName } : {}),
      });
      setDismissedSla((prev) => ({ ...prev, [row.encounterId]: true }));
      toast.success("Encounter ownership updated.", {
        action: {
          label: "Undo",
          onClick: () => {
            void undoSlaEscalation(row);
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to claim escalation.");
    } finally {
      setPendingSla((prev) => ({ ...prev, [row.encounterId]: false }));
    }
  };

  const acknowledgeCriticalItem = async (item: { kind: string; id: string }) => {
    const key = `${item.kind}:${item.id}`;
    setPendingCritical((prev) => ({ ...prev, [key]: true }));
    try {
      if (item.kind === "lab") {
        await acknowledgeLab({
          labId: item.id as Id<"labResults">,
          staffName: actorName,
        });
      } else if (item.kind === "imaging") {
        await acknowledgeImaging({
          orderId: item.id as Id<"imagingOrders">,
          staffName: actorName,
        });
      } else if (item.kind === "consult") {
        await acknowledgeConsult({
          id: item.id as Id<"teleConsults">,
          staffName: actorName,
        });
      }
      setDismissedCritical((prev) => ({ ...prev, [key]: true }));
      toast.success("Critical item acknowledged.", {
        action: {
          label: "Undo",
          onClick: () => {
            void undoCriticalItem(item);
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to acknowledge item.");
    } finally {
      setPendingCritical((prev) => ({ ...prev, [key]: false }));
    }
  };

  const prepareDischargePacket = async (encounterId: string) => {
    setPendingDischarge((prev) => ({ ...prev, [encounterId]: true }));
    try {
      await ensureDischargeChecklist({ encounterId: encounterId as Id<"encounters"> });
      toast.success("Discharge checklist initialized.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to prepare discharge packet.");
    } finally {
      setPendingDischarge((prev) => ({ ...prev, [encounterId]: false }));
    }
  };

  const undoSlaEscalation = async (row: {
    encounterId: string;
    missingOwner: boolean;
    missingProvider: boolean;
  }) => {
    try {
      await updateEncounterFlow({
        encounterId: row.encounterId as Id<"encounters">,
        ...(row.missingOwner ? { flowOwner: "" } : {}),
        ...(row.missingProvider ? { assignedProvider: "" } : {}),
      });
      setDismissedSla((prev) => ({ ...prev, [row.encounterId]: false }));
      toast.success("Assignment reverted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to undo assignment.");
    }
  };

  const undoCriticalItem = async (item: { kind: string; id: string }) => {
    const key = `${item.kind}:${item.id}`;
    try {
      if (item.kind !== "lab" && item.kind !== "imaging" && item.kind !== "consult") {
        return;
      }
      await undoCriticalAcknowledgement({ kind: item.kind, id: item.id });
      setDismissedCritical((prev) => ({ ...prev, [key]: false }));
      toast.success("Acknowledgment reverted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to undo acknowledgment.");
    }
  };

  const routeAlerts = async (role: "NURSE" | "DOCTOR" | "UNIT_COORDINATOR", count: number) => {
    if (count <= 0) {
      toast.message("No alerts to route for this role.");
      return;
    }
    setPendingRoute((prev) => ({ ...prev, [role]: true }));
    try {
      const result = await routeRoleNotification({
        role,
        message: `${count} operational alert(s) routed by ${actorName}.`,
        suppressionWindowMinutes: intel?.mobileRouting.suppressionWindowMinutes ?? 10,
      });
      if (result.skipped) {
        toast.message(`Suppressed duplicate route to ${role} within ${result.suppressionWindowMinutes}m window.`);
      } else {
        toast.success(`Routed ${count} alert(s) to ${role}.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to route alerts.");
    } finally {
      setPendingRoute((prev) => ({ ...prev, [role]: false }));
    }
  };

  const escalateDeterioration = async (row: {
    encounterId: string;
    patientId?: string;
    patientName: string;
    riskScore: number;
    riskTier: "high" | "medium" | "low";
    reasons: string[];
  }, targetRole: "NURSE" | "DOCTOR" | "UNIT_COORDINATOR") => {
    const key = `${row.encounterId}:${targetRole}`;
    setPendingDeterioration((prev) => ({ ...prev, [key]: true }));
    try {
      await triggerDeteriorationEscalation({
        encounterId: row.encounterId as Id<"encounters">,
        patientName: row.patientName,
        actorName,
        actorRole: "SYSTEM",
        targetRole,
        riskScore: row.riskScore,
        riskTier: row.riskTier,
        reasons: row.reasons,
      });
      toast.success(`Escalated ${row.patientName} to ${targetRole}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to escalate deterioration.");
    } finally {
      setPendingDeterioration((prev) => ({ ...prev, [key]: false }));
    }
  };

  const updateDisposition = async (encounterId: string, flowStage: "admit_ready" | "discharge_ready" | "boarded", dispositionPlan: "admit" | "discharge" | "transfer") => {
    try {
      await updateEncounterFlow({
        encounterId: encounterId as Id<"encounters">,
        flowStage,
        dispositionPlan,
      });
      toast.success(`Disposition set to ${dispositionPlan}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update disposition.");
    }
  };

  const previewSlaSweep = async () => {
    setPendingSlaSweep(true);
    try {
      const result = await runSlaEscalationSweep({ actorName, dryRun: true });
      const first = result.preview.slice(0, 3).map((row) => row.patientName).join(", ");
      toast.message(`SLA preview: ${result.candidateCount} candidate(s).${first ? ` First: ${first}` : ""}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to preview SLA sweep.");
    } finally {
      setPendingSlaSweep(false);
    }
  };

  const executeSlaSweep = async () => {
    setPendingSlaSweep(true);
    try {
      const result = await runSlaEscalationSweep({ actorName, dryRun: false });
      toast.success(`SLA sweep complete: ${result.appliedCount}/${result.candidateCount} encounter(s) assigned.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to run SLA sweep.");
    } finally {
      setPendingSlaSweep(false);
    }
  };

  const visibleSlaEscalations = useMemo(
    () => intel?.slaEscalations.filter((row) => !dismissedSla[row.encounterId]) ?? [],
    [intel?.slaEscalations, dismissedSla]
  );

  const visibleCriticalActionItems = useMemo(
    () =>
      intel?.criticalActionItems.filter((item) => !dismissedCritical[`${item.kind}:${item.id}`]) ?? [],
    [intel?.criticalActionItems, dismissedCritical]
  );

  const filteredReplayEvents = useMemo(() => {
    if (!replay) return [];
    return replay.events.filter((event) => {
      if (event.type !== "protocol" && event.type !== "handoff" && event.type !== "deterioration" && event.type !== "alert") {
        return true;
      }
      return replayTypeFilter[event.type];
    });
  }, [replay, replayTypeFilter]);

  const exportReplayCsv = () => {
    if (!replay || filteredReplayEvents.length === 0) {
      toast.message("No replay events to export.");
      return;
    }

    const headers = ["timestamp", "type", "severity", "title", "detail", "actor", "encounterId", "patientId"];
    const sanitize = (value: unknown) => {
      const text = String(value ?? "").replace(/"/g, '""');
      return `"${text}"`;
    };

    const rows = filteredReplayEvents.map((event) => [
      new Date(event.timestamp).toISOString(),
      event.type,
      event.severity,
      event.title,
      event.detail,
      event.actor,
      event.encounterId ?? "",
      event.patientId ?? "",
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.map((cell) => sanitize(cell)).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `shift-replay-${replay.windowHours}h-${new Date(replay.generatedAt).toISOString().replace(/[:.]/g, "-")}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success("Replay CSV exported.");
  };

  if (!intel) {
    return (
      <Card className="rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-6 text-sm text-slate-500">Loading operations intelligence...</CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-5 rounded-[2.2rem] border border-slate-200 bg-linear-to-br from-white via-sky-50/40 to-cyan-50/30 p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">Operations Intelligence Suite</h2>
        <Badge className="bg-slate-900 text-white">10/10 features live</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><ShieldAlert className="h-4 w-4 text-red-600" /> Deterioration Watchlist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {intel.deteriorationWatchlist.length === 0 ? (
              <p className="text-slate-500">No medium/high risk patients right now.</p>
            ) : (
              intel.deteriorationWatchlist.slice(0, 4).map((row) => (
                <div key={row.encounterId} className="rounded-lg border border-red-200 bg-white px-2 py-1.5 dark:border-red-900/40 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{row.patientName}</span>
                    <Badge className={row.riskTier === "high" ? "bg-red-600 text-white" : "bg-amber-500 text-white"}>{row.riskScore}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{row.reasons.join(" • ") || "Risk trend detected"}</p>
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <Link href={`/patient/${row.patientId}`}>
                      <Button size="sm" variant="outline" className="h-6 text-[10px]">Open Chart</Button>
                    </Link>
                    <Button
                      size="sm"
                      className="h-6 text-[10px] bg-amber-600 text-white hover:bg-amber-700"
                      disabled={pendingDeterioration[`${row.encounterId}:NURSE`]}
                      onClick={() => void escalateDeterioration(row, "NURSE")}
                    >
                      {pendingDeterioration[`${row.encounterId}:NURSE`] ? "Routing..." : "Escalate RN"}
                    </Button>
                    <Button
                      size="sm"
                      className="h-6 text-[10px] bg-red-600 text-white hover:bg-red-700"
                      disabled={pendingDeterioration[`${row.encounterId}:DOCTOR`]}
                      onClick={() => void escalateDeterioration(row, "DOCTOR")}
                    >
                      {pendingDeterioration[`${row.encounterId}:DOCTOR`] ? "Routing..." : "Escalate MD"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Ambulance className="h-4 w-4 text-blue-600" /> Disposition Command Center</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <Badge className="justify-center bg-blue-600 text-white">Admit Ready: {intel.disposition.admitReady}</Badge>
              <Badge className="justify-center bg-emerald-600 text-white">Discharge Ready: {intel.disposition.dischargeReady}</Badge>
              <Badge className="justify-center bg-amber-500 text-white">Boarded: {intel.disposition.boarded}</Badge>
              <Badge className="justify-center bg-slate-700 text-white">Undecided: {intel.disposition.undecided}</Badge>
            </div>

            <div className="space-y-2">
              {intel.dispositionCandidates.length === 0 ? (
                <p className="text-slate-500">No disposition candidates.</p>
              ) : (
                intel.dispositionCandidates.slice(0, 4).map((row) => (
                  <div key={row.encounterId} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-700 dark:text-slate-200">{row.patientName}</p>
                        <p className="text-[11px] text-slate-500">{row.nextAction} · {row.stageAgeMinutes}m</p>
                      </div>
                      <Badge className={row.isBoarded ? "bg-amber-500 text-white" : row.isDischargeReady ? "bg-emerald-600 text-white" : row.isAdmitReady ? "bg-blue-600 text-white" : "bg-slate-700 text-white"}>
                        {row.flowStage.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                      <Link href={`/patient/${row.patientId}`}>
                        <Button size="sm" variant="outline" className="h-6 text-[10px]">Chart</Button>
                      </Link>
                      <Button size="sm" className="h-6 text-[10px]" onClick={() => void updateDisposition(row.encounterId, "admit_ready", "admit")}>
                        Admit
                      </Button>
                      <Button size="sm" className="h-6 text-[10px]" onClick={() => void updateDisposition(row.encounterId, "discharge_ready", "discharge")}>
                        Discharge
                      </Button>
                      <Button size="sm" className="h-6 text-[10px]" onClick={() => void updateDisposition(row.encounterId, "boarded", "transfer")}>
                        Boarded
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2"><Timer className="h-4 w-4 text-amber-600" /> SLA Escalations</span>
              <span className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" disabled={pendingSlaSweep} onClick={() => void previewSlaSweep()}>
                  {pendingSlaSweep ? "Working..." : "Preview Sweep"}
                </Button>
                <Button type="button" size="sm" className="h-6 text-[10px]" disabled={pendingSlaSweep} onClick={() => void executeSlaSweep()}>
                  {pendingSlaSweep ? "Working..." : "Run Sweep"}
                </Button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {visibleSlaEscalations.length === 0 ? <p className="text-slate-500">No current SLA breaches.</p> : visibleSlaEscalations.slice(0, 4).map((row) => (
              <div key={row.encounterId} className="rounded-lg border border-amber-200 bg-white px-2 py-1.5 dark:border-amber-900/40 dark:bg-slate-900/70">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{row.patientName}</span>
                  <Badge className={row.severity === "critical" ? "bg-red-600 text-white" : "bg-amber-500 text-white"}>{row.stageAgeMinutes}m</Badge>
                </div>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <Link href={`/patient/${row.patientId}`}>
                    <Button size="sm" variant="outline" className="h-6 text-[10px]">Chart</Button>
                  </Link>
                  <Button
                    size="sm"
                    className="h-6 text-[10px]"
                    disabled={pendingSla[row.encounterId]}
                    onClick={() => void claimSlaEscalation(row)}
                  >
                    {pendingSla[row.encounterId] ? "Assigning..." : "Auto-Assign Me"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><ClipboardCheck className="h-4 w-4 text-emerald-600" /> Closed-Loop Critical Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
            <Badge variant="outline">Labs: {intel.closedLoop.openCriticalLabs}</Badge>
            <Badge variant="outline">Imaging: {intel.closedLoop.openImagingReads}</Badge>
            <Badge variant="outline">Consults: {intel.closedLoop.openConsultCallbacks}</Badge>
            <Badge className="bg-slate-900 text-white">Total Open: {intel.closedLoop.totalOpen}</Badge>
            </div>
            <div className="space-y-2">
              {visibleCriticalActionItems.length === 0 ? (
                <p className="text-slate-500">No actionable critical items.</p>
              ) : (
                visibleCriticalActionItems.slice(0, 4).map((item) => (
                  <div key={`${item.kind}-${item.id}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900/70">
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{item.title}</p>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      {item.patientId ? (
                        <Link href={`/patient/${item.patientId}`}>
                          <Button size="sm" variant="outline" className="h-6 text-[10px]">Chart</Button>
                        </Link>
                      ) : null}
                      <Button
                        size="sm"
                        className="h-6 text-[10px]"
                        disabled={pendingCritical[`${item.kind}:${item.id}`]}
                        onClick={() => void acknowledgeCriticalItem(item)}
                      >
                        {pendingCritical[`${item.kind}:${item.id}`] ? "Saving..." : "Acknowledge"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-cyan-200 bg-cyan-50/60 dark:border-cyan-900/40 dark:bg-cyan-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-cyan-700" /> Predictive Staffing Heatmap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <p>Active staff: <strong>{intel.staffingHeatmap.activeStaffCount}</strong></p>
            <p>Arrivals (last hour): <strong>{intel.staffingHeatmap.arrivalsLastHour}</strong></p>
            <p>High acuity load: <strong>{intel.staffingHeatmap.highAcuityCount}</strong></p>
            <p className="font-semibold text-cyan-800 dark:text-cyan-300">{intel.staffingHeatmap.recommendation}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Waves className="h-4 w-4 text-blue-700" /> Bed Turnover Optimizer v2</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {intel.bedOptimizer.slice(0, 4).map((row) => (
              <div key={row.encounterId} className="flex items-center justify-between rounded-lg border border-blue-200 bg-white px-2 py-1.5 dark:border-blue-900/40 dark:bg-slate-900/70">
                <span className="font-semibold">{row.bedLabel}</span>
                <span>{row.etaMinutes}m · {Math.round(row.confidence * 100)}%</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><CheckCheckIcon /> Smart Discharge Packet Automation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {intel.dischargeAutomation.length === 0 ? (
              <p className="text-slate-500">No discharge-ready patients in queue.</p>
            ) : (
              intel.dischargeAutomation.slice(0, 4).map((row) => (
                <div key={row.encounterId} className="rounded-lg border border-emerald-200 bg-white px-2 py-1.5 dark:border-emerald-900/40 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{row.patientName}</span>
                    <Badge className={row.packetReady ? "bg-emerald-600 text-white" : "bg-slate-700 text-white"}>{row.checklistCompletionPercent}%</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px]"
                      disabled={pendingDischarge[row.encounterId]}
                      onClick={() => void prepareDischargePacket(row.encounterId)}
                    >
                      {pendingDischarge[row.encounterId] ? "Preparing..." : "Prep Packet"}
                    </Button>
                    <Link href={`/patient/${row.patientId}`}>
                      <Button size="sm" className="h-6 text-[10px]">Open</Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Siren className="h-4 w-4 text-violet-600" /> Quality Scorecards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Badge variant="outline">Sepsis 24h: {intel.qualityScorecards.sepsisBundleActivations24h}</Badge>
              <Badge variant="outline">Stroke 24h: {intel.qualityScorecards.strokeAlertActivations24h}</Badge>
              <Badge variant="outline">Handoffs 24h: {intel.qualityScorecards.handoffAcceptance24h}</Badge>
              <Badge className="bg-red-600 text-white">Open Critical: {intel.qualityScorecards.openCriticalResults}</Badge>
              <Badge className="bg-slate-900 text-white">Closed Loop: {Math.round(intel.qualityScorecards.overallClosedLoopRate * 100)}%</Badge>
              <Badge className="bg-slate-900 text-white">Boarding: {Math.round(intel.qualityScorecards.boardingRate * 100)}%</Badge>
            </div>

            <div className="space-y-2">
              {intel.qualityBenchmarks.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-3.5 w-3.5 text-slate-500" />
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{metric.label}</span>
                    </div>
                    <Badge
                      className={
                        metric.status === "on_track"
                          ? "bg-emerald-600 text-white"
                          : metric.status === "watch"
                            ? "bg-amber-500 text-white"
                            : "bg-red-600 text-white"
                      }
                    >
                      {metric.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${metric.status === "on_track" ? "bg-emerald-600" : metric.status === "watch" ? "bg-amber-500" : "bg-red-600"}`}
                      style={{ width: `${Math.min(100, Math.round(metric.value * 100))}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{Math.round(metric.value * 100)}%</span>
                    <span>Target {Math.round(metric.target * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-fuchsia-200 bg-fuchsia-50/60 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><BellRing className="h-4 w-4 text-fuchsia-700" /> Role-Based Mobile Routing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <Badge className="justify-center bg-slate-900 text-white">RN: {intel.mobileRouting.toNurse}</Badge>
              <Badge className="justify-center bg-slate-900 text-white">MD: {intel.mobileRouting.toDoctor}</Badge>
              <Badge className="justify-center bg-slate-900 text-white">UC: {intel.mobileRouting.toUnitCoordinator}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                className="h-7 text-[10px]"
                disabled={pendingRoute.NURSE}
                onClick={() => void routeAlerts("NURSE", intel.mobileRouting.toNurse)}
              >
                {pendingRoute.NURSE ? "Routing..." : "Route RN"}
              </Button>
              <Button
                size="sm"
                className="h-7 text-[10px]"
                disabled={pendingRoute.DOCTOR}
                onClick={() => void routeAlerts("DOCTOR", intel.mobileRouting.toDoctor)}
              >
                {pendingRoute.DOCTOR ? "Routing..." : "Route MD"}
              </Button>
              <Button
                size="sm"
                className="h-7 text-[10px]"
                disabled={pendingRoute.UNIT_COORDINATOR}
                onClick={() => void routeAlerts("UNIT_COORDINATOR", intel.mobileRouting.toUnitCoordinator)}
              >
                {pendingRoute.UNIT_COORDINATOR ? "Routing..." : "Route UC"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-950/20 xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Cpu className="h-4 w-4 text-indigo-700" /> Simulation + Replay Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={replayWindowHours === 4 ? "default" : "outline"}
                  className="h-7 text-[10px]"
                  onClick={() => setReplayWindowHours(4)}
                >
                  4h
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={replayWindowHours === 8 ? "default" : "outline"}
                  className="h-7 text-[10px]"
                  onClick={() => setReplayWindowHours(8)}
                >
                  8h
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={replayWindowHours === 24 ? "default" : "outline"}
                  className="h-7 text-[10px]"
                  onClick={() => setReplayWindowHours(24)}
                >
                  24h
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Events: {replay?.stats.eventCount ?? 0}</Badge>
                <Badge className="bg-red-600 text-white">Critical: {replay?.stats.criticalEvents ?? 0}</Badge>
                <Badge className="bg-amber-500 text-white">Bottlenecks: {replay?.stats.bottleneckCount ?? 0}</Badge>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={exportReplayCsv}>
                  Export CSV
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={replayTypeFilter.protocol ? "default" : "outline"}
                className="h-7 text-[10px]"
                onClick={() => setReplayTypeFilter((prev) => ({ ...prev, protocol: !prev.protocol }))}
              >
                Protocol
              </Button>
              <Button
                type="button"
                size="sm"
                variant={replayTypeFilter.handoff ? "default" : "outline"}
                className="h-7 text-[10px]"
                onClick={() => setReplayTypeFilter((prev) => ({ ...prev, handoff: !prev.handoff }))}
              >
                Handoff
              </Button>
              <Button
                type="button"
                size="sm"
                variant={replayTypeFilter.deterioration ? "default" : "outline"}
                className="h-7 text-[10px]"
                onClick={() => setReplayTypeFilter((prev) => ({ ...prev, deterioration: !prev.deterioration }))}
              >
                Deterioration
              </Button>
              <Button
                type="button"
                size="sm"
                variant={replayTypeFilter.alert ? "default" : "outline"}
                className="h-7 text-[10px]"
                onClick={() => setReplayTypeFilter((prev) => ({ ...prev, alert: !prev.alert }))}
              >
                Alerts
              </Button>
            </div>

            {!replay ? (
              <p className="text-slate-500">Loading replay timeline...</p>
            ) : filteredReplayEvents.length === 0 ? (
              <p className="text-slate-500">No replayable events in the last {replay.windowHours} hours.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                <div className="space-y-1.5">
                  {filteredReplayEvents.slice(0, 8).map((event, idx) => (
                    <div key={`${event.timestamp}-${idx}`} className="rounded-lg border border-indigo-200 bg-white px-2 py-1.5 dark:border-indigo-900/40 dark:bg-slate-900/70">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{event.title}</span>
                        <Badge className={event.severity === "critical" ? "bg-red-600 text-white" : event.severity === "attention" ? "bg-amber-500 text-white" : event.severity === "success" ? "bg-emerald-600 text-white" : "bg-slate-700 text-white"}>
                          {event.type}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">{event.detail}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Current Bottlenecks</p>
                  {replay.bottlenecks.length === 0 ? (
                    <p className="text-slate-500">No active bottlenecks above threshold.</p>
                  ) : (
                    replay.bottlenecks.map((item) => (
                      <div key={item.encounterId} className="rounded-lg border border-amber-200 bg-white px-2 py-1.5 dark:border-amber-900/40 dark:bg-slate-900/70">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{item.patientName}</span>
                          <Badge className="bg-amber-500 text-white">{item.stageAgeMinutes}m</Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">{item.flowStage.replaceAll("_", " ")} · {item.delayReason.replaceAll("_", " ")}</p>
                        <div className="mt-2 flex justify-end">
                          <Link href={`/patient/${item.patientId}`}>
                            <Button size="sm" variant="outline" className="h-6 text-[10px]">Open Chart</Button>
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        Last refresh: {new Date(intel.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
    </section>
  );
}

function CheckCheckIcon() {
  return <AlertTriangle className="h-4 w-4 text-emerald-700" />;
}
