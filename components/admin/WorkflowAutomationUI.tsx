import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Plus, Check, Clock, ArrowRight } from "lucide-react";

interface WorkflowAutomationUIProps {
  encounterId: string;
  patientId: string;
}

export default function WorkflowAutomationUI({
  encounterId,
  patientId,
}: WorkflowAutomationUIProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"referrals" | "adt" | "bed">("referrals");
  const [newSpecialty, setNewSpecialty] = useState("");

  // Queries
  const workflowStatus = useQuery(api.automation.getWorkflowStatus, {
    encounterId: encounterId as any,
  });
  const pendingReferrals = useQuery(api.automation.getPendingReferrals, {
    encounterId: encounterId as any,
  });
  const adtHistory = useQuery(api.automation.getAdtEventHistory, {
    encounterId: encounterId as any,
  });

  // Mutations
  const createReferral = useMutation(api.automation.createSpecialistReferral);
  const acceptReferral = useMutation(api.automation.acceptReferral);
  const completeReferral = useMutation(api.automation.completeReferral);
  const publishAdtDischarge = useMutation(api.automation.publishAdtDischargeEvent);

  const handleCreateReferral = async () => {
    if (!newSpecialty) return;
    try {
      await createReferral({
        encounterId: encounterId as any,
        specialtyRequested: newSpecialty as any,
        referralType: "consultation",
        preferredSchedule: "within_24h",
      });
      setNewSpecialty("");
    } catch (err) {
      console.error("Failed to create referral", err);
    }
  };

  const handlePublishDischarge = async () => {
    try {
      await publishAdtDischarge({ encounterId: encounterId as any });
    } catch (err) {
      console.error("Failed to publish discharge", err);
    }
  };

  if (!workflowStatus) return <div>Loading workflow data...</div>;

  return (
    <Card className="w-full">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Zap className="w-5 h-5" /> Workflow Automation
            </CardTitle>
            <p className="text-xs text-gray-600 mt-1">
              Referrals: {workflowStatus.pendingReferralCount} pending •
              ADT: {workflowStatus.adtEventCount} events
            </p>
          </div>
          <div className="text-sm font-semibold text-blue-600">
            {workflowStatus.workflowPhase?.replace(/_/g, " ")}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b">
            {["referrals", "adt", "bed"].map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab as any)}
                className={`px-3 py-2 text-xs font-semibold border-b-2 ${
                  selectedTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-800"
                }`}
              >
                {tab === "referrals"
                  ? "Specialist Referrals"
                  : tab === "adt"
                    ? "ADT Events"
                    : "Bed Turnover"}
              </button>
            ))}
          </div>

          {/* Referrals Tab */}
          {selectedTab === "referrals" && pendingReferrals && (
            <div className="space-y-3">
              {/* Create Referral Form */}
              <div className="p-3 bg-blue-50 rounded border">
                <h4 className="font-semibold text-sm mb-2 text-blue-900">New Referral</h4>
                <div className="flex gap-2">
                  <select
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border rounded"
                  >
                    <option value="">Select specialty...</option>
                    <option value="cardiology">Cardiology</option>
                    <option value="neurology">Neurology</option>
                    <option value="surgery">Surgery</option>
                    <option value="psychiatry">Psychiatry</option>
                    <option value="oncology">Oncology</option>
                  </select>
                  <button
                    onClick={handleCreateReferral}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Create
                  </button>
                </div>
              </div>

              {/* Referral List */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Pending Referrals</h4>
                {pendingReferrals.length > 0 ? (
                  <div className="space-y-2">
                    {pendingReferrals.map((ref) => (
                      <div key={ref._id} className="p-3 bg-gray-50 rounded border-l-4 border-blue-600">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm capitalize">
                              {ref.specialtyRequested}
                            </p>
                            <p className="text-xs text-gray-600">
                              Status: <span className="font-medium">{ref.status}</span>
                            </p>
                          </div>
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded ${
                              ref.status === "pending"
                                ? "bg-yellow-200 text-yellow-800"
                                : ref.status === "accepted"
                                  ? "bg-blue-200 text-blue-800"
                                  : "bg-green-200 text-green-800"
                            }`}
                          >
                            {ref.status}
                          </span>
                        </div>

                        {ref.assignedProvider && (
                          <p className="text-xs text-gray-700 mb-2">
                            Assigned to: <span className="font-medium">{ref.assignedProvider}</span>
                          </p>
                        )}

                        {/* Actions */}
                        {ref.status === "pending" && (
                          <button
                            onClick={() => acceptReferral({ referralId: ref._id })}
                            className="w-full px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium"
                          >
                            ✓ Accept Referral
                          </button>
                        )}

                        {ref.status === "accepted" && (
                          <button
                            onClick={() =>
                              completeReferral({
                                referralId: ref._id,
                                completionNotes: "Consultation completed",
                              })
                            }
                            className="w-full px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                          >
                            ✓ Mark Complete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No pending referrals</p>
                )}
              </div>
            </div>
          )}

          {/* ADT Tab */}
          {selectedTab === "adt" && adtHistory && (
            <div className="space-y-3">
              <button
                onClick={handlePublishDischarge}
                className="w-full px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4" /> Publish Discharge to Epic
              </button>

              <div>
                <h4 className="font-semibold text-sm mb-2">ADT Event History</h4>
                {adtHistory.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {adtHistory.map((evt) => (
                      <div key={evt._id} className="p-2 bg-gray-50 rounded border text-xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{evt.eventDescription}</p>
                            <p className="text-gray-600">
                              {new Date(evt.eventTimestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          <Check className="w-4 h-4 text-green-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No ADT events yet</p>
                )}
              </div>
            </div>
          )}

          {/* Bed Turnover Tab */}
          {selectedTab === "bed" && (
            <div className="p-3 bg-gray-50 rounded border text-center">
              <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">Bed turnover workflow</p>
              <p className="text-xs text-gray-500 mt-1">Triggered on patient discharge</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
