import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, AlertCircle, CheckCircle, BarChart3 } from "lucide-react";

export default function ComplianceDashboard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"hedis" | "variance" | "audits">("hedis");

  // Queries
  const dashboard = useQuery(api.compliance.getComplianceDashboard, {});
  const hedisMetrics = useQuery(api.compliance.getHedisMetrics, { measurementPeriod: "2026-Q2" });
  const variances = useQuery(api.compliance.getVariancesByType, { varianceType: "high_antibiotic_use" });
  const pendingAudits = useQuery(api.compliance.getPendingAuditFindings, {});

  if (!dashboard) return <div>Loading compliance data...</div>;

  return (
    <Card className="w-full">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Compliance & Analytics
            </CardTitle>
            <p className="text-xs text-gray-600 mt-1">
              HEDIS: {dashboard.hedisComplianceRate}% • Variances: {dashboard.clinicalVariancesCount} •
              Audits: {dashboard.pendingAuditFindingsCount}
            </p>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              dashboard.hedisComplianceRate >= 75
                ? "bg-green-100 text-green-800"
                : dashboard.hedisComplianceRate >= 50
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
            }`}
          >
            {dashboard.hedisComplianceRate}% Compliant
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b">
            {["hedis", "variance", "audits"].map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab as any)}
                className={`px-3 py-2 text-xs font-semibold border-b-2 ${
                  selectedTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-800"
                }`}
              >
                {tab === "hedis"
                  ? "HEDIS Metrics"
                  : tab === "variance"
                    ? "Clinical Variance"
                    : "Coding Audits"}
              </button>
            ))}
          </div>

          {/* HEDIS Tab */}
          {selectedTab === "hedis" && hedisMetrics && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-green-50 rounded">
                  <p className="text-xs text-green-600 font-semibold">Compliant Cases</p>
                  <p className="text-2xl font-bold text-green-800">{hedisMetrics.compliantCases}</p>
                  <p className="text-xs text-green-600 mt-1">{hedisMetrics.period}</p>
                </div>
                <div className="p-3 bg-red-50 rounded">
                  <p className="text-xs text-red-600 font-semibold">Non-Compliant</p>
                  <p className="text-2xl font-bold text-red-800">{hedisMetrics.nonCompliantCases}</p>
                  <p className="text-xs text-red-600 mt-1">
                    {Math.round((hedisMetrics.nonCompliantCases / hedisMetrics.totalCases) * 100)}% of total
                  </p>
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-blue-900">Overall Compliance Rate</p>
                  <p className="text-2xl font-bold text-blue-600">{hedisMetrics.complianceRate}%</p>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all"
                    style={{ width: `${hedisMetrics.complianceRate}%` }}
                  />
                </div>
              </div>

              <div className="text-xs text-gray-700 space-y-1">
                <p>
                  <strong>Total Cases:</strong> {hedisMetrics.totalCases}
                </p>
                <p>
                  <strong>N/A Cases:</strong> {hedisMetrics.notApplicableCases}
                </p>
              </div>
            </div>
          )}

          {/* Variance Tab */}
          {selectedTab === "variance" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-3 bg-orange-50 rounded">
                  <p className="text-xs text-orange-600 font-semibold">Total Variances</p>
                  <p className="text-2xl font-bold text-orange-800">
                    {dashboard.clinicalVariancesCount}
                  </p>
                </div>
                <div className="p-3 bg-red-50 rounded">
                  <p className="text-xs text-red-600 font-semibold">High Severity</p>
                  <p className="text-2xl font-bold text-red-800">
                    {dashboard.highSeverityVariancesCount}
                  </p>
                </div>
              </div>

              <div>
                <h5 className="font-semibold text-sm mb-2">Recent High-Risk Variances</h5>
                {variances && variances.length > 0 ? (
                  <div className="space-y-2">
                    {variances.slice(0, 3).map((v) => (
                      <div key={v._id} className="p-2 bg-gray-50 rounded border-l-4 border-red-600">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-semibold capitalize">{v.varianceType?.replace(/_/g, " ")}</p>
                            <p className="text-xs text-gray-600">{v.varianceDescription}</p>
                          </div>
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded ${
                              v.severity === "high"
                                ? "bg-red-200 text-red-800"
                                : v.severity === "medium"
                                  ? "bg-yellow-200 text-yellow-800"
                                  : "bg-green-200 text-green-800"
                            }`}
                          >
                            {v.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No high-risk variances detected</p>
                )}
              </div>
            </div>
          )}

          {/* Audits Tab */}
          {selectedTab === "audits" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-3 bg-purple-50 rounded">
                  <p className="text-xs text-purple-600 font-semibold">Pending Findings</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {dashboard.pendingAuditFindingsCount}
                  </p>
                </div>
                <div className="p-3 bg-red-50 rounded">
                  <p className="text-xs text-red-600 font-semibold">Critical Issues</p>
                  <p className="text-2xl font-bold text-red-800">
                    {dashboard.criticalFindingsCount}
                  </p>
                </div>
              </div>

              <div>
                <h5 className="font-semibold text-sm mb-2">Recent Audit Findings</h5>
                {pendingAudits && pendingAudits.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {pendingAudits.slice(0, 5).map((audit) => (
                      <div
                        key={audit._id}
                        className="p-2 bg-gray-50 rounded border-l-4 border-purple-600 text-xs"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold">
                            {audit.findingsCount} findings found
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            audit.status === "requires_correction"
                              ? "bg-red-200 text-red-800"
                              : "bg-green-200 text-green-800"
                          }`}>
                            {audit.status?.replace(/_/g, " ")}
                          </span>
                        </div>
                        {audit.findings && audit.findings.length > 0 && (
                          <ul className="text-gray-700 ml-3 space-y-0.5">
                            {audit.findings.slice(0, 2).map((f, idx) => (
                              <li key={idx} className="list-disc text-[11px]">{f}</li>
                            ))}
                            {audit.findings.length > 2 && (
                              <li className="text-[11px] text-gray-500">+{audit.findings.length - 2} more...</li>
                            )}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No pending audit findings</p>
                )}
              </div>

              <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
                <p className="text-green-800 font-semibold">✓ Audit Queue</p>
                <p className="text-green-700">
                  {Math.max(0, 100 - (dashboard.pendingAuditFindingsCount * 10))}% capacity available
                </p>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
