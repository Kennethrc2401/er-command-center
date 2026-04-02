"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, Users, Clock, Bed } from "lucide-react";

export function MetricsDashboard() {
  const metrics = useQuery(api.workflow.getEdMetrics, {});

  if (!metrics) {
    return <div className="text-center py-8 text-gray-500">Loading metrics...</div>;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
      {/* Primary Metrics */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Active Patients</CardTitle>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{metrics.activePatientCount}</div>
          <p className="text-xs text-gray-600 mt-1">
            {metrics.highAcuityPatientCount} high acuity
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Bed Utilization</CardTitle>
            <Bed className="w-4 h-4 text-green-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{metrics.bedUtilizationPercent}%</div>
          <p className="text-xs text-gray-600 mt-1">
            {metrics.bedsOccupied}/{metrics.bedsTotalAvailable} beds
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Avg Triage Time</CardTitle>
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{metrics.avgTimeInTriageMinutes}m</div>
          <p className="text-xs text-gray-600 mt-1">
            {metrics.waitingInTriageCount} waiting
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Discharge Ready</CardTitle>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{metrics.dischargeReadyCount}</div>
          <p className="text-xs text-gray-600 mt-1">
            {metrics.dischargesLastHour} discharged this hour
          </p>
        </CardContent>
      </Card>

      {/* Detailed Status Breakdown */}
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>ED Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-sm">Waiting Triage</span>
              </div>
              <Badge variant="secondary">{metrics.waitingInTriageCount}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm">Bedded</span>
              </div>
              <Badge variant="secondary">{metrics.beddedCount}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm">Discharge Ready</span>
              </div>
              <Badge variant="secondary">{metrics.dischargeReadyCount}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-sm">Admit Ready</span>
              </div>
              <Badge variant="secondary">{metrics.admitReadyCount}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Key Performance Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Provider Avg Load</span>
                <span className="font-semibold">{metrics.averageProviderLoad.toFixed(1)} patients/provider</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, (metrics.averageProviderLoad / 6) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Critical Alerts</span>
                <span className="font-semibold">{metrics.criticalAlertsOpen}</span>
              </div>
              {metrics.criticalAlertsOpen > 0 && (
                <div className="flex items-center gap-1 text-red-600 text-xs mt-1">
                  <AlertCircle className="w-3 h-3" />
                  Escalate critical alerts
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Admit Backlog</span>
                <span className="font-semibold">{metrics.admitReadyCount} waiting bed</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${metrics.admitReadyCount > 3 ? "bg-red-500" : "bg-orange-500"}`}
                  style={{ width: `${Math.min(100, (metrics.admitReadyCount / 5) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
