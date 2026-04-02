"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Stethoscope, Star } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

export function SpecialistAssignmentPanel({ encounterId, requiredSpecialties }: { encounterId: string; requiredSpecialties?: string[] }) {
  const encounterId_ = encounterId as Id<"encounters">;
  const specialists = useQuery(api.workflow.getSpecialistMatches, {
    encounterId: encounterId_,
    requiredSpecialties,
  });

  const [selectedSpecialist, setSelectedSpecialist] = useState<string | null>(null);

  if (!specialists) {
    return <div className="text-center py-6 text-gray-500">Loading specialist recommendations...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5" />
            Specialist Matches
          </CardTitle>
          <Badge variant="secondary">{specialists.length} available</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {specialists.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No matching specialists available
          </div>
        ) : (
          <div className="space-y-3">
            {specialists.map((spec) => (
              <div
                key={spec._id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedSpecialist === spec._id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedSpecialist(spec._id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{spec.name}</p>
                      {spec.hasRelevantSpecialty && (
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{spec.role}</p>
                    {spec.specialties && spec.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {spec.specialties.map((spec_) => (
                          <Badge key={spec_} variant="outline" className="text-xs">
                            {spec_}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    {/* Match Score */}
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round(spec.specialistScore)}
                    </div>
                    <p className="text-xs text-gray-600">match score</p>
                  </div>
                </div>

                {/* Workload Info */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t pt-2">
                  <div>
                    <span className="text-gray-600">Current Load:</span>{" "}
                    <span className="font-semibold">{spec.currentLoad}</span> patients
                  </div>
                  <div>
                    <span className="text-gray-600">Acuity Weight:</span>{" "}
                    <span className="font-semibold">{spec.acuityWeightedLoad}</span>
                  </div>
                </div>
              </div>
            ))}

            {selectedSpecialist && (
              <Button className="w-full mt-4 bg-green-600 hover:bg-green-700">
                Assign to Selected Specialist
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
