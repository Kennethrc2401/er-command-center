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
import { useState } from "react";
import { CheckCircle2, XCircle, Clock, Users, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

export function ShiftHandoffPanel({ userId }: { userId: string }) {
  const pendingHandoffs = useQuery(api.workflow.getPendingHandoffs, { userId: userId as Id<"users"> });
  const handoffHistory = useQuery(api.workflow.getHandoffHistory, { userId: userId as Id<"users"> });
  
  const acceptHandoff = useMutation(api.workflow.acceptHandoff);
  const rejectHandoff = useMutation(api.workflow.rejectHandoff);

  const [showAcceptDialog, setShowAcceptDialog] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null);
  const [signInNotes, setSignInNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!pendingHandoffs || !handoffHistory) return null;

  const handleAccept = async (handoffId: string) => {
    setIsProcessing(true);
    try {
      await acceptHandoff({
        handoffId: handoffId as Id<"shiftHandoffs">,
        toUserId: userId as Id<"users">,
        toUserName: "Current User", // In real app, get from auth context
        toUserRole: "DOCTOR", // In real app, get from auth context
        signInNotes: signInNotes || undefined,
      });
      toast.success("Handoff accepted successfully");
      setShowAcceptDialog(null);
      setSignInNotes("");
    } catch (error) {
      toast.error("Failed to accept handoff");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (handoffId: string) => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setIsProcessing(true);
    try {
      await rejectHandoff({
        handoffId: handoffId as Id<"shiftHandoffs">,
        toUserId: userId as Id<"users">,
        toUserName: "Current User", // In real app, get from auth context
        toUserRole: "DOCTOR", // In real app, get from auth context
        rejectionReason,
      });
      toast.success("Handoff rejected");
      setShowRejectDialog(null);
      setRejectionReason("");
    } catch (error) {
      toast.error("Failed to reject handoff");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Pending Handoffs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Incoming Handoffs</CardTitle>
            <Badge variant={pendingHandoffs.length > 0 ? "destructive" : "secondary"}>
              {pendingHandoffs.length} pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {pendingHandoffs.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No pending handoffs
            </div>
          ) : (
            <div className="space-y-3">
              {pendingHandoffs.map((handoff) => (
                <div
                  key={handoff._id}
                  className={`p-4 border rounded-lg ${
                    handoff.isExpired ? "border-red-300 bg-red-50" : "border-yellow-300 bg-yellow-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{handoff.fromUserName}</h4>
                        <Badge variant="outline" className="text-xs">
                          {handoff.fromUserRole}
                        </Badge>
                        {handoff.isExpired && (
                          <Badge variant="destructive" className="text-xs">
                            Expired
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {handoff.patientCount} patient{handoff.patientCount !== 1 ? "s" : ""}
                      </p>

                      {/* Patient List */}
                      <div className="space-y-2 mb-3">
                        {handoff.sessions.map((session) => (
                          <div
                            key={session._id}
                            className="text-sm bg-white p-2 rounded border border-gray-200"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium">{session.patientName}</p>
                                <p className="text-gray-600 text-xs">{session.chiefComplaint}</p>
                              </div>
                              <div className="ml-2 text-right">
                                <Badge variant="outline" className="text-xs">
                                  ESI {session.acuity}
                                </Badge>
                                {session.keyAlertsCount > 0 && (
                                  <div className="flex items-center gap-1 mt-1 text-red-600 text-xs font-semibold">
                                    <AlertCircle className="w-3 h-3" />
                                    {session.keyAlertsCount} alerts
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Time Remaining */}
                      {!handoff.isExpired && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-3">
                          <Clock className="w-3 h-3" />
                          {Math.round(handoff.timeRemaining / 60000)} minutes to accept
                        </div>
                      )}

                      {handoff.notes && (
                        <p className="text-xs text-gray-600 italic">{handoff.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {!handoff.isExpired && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => setShowAcceptDialog(handoff._id)}
                        disabled={isProcessing}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => setShowRejectDialog(handoff._id)}
                        disabled={isProcessing}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Handoff History */}
      {(handoffHistory.given.length > 0 || handoffHistory.received.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Handoff History (Last 24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Given */}
              {handoffHistory.given.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Signed Out</h5>
                  <div className="space-y-2">
                    {handoffHistory.given.slice(0, 3).map((handoff) => (
                      <div key={handoff._id} className="text-xs p-2 bg-gray-50 rounded border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{handoff.patientCount} patients</span>
                          <Badge
                            variant={handoff.status === "accepted" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {handoff.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Received */}
              {handoffHistory.received.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Signed In</h5>
                  <div className="space-y-2">
                    {handoffHistory.received.slice(0, 3).map((handoff) => (
                      <div key={handoff._id} className="text-xs p-2 bg-gray-50 rounded border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{handoff.patientCount} patients from {handoff.fromUserName}</span>
                          <Badge
                            variant={handoff.status === "accepted" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {handoff.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accept Dialog */}
      <Dialog open={!!showAcceptDialog} onOpenChange={(open) => !open && setShowAcceptDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Handoff</DialogTitle>
            <DialogDescription>
              Confirm that you are taking responsibility for the patients in this handoff.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Add sign-in notes (optional)..."
              value={signInNotes}
              onChange={(e) => setSignInNotes(e.target.value)}
              className="min-h-24"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAcceptDialog(null)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => showAcceptDialog && handleAccept(showAcceptDialog)}
              disabled={isProcessing}
            >
              {isProcessing ? "Accepting..." : "Accept Handoff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!showRejectDialog} onOpenChange={(open) => !open && setShowRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Handoff</DialogTitle>
            <DialogDescription>
              Please explain why you cannot accept this handoff.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Reason for rejection (required)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-24"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(null)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showRejectDialog && handleReject(showRejectDialog)}
              disabled={isProcessing || !rejectionReason.trim()}
            >
              {isProcessing ? "Rejecting..." : "Reject Handoff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
