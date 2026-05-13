import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Database, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

interface EpicFhirSyncUIProps {
  encounterId: string;
  patientId: string;
}

export default function EpicFhirSyncUI({
  encounterId,
  patientId,
}: EpicFhirSyncUIProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);

  // Queries
  const syncHistory = useQuery(api.epic.getSyncHistory, {
    encounterId: encounterId as any,
  });
  const fhirResources = useQuery(api.epic.getFhirResources, {
    patientId: patientId as any,
  });

  // Mutations
  const pullPatientData = useMutation(api.epic.pullPatientFromEpic);
  const pushDisposition = useMutation(api.epic.pushDispositionToEpic);
  const syncMeds = useMutation(api.epic.syncMedicationsFromEpic);
  const syncLabs = useMutation(api.epic.syncLabResultsFromEpic);

  const handlePullPatient = async () => {
    try {
      await pullPatientData({ epicMRN: "MRN123" });
    } catch (err) {
      console.error("Failed to pull patient data", err);
    }
  };

  const handlePushDisposition = async () => {
    try {
      await pushDisposition({
        encounterId: encounterId as any,
        dispositionPlan: "Discharge to home with follow-up",
      });
    } catch (err) {
      console.error("Failed to push disposition", err);
    }
  };

  if (!syncHistory || !fhirResources) return <div>Loading FHIR data...</div>;

  const successfulSyncs = syncHistory.filter((s) => s.status === "success").length;
  const failedSyncs = syncHistory.filter((s) => s.status === "failure").length;

  return (
    <Card className="w-full">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Cloud className="w-5 h-5" /> Epic FHIR Sync
            </CardTitle>
            <p className="text-xs text-gray-600 mt-1">
              {successfulSyncs} successful • {failedSyncs} failed • {fhirResources.length} resources
            </p>
          </div>
          <div className="flex items-center gap-2">
            {failedSyncs > 0 && (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            {failedSyncs === 0 && successfulSyncs > 0 && (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Sync Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePullPatient}
              className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-4 h-4" /> Pull Patient Data
            </button>
            <button
              onClick={handlePushDisposition}
              className="px-3 py-2 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded font-medium flex items-center justify-center gap-1"
            >
              <Cloud className="w-4 h-4" /> Push Disposition
            </button>
            <button
              onClick={() => syncMeds({ encounterId: encounterId as any })}
              className="px-3 py-2 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-4 h-4" /> Sync Meds
            </button>
            <button
              onClick={() => syncLabs({ encounterId: encounterId as any })}
              className="px-3 py-2 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded font-medium flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-4 h-4" /> Sync Labs
            </button>
          </div>

          {/* FHIR Resources */}
          <div>
            <h4 className="font-semibold text-sm mb-2">FHIR Resources ({fhirResources.length})</h4>
            {fhirResources.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {fhirResources.map((resource) => (
                  <div
                    key={resource._id}
                    className="p-2 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100"
                    onClick={() =>
                      setSelectedResource(
                        selectedResource === resource._id ? null : resource._id
                      )
                    }
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-xs">{resource.resourceType}</span>
                      </div>
                      <span className="text-xs text-gray-600">{resource.resourceId}</span>
                    </div>

                    {/* Expanded resource details */}
                    {selectedResource === resource._id && (
                      <div className="mt-2 p-2 bg-white rounded border text-xs text-gray-700">
                        <p>
                          <strong>Status:</strong>{" "}
                          <span
                            className={resource.syncStatus === "synced" ? "text-green-600" : "text-orange-600"}
                          >
                            {resource.syncStatus}
                          </span>
                        </p>
                        <p>
                          <strong>Last Sync:</strong>{" "}
                          {new Date(resource.lastSyncedAt).toLocaleString()}
                        </p>
                        {resource.resourceContent && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-blue-600 font-medium">
                              View Details
                            </summary>
                            <pre className="mt-1 p-1 bg-gray-100 rounded text-[10px] overflow-x-auto">
                              {JSON.stringify(resource.resourceContent, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No FHIR resources synced yet</p>
            )}
          </div>

          {/* Sync History */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Sync History ({syncHistory.length})</h4>
            {syncHistory.length > 0 ? (
              <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                {syncHistory.slice(0, 5).map((sync) => (
                  <div
                    key={sync._id}
                    className={`p-2 rounded flex items-center justify-between ${
                      sync.status === "success"
                        ? "bg-green-50 border-l-2 border-green-600"
                        : "bg-red-50 border-l-2 border-red-600"
                    }`}
                  >
                    <div>
                      <p className="font-semibold">{sync.syncOperation}</p>
                      <p className="text-gray-600">
                        {new Date(sync.syncTimestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    {sync.status === "success" ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No sync history yet</p>
            )}
          </div>

          {/* Sync Health */}
          <div className="p-3 bg-blue-50 rounded">
            <h5 className="font-semibold text-xs text-blue-900 mb-2">Sync Health</h5>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-blue-700">Success Rate</p>
                <p className="text-lg font-bold text-blue-900">
                  {Math.round(
                    (successfulSyncs / (successfulSyncs + failedSyncs || 1)) * 100
                  )}
                  %
                </p>
              </div>
              <div>
                <p className="text-blue-700">Last Sync</p>
                <p className="text-sm font-bold text-blue-900">
                  {syncHistory.length > 0
                    ? new Date(syncHistory[0].syncTimestamp).toLocaleTimeString()
                    : "Never"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
