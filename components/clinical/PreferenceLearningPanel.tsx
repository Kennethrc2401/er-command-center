"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Brain } from "lucide-react";

interface PreferenceData {
  category: string;
  value: string;
  preference: "prefer" | "neutral" | "avoid";
  successRate: number;
  matchCount: number;
}

export function PreferenceLearningPanel({ providerName }: { providerName: string }) {
  const preferences: PreferenceData[] = [];

  const getPreferenceIcon = (pref: string) => {
    switch (pref) {
      case "prefer":
        return "👍";
      case "avoid":
        return "👎";
      default:
        return "➖";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Learning Profile: {providerName}
          </CardTitle>
          <Badge variant="secondary">{preferences.length} preferences</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {preferences.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No preference data yet. Assignments will build this profile.
          </div>
        ) : (
          <div className="space-y-3">
            {preferences.map((pref, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border-2 ${
                  pref.preference === "prefer"
                    ? "border-green-200 bg-green-50"
                    : pref.preference === "avoid"
                      ? "border-red-200 bg-red-50"
                      : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getPreferenceIcon(pref.preference)}</span>
                      <span className="text-sm font-semibold">{pref.value}</span>
                      <span className="text-xs text-gray-600">({pref.category})</span>
                    </div>

                    {/* Success Rate Bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-300 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            pref.preference === "prefer"
                              ? "bg-green-600"
                              : pref.preference === "avoid"
                                ? "bg-red-600"
                                : "bg-gray-600"
                          }`}
                          style={{ width: `${pref.successRate * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold w-12 text-right">
                        {Math.round(pref.successRate * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <TrendingUp className="w-3 h-3" />
                  {pref.matchCount} assignment{pref.matchCount !== 1 ? "s" : ""}
                </div>
              </div>
            ))}

            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mt-4">
              <p className="text-xs text-blue-900">
                <strong>How it works:</strong> The system learns from each assignment outcome to identify your
                preferences and strengths, improving future recommendations over time.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
