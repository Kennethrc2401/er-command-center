import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, AlertCircle, Users, Activity } from "lucide-react";

export default function AnalyticsDashboard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"utilization" | "medication" | "readmission">(
    "utilization"
  );

  // Queries
  const utilization = useQuery(api.compliance.getProcedureUtilizationAnalysis, {});
  const medVariance = useQuery(api.compliance.getMedicationUtilizationVariance, {});
  const readmissionRisk = useQuery(api.compliance.getReadmissionRiskAnalysis, {});

  if (!utilization || !medVariance || !readmissionRisk)
    return <div>Loading analytics...</div>;

  return (
    <Card className="w-full">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> Clinical Analytics
            </CardTitle>
            <p className="text-xs text-gray-600 mt-1">
              Utilization • Medication Variance • Readmission Risk
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${
            medVariance.antibiotic_usage_rate > 30
              ? "bg-red-100 text-red-800"
              : "bg-green-100 text-green-800"
          }`}>
            {medVariance.antibiotic_usage_rate}% AB Rate
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b">
            {["utilization", "medication", "readmission"].map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab as any)}
                className={`px-3 py-2 text-xs font-semibold border-b-2 ${
                  selectedTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-800"
                }`}
              >
                {tab === "utilization"
                  ? "Procedure Utilization"
                  : tab === "medication"
                    ? "Medication Variance"
                    : "Readmission Risk"}
              </button>
            ))}
          </div>

          {/* Procedure Utilization */}
          {selectedTab === "utilization" && utilization && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Top Procedures by Volume</h4>
              <div className="space-y-2">
                {utilization.topProcedures && utilization.topProcedures.length > 0 ? (
                  utilization.topProcedures.slice(0, 5).map((proc: any) => (
                    <div key={proc.cptCode} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold">{proc.cptCode}</p>
                          <p className="text-gray-600">{proc.procedureName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-600">{proc.usage}</p>
                          <p className="text-gray-600">{proc.percentage}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all"
                          style={{ width: `${proc.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 italic">No utilization data available</p>
                )}
              </div>

              <div className="p-2 bg-blue-50 rounded text-xs">
                <p className="text-blue-900 font-semibold">
                  Total Procedures: {utilization.totalProcedures || 0}
                </p>
              </div>
            </div>
          )}

          {/* Medication Variance */}
          {selectedTab === "medication" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className={`p-3 rounded ${
                  medVariance.antibiotic_usage_rate > 30
                    ? "bg-red-50"
                    : "bg-green-50"
                }`}>
                  <p className={`text-xs font-semibold ${
                    medVariance.antibiotic_usage_rate > 30
                      ? "text-red-600"
                      : "text-green-600"
                  }`}>
                    Antibiotic Usage
                  </p>
                  <p className={`text-2xl font-bold ${
                    medVariance.antibiotic_usage_rate > 30
                      ? "text-red-800"
                      : "text-green-800"
                  }`}>
                    {medVariance.antibiotic_usage_rate}%
                  </p>
                </div>

                <div className="p-3 bg-yellow-50 rounded">
                  <p className="text-xs font-semibold text-yellow-600">Flag Status</p>
                  <p className="text-sm font-bold text-yellow-800">
                    {medVariance.flagged ? "⚠ Flagged" : "✓ Normal"}
                  </p>
                </div>
              </div>

              {medVariance.flagged && (
                <div className="p-3 bg-red-50 rounded border border-red-200">
                  <h5 className="font-semibold text-sm text-red-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Elevated Usage Detected
                  </h5>
                  <p className="text-xs text-red-800 mb-2">
                    Antibiotic usage rate exceeds recommended threshold of 30%.
                  </p>
                  <ul className="text-xs text-red-700 space-y-1 ml-3">
                    {medVariance.recommendations &&
                      medVariance.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="list-disc">
                          {rec}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Readmission Risk */}
          {selectedTab === "readmission" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-3 bg-purple-50 rounded">
                  <p className="text-xs font-semibold text-purple-600">Average Risk Score</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {readmissionRisk.averageRiskScore}
                  </p>
                </div>

                <div className={`p-3 rounded ${
                  readmissionRisk.highRiskPatientCount > 5
                    ? "bg-red-50"
                    : "bg-green-50"
                }`}>
                  <p className={`text-xs font-semibold ${
                    readmissionRisk.highRiskPatientCount > 5
                      ? "text-red-600"
                      : "text-green-600"
                  }`}>
                    High-Risk Patients
                  </p>
                  <p className={`text-2xl font-bold ${
                    readmissionRisk.highRiskPatientCount > 5
                      ? "text-red-800"
                      : "text-green-800"
                  }`}>
                    {readmissionRisk.highRiskPatientCount}
                  </p>
                </div>
              </div>

              <div>
                <h5 className="font-semibold text-sm mb-2">Primary Risk Factors</h5>
                <ul className="text-xs space-y-1 ml-3">
                  {readmissionRisk.commonRiskFactors &&
                    readmissionRisk.commonRiskFactors.map((factor: string, idx: number) => (
                      <li key={idx} className="list-disc text-gray-700">
                        {factor}
                      </li>
                    ))}
                </ul>
              </div>

              <div className="p-3 bg-blue-50 rounded">
                <h5 className="font-semibold text-sm text-blue-900 mb-2">Recommendations</h5>
                <ul className="text-xs space-y-1 text-blue-800 ml-3">
                  {readmissionRisk.interventions &&
                    readmissionRisk.interventions.map((int: string, idx: number) => (
                      <li key={idx} className="list-disc">
                        {int}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}

          {/* Summary Footer */}
          <div className="p-3 bg-gray-50 rounded border text-xs">
            <div className="flex items-center gap-2 text-gray-700">
              <Activity className="w-4 h-4" />
              <span>
                <strong>Last Updated:</strong> {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
