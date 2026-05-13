import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Bell, CheckCircle, Clock, TrendingUp } from "lucide-react";

export default function AlertsEscalationPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

  // Queries
  const alerts = useQuery(api.alerts.getPendingEscalations, {});
  const metrics = useQuery(api.alerts.getAlertMetrics, {});

  // Mutations
  const acknowledgeAlert = useMutation(api.alerts.acknowledgeAlert);
  const escalateAlert = useMutation(api.alerts.escalateAlert);
  const resolveAlert = useMutation(api.alerts.resolveAlert);

  const handleAcknowledge = async (escalationId: string) => {
    try {
      await acknowledgeAlert({
        escalationId: escalationId as any,
        acknowledgedByName: "Current User",
      });
    } catch (err) {
      console.error("Failed to acknowledge alert", err);
    }
  };

  const handleEscalate = async (escalationId: string) => {
    try {
      await escalateAlert({
        escalationId: escalationId as any,
        escalateToRole: "DOCTOR",
      });
    } catch (err) {
      console.error("Failed to escalate alert", err);
    }
  };

  const handleResolve = async (escalationId: string) => {
    try {
      await resolveAlert({
        escalationId: escalationId as any,
        resolutionDetails: "Resolved by user",
      });
    } catch (err) {
      console.error("Failed to resolve alert", err);
    }
  };

  if (!alerts || !metrics) return <div>Loading alerts...</div>;

  const criticalAlerts = alerts.filter((a) => a.alertType?.includes("critical")).length;
  const unacknowledged = alerts.filter((a) => !a.acknowledgedAt).length;

  return (
    <Card className="w-full">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Bell className="w-5 h-5" /> Real-Time Alerts
            </CardTitle>
            <p className="text-xs text-gray-600 mt-1">
              {unacknowledged} unacknowledged • {criticalAlerts} critical
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full font-bold text-white ${
            criticalAlerts > 0 ? "bg-red-600" : "bg-blue-600"
          }`}>
            {metrics.totalAlerts}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Metrics Dashboard */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-red-50 rounded">
              <p className="text-xs text-red-600 font-semibold">Unacknowledged</p>
              <p className="text-2xl font-bold text-red-800">{metrics.unacknowledgedCount}</p>
            </div>
            <div className="p-2 bg-orange-50 rounded">
              <p className="text-xs text-orange-600 font-semibold">Escalated</p>
              <p className="text-2xl font-bold text-orange-800">{metrics.escalatedCount}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded">
              <p className="text-xs text-blue-600 font-semibold">Avg Time</p>
              <p className="text-lg font-bold text-blue-800">{metrics.avgTimeToAcknowledgeMin}min</p>
            </div>
            <div className="p-2 bg-green-50 rounded">
              <p className="text-xs text-green-600 font-semibold">Resolved</p>
              <p className="text-2xl font-bold text-green-800">{metrics.resolvedCount}</p>
            </div>
          </div>

          {/* Alert List */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Active Alerts</h4>
            {alerts.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert._id}
                    className={`p-3 rounded border-l-4 cursor-pointer hover:bg-gray-50 ${
                      alert.alertType === "critical_lab"
                        ? "border-l-red-600 bg-red-50"
                        : alert.alertType === "deterioration_risk"
                          ? "border-l-orange-600 bg-orange-50"
                          : "border-l-blue-600 bg-blue-50"
                    }`}
                    onClick={() => setSelectedAlert(selectedAlert === alert._id ? null : alert._id)}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="font-semibold text-sm capitalize">{alert.alertType?.replace(/_/g, " ")}</p>
                        <p className="text-xs text-gray-600">
                          Routed to: <span className="font-medium">{alert.routedToRole}</span>
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {alert.acknowledgedAt ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                    </div>

                    {/* Time elapsed */}
                    <div className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {Math.round((Date.now() - alert.initialTriggerAt) / 60000)}min ago
                    </div>

                    {/* Expanded details */}
                    {selectedAlert === alert._id && (
                      <div className="mt-3 space-y-2 border-t pt-2">
                        {alert.acknowledgedAt && (
                          <p className="text-xs text-green-700">
                            ✓ Acknowledged by {alert.acknowledgedBy} at{" "}
                            {new Date(alert.acknowledgedAt).toLocaleTimeString()}
                          </p>
                        )}

                        {alert.escalatedAt && (
                          <p className="text-xs text-orange-700">
                            ⬆ Escalated to {alert.escalatedToRole} at{" "}
                            {new Date(alert.escalatedAt).toLocaleTimeString()}
                          </p>
                        )}

                        {/* Action buttons */}
                        {!alert.acknowledgedAt && (
                          <button
                            onClick={() => handleAcknowledge(alert._id)}
                            className="w-full px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium"
                          >
                            ✓ Acknowledge
                          </button>
                        )}

                        {alert.acknowledgedAt && !alert.escalatedAt && (
                          <button
                            onClick={() => handleEscalate(alert._id)}
                            className="w-full px-2 py-1 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded font-medium"
                          >
                            ⬆ Escalate to Doctor
                          </button>
                        )}

                        {!alert.resolutionAt && (
                          <button
                            onClick={() => handleResolve(alert._id)}
                            className="w-full px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                          >
                            ✓ Resolve
                          </button>
                        )}

                        {alert.resolutionAt && (
                          <p className="text-xs text-blue-700 font-medium">
                            ✓ Resolved: {alert.resolutionDetails}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center bg-green-50 rounded">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-green-800 font-medium">No active alerts</p>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
