import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

interface BillingDashboardProps {
  encounterId: string;
  patientId: string;
}

export default function BillingDashboard({ encounterId, patientId }: BillingDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Queries
  const summary = useQuery(api.billing.getBillingSummary, { encounterId: encounterId as any });
  const riskAssessment = useQuery(api.billing.getDenialRiskAssessment, { encounterId: encounterId as any });

  // Mutations
  const captureCpt = useMutation(api.billing.captureCptCode);
  const generateSuperbill = useQuery(api.billing.generateSuperbill, { encounterId: encounterId as any });

  const handleCaptureCpt = async (code: string) => {
    try {
      await captureCpt({
        encounterId: encounterId as any,
        patientId: patientId as any,
        cptCode: code,
      });
    } catch (err) {
      console.error("Failed to capture CPT code", err);
    }
  };

  if (!summary) return <div>Loading billing data...</div>;

  return (
    <Card className="w-full">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">💳 AdvancedMD Billing</CardTitle>
            <p className="text-xs text-gray-600 mt-1">
              {summary.cptCount} CPT codes • ${summary.totalCharges.toFixed(2)} charges
            </p>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              summary.denialRiskScore > 50
                ? "bg-red-100 text-red-800"
                : summary.denialRiskScore > 25
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-green-100 text-green-800"
            }`}
          >
            Risk: {summary.denialRiskScore}%
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* CPT Codes */}
          <div>
            <h4 className="font-semibold text-sm mb-2">CPT Codes Captured</h4>
            <div className="space-y-2">
              {summary.cptCodes.length > 0 ? (
                summary.cptCodes.map((cpt) => (
                  <div key={cpt._id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">{cpt.cptCode} - {cpt.cptDescription}</span>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 italic">No CPT codes captured yet</p>
              )}
            </div>

            {/* Quick CPT capture buttons */}
            <div className="mt-3 flex gap-2 flex-wrap">
              {["99213", "71046", "36415"].map((code) => (
                <button
                  key={code}
                  onClick={() => handleCaptureCpt(code)}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  +{code}
                </button>
              ))}
            </div>
          </div>

          {/* Denial Risk Assessment */}
          {riskAssessment && (
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Denial Risk Assessment
              </h4>
              <div className="space-y-2">
                {riskAssessment.riskFactors.map((factor, idx) => (
                  <div key={idx} className="text-xs p-2 bg-orange-50 rounded text-orange-900">
                    ⚠️ {factor}
                  </div>
                ))}
                {riskAssessment.recommendations.length > 0 && (
                  <div className="mt-3 p-2 bg-blue-50 rounded">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Recommendations:</p>
                    <ul className="text-xs text-blue-800 space-y-1">
                      {riskAssessment.recommendations.map((rec, idx) => (
                        <li key={idx}>✓ {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prior Auth Status */}
          {summary.priorAuthRequests.length > 0 && (
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm mb-2">Prior Authorizations</h4>
              <div className="space-y-2">
                {summary.priorAuthRequests.map((auth) => (
                  <div key={auth._id} className="text-xs p-2 bg-purple-50 rounded">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{auth.procedureCode}</span>
                      <span
                        className={`px-2 py-1 rounded ${
                          auth.status === "approved"
                            ? "bg-green-200 text-green-800"
                            : auth.status === "denied"
                              ? "bg-red-200 text-red-800"
                              : "bg-yellow-200 text-yellow-800"
                        }`}
                      >
                        {auth.status}
                      </span>
                    </div>
                    {auth.approvalNumber && (
                      <p className="text-gray-600 mt-1">Auth #: {auth.approvalNumber}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Superbill */}
          {generateSuperbill && (
            <div className="border-t pt-3">
              <h4 className="font-semibold text-sm mb-2">Superbill Summary</h4>
              <div className="p-2 bg-gray-50 rounded text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Total Charges:</span>
                  <span className="font-bold">${generateSuperbill.totalCharges.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Allowed:</span>
                  <span>${generateSuperbill.estimatedAllowedAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Patient Resp:</span>
                  <span>${generateSuperbill.patientResponsibility.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
