"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCheck, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

interface LabAlert {
  _id: Id<"labResults">;
  testName: string;
  value: string;
  unit: string;
  criticalStatus?: "new" | "acknowledged" | "escalated" | "resolved";
  criticalEscalatedRole?: "NURSE" | "DOCTOR" | "ADMIN";
  criticalRaisedAt?: number;
  acknowledgedAt?: number;
}

export default function CriticalLabBanner({
  alerts,
  actorName,
}: {
  alerts: LabAlert[];
  actorName?: string;
}) {
  const acknowledge = useMutation(api.labs.acknowledgeLab);
  const resolveCriticalLab = useMutation(api.labs.resolveCriticalLab);
  const [actionNote, setActionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    if (alerts.length === 0) return;
    const intervalId = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(intervalId);
  }, [alerts.length]);

  if (alerts.length === 0) return null;

  const escalatedCount = alerts.filter((alert) => alert.criticalStatus === "escalated").length;
  const acknowledgedCount = alerts.filter((alert) => alert.criticalStatus === "acknowledged").length;

  const getStatusLabel = (status: LabAlert["criticalStatus"]) => {
    if (status === "acknowledged") return "acknowledged";
    if (status === "escalated") return "escalated";
    return "new";
  };

  const getStatusClasses = (status: LabAlert["criticalStatus"]) => {
    if (status === "acknowledged") return "bg-amber-100 text-amber-700 border-amber-200";
    if (status === "escalated") return "bg-red-100 text-red-700 border-red-200";
    return "bg-rose-100 text-rose-700 border-rose-200";
  };

  const toMinutesAgo = (timestamp?: number) => {
    if (!timestamp) return null;
    const minutes = Math.max(0, Math.floor((nowTs - timestamp) / 60_000));
    return `${minutes}m ago`;
  };

  const toAckLatency = (raisedAt?: number, acknowledgedAt?: number) => {
    if (!raisedAt || !acknowledgedAt) return null;
    const minutes = Math.max(0, Math.floor((acknowledgedAt - raisedAt) / 60_000));
    return `${minutes}m to ack`;
  };

  const handleAcknowledgeOne = async (labId: Id<"labResults">) => {
    setIsSubmitting(true);
    try {
      await acknowledge({
        labId,
        staffName: actorName || "Clinical Staff",
        note: "Reviewed in patient chart.",
      });
      toast.success("Critical result acknowledged.");
    } catch (error) {
      toast.error("Error acknowledging lab result.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveOne = async (labId: Id<"labResults">) => {
    const note = actionNote.trim();
    if (!note) {
      toast.error("Action note required before resolving critical labs.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resolveCriticalLab({
        labId,
        staffName: actorName || "Clinical Staff",
        note,
      });
      toast.success("Critical result resolved.");
    } catch (error) {
      toast.error("Error resolving lab result.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledgeAll = async () => {
    const labsNeedingAck = alerts.filter((lab) => lab.criticalStatus !== "acknowledged");
    if (labsNeedingAck.length === 0) {
      toast.info("All listed critical labs are already acknowledged.");
      return;
    }

    setIsSubmitting(true);
    try {
      await Promise.all(
        labsNeedingAck.map((lab) =>
          acknowledge({
            labId: lab._id,
            staffName: actorName || "Clinical Staff",
            note: "Reviewed in patient chart.",
          })
        )
      );
      toast.success("Critical labs acknowledged and logged to chart.");
    } catch (error) {
      toast.error("Error acknowledging lab results.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveAll = async () => {
    const note = actionNote.trim();
    if (!note) {
      toast.error("Action note required before resolving critical labs.");
      return;
    }

    setIsSubmitting(true);
    try {
      await Promise.all(
        alerts.map((lab) =>
          resolveCriticalLab({
            labId: lab._id,
            staffName: actorName || "Clinical Staff",
            note,
          })
        )
      );
      setActionNote("");
      toast.success("Critical labs resolved with action note.");
    } catch (error) {
      toast.error("Error resolving critical labs.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Alert 
      variant="destructive" 
      className="border-2 border-red-600 bg-red-50 animate-in slide-in-from-top-4 duration-500 rounded-2xl shadow-lg mb-6"
    >
      <AlertCircle className="h-5 w-5" />
      <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="pr-4">
          <AlertTitle className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">
            Critical Lab Result Alert
          </AlertTitle>
          <AlertDescription className="text-xs font-bold text-red-900 leading-tight">
            {alerts.length} abnormal result(s) detected:{" "}
            <span className="font-black">
              {alerts.map((a, i) => (
                <span key={a._id}>
                  {a.testName} ({a.value} {a.unit}){i < alerts.length - 1 ? ", " : ""}
                </span>
              ))}
            </span>
            {escalatedCount > 0 ? ` ${escalatedCount} already escalated.` : ""}
            {acknowledgedCount > 0 ? ` ${acknowledgedCount} already acknowledged.` : ""}
          </AlertDescription>
        </div>

        <div className="w-full max-w-lg space-y-2">
          <Textarea
            value={actionNote}
            onChange={(event) => setActionNote(event.target.value)}
            placeholder="Required clinical action note for resolution (for example: potassium replacement started, repeat BMP ordered)."
            className="min-h-18 border-red-200 bg-white text-xs font-semibold text-red-900 placeholder:text-red-400"
          />
          <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-red-200 bg-white p-2">
            {alerts.map((lab) => (
              <div key={lab._id} className="flex items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50/60 p-2">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-black uppercase tracking-wide text-red-900">
                    {lab.testName}: {lab.value} {lab.unit}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`h-5 border text-[9px] uppercase tracking-wide ${getStatusClasses(lab.criticalStatus)}`}>
                    {lab.criticalStatus === "escalated" && lab.criticalEscalatedRole
                      ? `${getStatusLabel(lab.criticalStatus)} ${lab.criticalEscalatedRole}`
                      : getStatusLabel(lab.criticalStatus)}
                  </Badge>
                  {toMinutesAgo(lab.criticalRaisedAt) && (
                    <Badge className="h-5 border border-red-200 bg-white text-[9px] uppercase tracking-wide text-red-700">
                      Open {toMinutesAgo(lab.criticalRaisedAt)}
                    </Badge>
                  )}
                  {toAckLatency(lab.criticalRaisedAt, lab.acknowledgedAt) && (
                    <Badge className="h-5 border border-amber-200 bg-amber-50 text-[9px] uppercase tracking-wide text-amber-700">
                      {toAckLatency(lab.criticalRaisedAt, lab.acknowledgedAt)}
                    </Badge>
                  )}
                  <Button
                    onClick={() => void handleAcknowledgeOne(lab._id)}
                    size="sm"
                    variant="destructive"
                    disabled={isSubmitting || lab.criticalStatus === "acknowledged"}
                    className="h-7 px-2 text-[9px] font-black uppercase tracking-wider"
                  >
                    Ack
                  </Button>
                  <Button
                    onClick={() => void handleResolveOne(lab._id)}
                    size="sm"
                    disabled={isSubmitting || !actionNote.trim()}
                    className="h-7 bg-emerald-700 px-2 text-[9px] font-black uppercase tracking-wider text-white hover:bg-emerald-800"
                  >
                    Resolve
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              onClick={handleAcknowledgeAll}
              size="sm"
              variant="destructive"
              disabled={isSubmitting}
              className="h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2 bg-red-600 hover:bg-red-700 shadow-md transition-all active:scale-95 shrink-0"
            >
              <CheckCheck className="h-4 w-4" /> Acknowledge All
            </Button>
            <Button
              onClick={handleResolveAll}
              size="sm"
              disabled={isSubmitting || !actionNote.trim()}
              className="h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2 bg-emerald-700 text-white hover:bg-emerald-800 shadow-md transition-all active:scale-95 shrink-0 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" /> Resolve All
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  );
}