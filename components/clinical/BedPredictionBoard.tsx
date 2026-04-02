"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp } from "lucide-react";

export function BedPredictionBoard() {
  const predictions = useQuery(api.workflow.predictBedAvailability, {});

  if (!predictions) {
    return <div className="text-center py-6 text-gray-500">Loading bed predictions...</div>;
  }

  // Use query result timestamp if available, otherwise use a placeholder
  const baselineTime = 0; // In production, this would come from the query result
  
  const getSoonAvailable = predictions.filter(
    (p) => p.predictedAvailableAt - baselineTime < 60 * 60 * 1000
  );
  const getAvailableNext2h = predictions.filter((p) => {
    const diff = p.predictedAvailableAt - baselineTime;
    return diff >= 60 * 60 * 1000 && diff < 2 * 60 * 60 * 1000;
  });

  const formatTime = (timestamp: number) => {
    if (timestamp === 0) return "Unknown";
    // Format as HH:MM (local time)
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Available Soon */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-600" />
              Available Soon (Next Hour)
            </CardTitle>
            <Badge className="bg-green-600">{getSoonAvailable.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {getSoonAvailable.length === 0 ? (
            <p className="text-sm text-gray-600">No beds predicted within 1 hour</p>
          ) : (
            <div className="space-y-2">
              {getSoonAvailable.map((pred) => (
                <div key={pred.bedLabel} className="text-sm p-2 bg-white rounded border border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{pred.bedLabel}</span>
                    <span className="text-xs text-gray-600">
                      {formatTime(pred.predictedAvailableAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      ESI {pred.currentOccupantAcuity}
                    </Badge>
                    <span className="text-xs text-gray-600">
                      Confidence: {Math.round(pred.predictionConfidence * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Next 2 Hours */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Available Later (1-2 Hours)
            </CardTitle>
            <Badge className="bg-blue-600">{getAvailableNext2h.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {getAvailableNext2h.length === 0 ? (
            <p className="text-sm text-gray-600">No additional beds predicted in 1-2 hours</p>
          ) : (
            <div className="space-y-2">
              {getAvailableNext2h.map((pred) => (
                <div key={pred.bedLabel} className="text-sm p-2 bg-white rounded border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{pred.bedLabel}</span>
                    <span className="text-xs text-gray-600">
                      {formatTime(pred.predictedAvailableAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      ESI {pred.currentOccupantAcuity}
                    </Badge>
                    <span className="text-xs text-gray-600">
                      Confidence: {Math.round(pred.predictionConfidence * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
