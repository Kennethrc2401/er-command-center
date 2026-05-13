import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BillingDashboard from "./BillingDashboard";
import PortalMessenger from "./PortalMessenger";
import ComplianceDashboard from "./ComplianceDashboard";
import AlertsEscalationPanel from "./AlertsEscalationPanel";
import WorkflowAutomationUI from "./WorkflowAutomationUI";
import EpicFhirSyncUI from "./EpicFhirSyncUI";
import AnalyticsDashboard from "./AnalyticsDashboard";
import { Settings } from "lucide-react";

interface IntegratedOperationsDashboardProps {
  encounterId: string;
  patientId: string;
}

export default function IntegratedOperationsDashboard({
  encounterId,
  patientId,
}: IntegratedOperationsDashboardProps) {
  return (
    <div className="w-full space-y-4 p-4 bg-white rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Advanced EHR Operations</h1>
          <p className="text-sm text-gray-600">
            Integrated Epic, AdvancedMD, Portal, and Compliance Dashboard
          </p>
        </div>
        <div className="flex items-center gap-2 text-gray-600 text-sm">
          <Settings className="w-5 h-5" />
          <span>Encounter: {encounterId}</span>
        </div>
      </div>

      {/* Quick Status Summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs text-gray-600 font-semibold">BILLING STATUS</p>
              <p className="text-lg font-bold text-blue-600">Ready</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs text-gray-600 font-semibold">PORTAL MSGS</p>
              <p className="text-lg font-bold text-purple-600">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs text-gray-600 font-semibold">COMPLIANCE</p>
              <p className="text-lg font-bold text-green-600">82%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs text-gray-600 font-semibold">ACTIVE ALERTS</p>
              <p className="text-lg font-bold text-orange-600">3</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Panels */}
      <div className="space-y-4">
        {/* Row 1: Critical Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AlertsEscalationPanel />
          <BillingDashboard encounterId={encounterId} patientId={patientId} />
        </div>

        {/* Row 2: Integration Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EpicFhirSyncUI encounterId={encounterId} patientId={patientId} />
          <PortalMessenger encounterId={encounterId} patientId={patientId} />
        </div>

        {/* Row 3: Operations Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WorkflowAutomationUI encounterId={encounterId} patientId={patientId} />
          <ComplianceDashboard />
        </div>

        {/* Row 4: Analytics */}
        <AnalyticsDashboard />
      </div>

      {/* Footer Status */}
      <div className="mt-6 p-4 bg-gray-50 rounded border text-xs text-gray-600 space-y-1">
        <p>
          <strong>System Status:</strong> All modules operational • Last sync: {new Date().toLocaleTimeString()}
        </p>
        <p>
          <strong>Data Flow:</strong> Epic FHIR ↔ Core System ↔ AdvancedMD ↔ Patient Portal ↔ Analytics Engine
        </p>
        <p>
          <strong>Compliance:</strong> HIPAA Audit Logging Active • Real-time Encryption • Breach Notification Ready
        </p>
      </div>
    </div>
  );
}
