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
import { useState } from "react";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export function TriageReassessmentPanel({ encounterId, currentAcuity }: { encounterId: string; currentAcuity: number }) {
  const encounterId_ = encounterId as Id<"encounters">;
  const history = useQuery(api.workflow.getTriageReassessmentHistory, { encounterId: encounterId_ });
  const reassessTriage = useMutation(api.workflow.reassessTriage);

  const [showDialog, setShowDialog] = useState(false);
  const [newAcuity, setNewAcuity] = useState<number>(currentAcuity);
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleReassessment = async () => {
    if (newAcuity === currentAcuity && !notes.trim()) {
      toast.error("Enter acuity change or notes");
      return;
    }

    setIsProcessing(true);
    try {
      await reassessTriage({
        encounterId: encounterId_,
        newAcuity,
        reassessmentPhase: (history?.length || 0) + 1,
        reassessedBy: "Current User",
        notes: notes || undefined,
      });

      toast.success(
        newAcuity !== currentAcuity
          ? `Acuity updated from ESI ${currentAcuity} to ESI ${newAcuity}`
          : "Reassessment recorded"
      );
      setShowDialog(false);
      setNewAcuity(currentAcuity);
      setNotes("");
    } catch (error) {
      toast.error("Failed to record reassessment");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Triage Reassessment
            </CardTitle>
            <Badge variant="secondary">Phase {(history?.length || 0) + 1}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Current Status */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-gray-600 mb-1">Current Acuity Level</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">ESI {currentAcuity}</span>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setShowDialog(true)}
                >
                  Reassess
                </Button>
              </div>
            </div>

            {/* History */}
            {history && history.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Reassessment History</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {history.map((reassessment) => (
                    <div key={reassessment._id} className="p-2 border rounded-lg text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">Phase {reassessment.reassessmentPhase}</span>
                        <span className="text-xs text-gray-600">
                          {new Date(reassessment.reassessedAt).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">ESI {reassessment.previousAcuity}</span>
                        {reassessment.acuityChanged ? (
                          <>
                            <TrendingUp className="w-3 h-3 text-red-500" />
                            <span className="text-xs text-gray-600">ESI {reassessment.currentAcuity}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-gray-600">→ Unchanged</span>
                          </>
                        )}
                      </div>

                      {reassessment.presentationChanges && reassessment.presentationChanges.length > 0 && (
                        <div className="text-xs text-gray-600 mt-1">
                          {reassessment.presentationChanges.join(", ")}
                        </div>
                      )}

                      {reassessment.assessmentNotes && (
                        <p className="text-xs text-gray-600 italic mt-1">{reassessment.assessmentNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!history || history.length === 0 && (
              <p className="text-sm text-gray-600 text-center py-4">No reassessments yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reassessment Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassess Patient Acuity</DialogTitle>
            <DialogDescription>
              Current ESI Level: {currentAcuity}. Select the new ESI level or leave unchanged.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">ESI Level</h4>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <Button
                    key={level}
                    variant={newAcuity === level ? "default" : "outline"}
                    className={`text-sm ${
                      newAcuity === level ? "bg-blue-600 hover:bg-blue-700" : ""
                    }`}
                    onClick={() => setNewAcuity(level)}
                  >
                    ESI {level}
                  </Button>
                ))}
              </div>
              {newAcuity !== currentAcuity && (
                <div className="text-xs text-blue-600 mt-2">
                  {newAcuity < currentAcuity ? (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Acuity increased (higher priority)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" /> Acuity decreased (lower priority)
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Document clinical findings, vital changes, etc."
                className="w-full mt-1 p-2 border rounded-lg text-sm min-h-20"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleReassessment}
              disabled={isProcessing}
            >
              {isProcessing ? "Saving..." : "Record Reassessment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
