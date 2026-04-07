"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import { LogOut, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Doc, Id } from "@/convex/_generated/dataModel";

interface ProviderWorkload {
  name: string;
  assignedCount: number;
  highAcuityCount: number;
  acuityWeightedLoad: number;
  blockedCount: number;
  readyDischargeCount: number;
  openAlertCount: number;
}

export function SignOutPanel({ userId, userName, userRole }: { userId: string; userName: string; userRole: string }) {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState<Set<Id<"encounters">>>(new Set());
  const [signOutNotes, setSignOutNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const initiateHandoff = useMutation(api.workflow.initiateShiftHandoff);
  const workloads = useQuery(api.workflow.getProviderWorkload, {}) as ProviderWorkload[] | null;
  const activeEncounters = useQuery(api.encounters.getActive) as Doc<"encounters">[] | undefined;

  if (!workloads) return null;

  const assignedEncounters = useMemo(
    () =>
      (activeEncounters ?? []).filter((encounter) => {
        const assignedProvider = encounter.assignedProvider?.trim();
        const flowOwner = encounter.flowOwner?.trim();
        return assignedProvider === userName || flowOwner === userName;
      }),
    [activeEncounters, userName]
  );

  // Find current user's workload summary
  const currentWorkload = workloads.find((w) => w.name === userName || w.name === userId);

  useEffect(() => {
    if (!showDialog) return;

    const validIds = new Set(assignedEncounters.map((encounter) => encounter._id));
    setSelectedPatients((current) => {
      const next = new Set<Id<"encounters">>();
      current.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [assignedEncounters, showDialog]);

  const toggleSelectedEncounter = (encounterId: Id<"encounters">) => {
    setSelectedPatients((current) => {
      const next = new Set(current);
      if (next.has(encounterId)) {
        next.delete(encounterId);
      } else {
        next.add(encounterId);
      }
      return next;
    });
  };

  const handleSignOut = async () => {
    if (selectedPatients.size === 0) {
      toast.error("Select at least one patient to sign out");
      return;
    }

    setIsProcessing(true);
    try {
      const patientIds = Array.from(selectedPatients) as Id<"encounters">[];
      await initiateHandoff({
        fromUserId: userId as Id<"users">,
        fromUserName: userName,
        fromUserRole: userRole,
        patientEncounterIds: patientIds,
        notes: signOutNotes || undefined,
      });

      toast.success(
        `Handoff initiated for ${selectedPatients.size} patient${selectedPatients.size !== 1 ? "s" : ""}`
      );
      setShowDialog(false);
      setSelectedPatients(new Set());
      setSignOutNotes("");
    } catch (error) {
      toast.error("Failed to initiate handoff");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Sign Out</CardTitle>
            <Badge variant={currentWorkload && currentWorkload.assignedCount > 0 ? "default" : "secondary"}>
              {currentWorkload?.assignedCount || 0} patient{currentWorkload?.assignedCount !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!currentWorkload || currentWorkload.assignedCount === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No active patients assigned to you
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-gray-600 mb-3">
                Ready to sign out? Click below to select patients and initiate handoff.
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-2">
                <p className="text-sm font-semibold text-blue-900">Your Current Load</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Patients:</span>{" "}
                    <span className="font-semibold">{currentWorkload.assignedCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">High Acuity:</span>{" "}
                    <span className="font-semibold">{currentWorkload.highAcuityCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Open Alerts:</span>{" "}
                    <span className="font-semibold">{currentWorkload.openAlertCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Blocked:</span>{" "}
                    <span className="font-semibold">{currentWorkload.blockedCount}</span>
                  </div>
                </div>
              </div>

              <Button
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  if (assignedEncounters.length === 0) {
                    toast.error("No assigned encounters found for handoff");
                    return;
                  }

                  setSelectedPatients(new Set(assignedEncounters.map((encounter) => encounter._id)));
                  setShowDialog(true);
                }}
                disabled={assignedEncounters.length === 0}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Initiate Handoff
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sign Out Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initiate Handoff</DialogTitle>
            <DialogDescription>
              Enter patient encounter IDs to hand off and add notes for the incoming provider.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-blue-900 mb-2">To use this feature:</p>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Select patients from your assignment queue or dashboard</li>
                <li>• They will be marked for handoff with the incoming provider details</li>
                <li>• The provider will receive a handoff notification to accept/reject</li>
              </ul>
            </div>

            <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
              {assignedEncounters.length === 0 ? (
                <p className="text-xs text-slate-500">No assigned encounters are currently eligible for handoff.</p>
              ) : (
                assignedEncounters.map((encounter) => {
                  const isSelected = selectedPatients.has(encounter._id);
                  return (
                    <label
                      key={encounter._id}
                      className="flex cursor-pointer items-start gap-2 rounded border border-transparent bg-white p-2 text-xs transition-colors hover:border-blue-200"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectedEncounter(encounter._id)}
                        className="mt-0.5"
                      />
                      <span className="flex-1">
                        <span className="block font-semibold text-slate-800">{encounter.patientName}</span>
                        <span className="block text-slate-500">ESI {encounter.acuity} • {encounter.chiefComplaint}</span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <Textarea
              placeholder="Sign-out notes (optional - include key findings, recent changes, pending orders, etc.)..."
              value={signOutNotes}
              onChange={(e) => setSignOutNotes(e.target.value)}
              className="min-h-24"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleSignOut}
              disabled={isProcessing || selectedPatients.size === 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Initiating...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-2" />
                  Initiate Handoff
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
