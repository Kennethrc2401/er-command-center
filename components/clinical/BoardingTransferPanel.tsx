"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import type { Doc } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BedDouble, Truck } from "lucide-react";
import { toast } from "sonner";

type EncounterWorkflowProps = Pick<Doc<"encounters">, "_id" | "assignedInpatientUnit" | "inpatientBedLabel" | "transportStatus" | "roomTurnoverStatus" | "admitAcceptedAt" | "inpatientBedRequestedAt" | "inpatientBedAssignedAt" | "handoffCompletedAt">;

export default function BoardingTransferPanel({ encounter }: { encounter: EncounterWorkflowProps }) {
  const updateBoarding = useMutation(api.encounters.updateBoardingWorkflow);
  const [assignedInpatientUnit, setAssignedInpatientUnit] = useState(encounter.assignedInpatientUnit ?? "");
  const [inpatientBedLabel, setInpatientBedLabel] = useState(encounter.inpatientBedLabel ?? "");
  const [transportStatus, setTransportStatus] = useState(encounter.transportStatus ?? "not_requested");
  const [roomTurnoverStatus, setRoomTurnoverStatus] = useState(encounter.roomTurnoverStatus ?? "not_started");

  const saveContext = async () => {
    await updateBoarding({
      encounterId: encounter._id,
      assignedInpatientUnit,
      inpatientBedLabel,
      transportStatus: transportStatus as "not_requested" | "requested" | "in_progress" | "completed",
      roomTurnoverStatus: roomTurnoverStatus as "not_started" | "cleaning" | "ready",
    });
    toast.success("Boarding workflow updated");
  };

  return (
    <Card className="overflow-hidden rounded-[2rem] border border-violet-200 bg-white shadow-sm dark:border-violet-900/40 dark:bg-slate-900">
      <CardHeader className="border-b border-violet-200 bg-violet-50/60 pb-4 dark:border-violet-900/40 dark:bg-violet-950/20">
        <CardTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">
          <BedDouble className="h-4 w-4" /> Boarding & Transfer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Inpatient Unit</Label>
            <Input value={assignedInpatientUnit} onChange={(event) => setAssignedInpatientUnit(event.target.value)} placeholder="Telemetry / ICU / 4 West" />
          </div>
          <div className="space-y-1.5">
            <Label>Assigned Inpatient Bed</Label>
            <Input value={inpatientBedLabel} onChange={(event) => setInpatientBedLabel(event.target.value)} placeholder="4W-12B" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Transport Status</Label>
            <Select value={transportStatus} onValueChange={(value) => setTransportStatus(value as "not_requested" | "requested" | "in_progress" | "completed")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_requested">Not Requested</SelectItem>
                <SelectItem value="requested">Requested</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Room Turnover</Label>
            <Select value={roomTurnoverStatus} onValueChange={(value) => setRoomTurnoverStatus(value as "not_started" | "cleaning" | "ready")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="cleaning">Cleaning</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Button type="button" variant="outline" onClick={() => void updateBoarding({ encounterId: encounter._id, markAdmitAccepted: true })}>Admit Accepted</Button>
          <Button type="button" variant="outline" onClick={() => void updateBoarding({ encounterId: encounter._id, markInpatientBedRequested: true })}>Bed Requested</Button>
          <Button type="button" variant="outline" onClick={() => void updateBoarding({ encounterId: encounter._id, markInpatientBedAssigned: true })}>Bed Assigned</Button>
          <Button type="button" variant="outline" onClick={() => void updateBoarding({ encounterId: encounter._id, markHandoffCompleted: true, transportStatus: "completed" })}>Handoff Done</Button>
        </div>

        <Button type="button" className="w-full bg-violet-600 text-white hover:bg-violet-700" onClick={() => void saveContext()}>
          <Truck className="mr-2 h-4 w-4" /> Save Boarding Context
        </Button>
      </CardContent>
    </Card>
  );
}
