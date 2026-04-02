"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { AlertTriangle, CheckCheck, Microscope, ScanLine, Stethoscope, UserRound } from "lucide-react";
import { toast } from "sonner";

function alertIcon(kind: "room" | "lab" | "imaging" | "consult" | "assignment") {
  if (kind === "room") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  if (kind === "lab") return <Microscope className="h-4 w-4 text-red-600" />;
  if (kind === "imaging") return <ScanLine className="h-4 w-4 text-blue-600" />;
  if (kind === "assignment") return <UserRound className="h-4 w-4 text-emerald-600" />;
  return <Stethoscope className="h-4 w-4 text-violet-600" />;
}

export default function OperationalAlertsPanel({ encounterId }: { encounterId?: Id<"encounters"> }) {
  const { actorName, actorRole } = useResolvedActor();
  const alerts = useQuery(api.workflow.getOperationalAlerts, { encounterId });
  const assignmentRecommendations = useQuery(api.workflow.getAssignmentRecommendations);
  const acknowledgeLab = useMutation(api.labs.acknowledgeLab);
  const acknowledgeImaging = useMutation(api.imaging.acknowledgeResult);
  const acknowledgeConsult = useMutation(api.consults.acknowledge);
  const updateBoarding = useMutation(api.encounters.updateBoardingWorkflow);
  const updateEncounterFlow = useMutation(api.encounters.updateEncounterFlow);

  const recommendedFlowOwner = assignmentRecommendations?.flowOwner ?? null;
  const recommendedProvider = assignmentRecommendations?.assignedProvider ?? null;
  const recommendedFallback = recommendedProvider ?? recommendedFlowOwner ?? null;

  const handleAcknowledge = async (alert: NonNullable<typeof alerts>[number]) => {
    try {
      if (alert.kind === "room" && alert.encounterId) {
        await updateBoarding({
          encounterId: alert.encounterId as Id<"encounters">,
          roomTurnoverStatus: alert.roomTurnoverStatus === "cleaning" ? "ready" : "cleaning",
        });

        toast.success("Room turnover updated");
        return;
      }

      if (alert.kind === "lab" && alert.labId) {
        await acknowledgeLab({ labId: alert.labId as Id<"labResults">, staffName: `${actorName} (${actorRole})` });
      }

      if (alert.kind === "imaging" && alert.imagingOrderId) {
        await acknowledgeImaging({ orderId: alert.imagingOrderId as Id<"imagingOrders">, staffName: `${actorName} (${actorRole})` });
      }

      if (alert.kind === "consult" && alert.consultId) {
        await acknowledgeConsult({ id: alert.consultId as Id<"teleConsults">, staffName: `${actorName} (${actorRole})` });
      }

      if (alert.kind === "assignment" && alert.encounterId) {
        const targetName = alert.missingOwner && !alert.missingProvider
          ? recommendedFlowOwner?.name ?? recommendedFallback?.name ?? actorName
          : alert.missingProvider && !alert.missingOwner
            ? recommendedProvider?.name ?? recommendedFallback?.name ?? actorName
            : recommendedFlowOwner?.name ?? recommendedProvider?.name ?? recommendedFallback?.name ?? actorName;

        await updateEncounterFlow({
          encounterId: alert.encounterId as Id<"encounters">,
          ...(alert.missingOwner && !alert.missingProvider
            ? { flowOwner: targetName }
            : alert.missingProvider && !alert.missingOwner
              ? { assignedProvider: targetName }
              : { flowOwner: targetName, assignedProvider: targetName }),
        });
        toast.success(`Encounter claimed by ${targetName}.`);
        return;
      }

      toast.success("Alert acknowledged");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to acknowledge alert.";
      toast.error(message);
    }
  };

  return (
    <Card className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70 pb-4 dark:border-slate-800 dark:bg-slate-950/40">
        <CardTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-200">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          {encounterId ? "Encounter Alerts" : "Operational Alerts"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {!alerts || alerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-500">
            No open alerts
          </div>
        ) : (
          alerts.slice(0, encounterId ? 6 : 8).map((alert) => (
            <div key={`${alert.kind}-${alert.createdAt}-${alert.title}`} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    {alertIcon(alert.kind)}
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">{alert.title}</p>
                    <Badge className={`${alert.severity === "critical" ? "bg-red-600" : "bg-amber-500"} text-white`}>
                      {alert.severity}
                    </Badge>
                  </div>
                  {!encounterId && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{alert.patientName}</span>
                      <Link href={`/patient/${alert.patientId}`} className="text-[10px] font-black uppercase tracking-wide text-blue-600 hover:text-blue-500">
                        Open Chart
                      </Link>
                    </div>
                  )}
                  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{alert.detail}</p>
                  {alert.kind === "assignment" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge className="border border-emerald-200 bg-emerald-50 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                        {alert.missingOwner && alert.missingProvider
                          ? "Needs owner and provider"
                          : alert.missingOwner
                            ? "Needs owner"
                            : "Needs provider"}
                      </Badge>
                      <Badge className="border border-slate-200 bg-slate-50 text-[9px] font-black uppercase tracking-widest text-slate-600">
                        Suggested: {alert.missingOwner && !alert.missingProvider
                          ? recommendedFlowOwner?.name ?? recommendedFallback?.name ?? actorName
                          : alert.missingProvider && !alert.missingOwner
                            ? recommendedProvider?.name ?? recommendedFallback?.name ?? actorName
                            : recommendedFlowOwner?.name ?? recommendedProvider?.name ?? recommendedFallback?.name ?? actorName}
                      </Badge>
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={() => void handleAcknowledge(alert)}
                  className="rounded-full bg-slate-900 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                >
                  {alert.kind === "room" ? (
                    <>
                      <CheckCheck className="mr-1 h-3.5 w-3.5" />
                      {alert.roomTurnoverStatus === "cleaning" ? "Mark Ready" : "Start Cleaning"}
                    </>
                  ) : alert.kind === "assignment" ? (
                    <>
                      <CheckCheck className="mr-1 h-3.5 w-3.5" /> Claim Recommended
                    </>
                  ) : (
                    <>
                      <CheckCheck className="mr-1 h-3.5 w-3.5" /> Ack
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
