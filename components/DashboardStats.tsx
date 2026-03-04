"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Clock, BedDouble } from "lucide-react";

export default function DashboardStats() {
  const stats = useQuery(api.encounters.getERStats);

  if (!stats) return null;

  const items = [
    { title: "Total Census", value: stats.totalPatients, icon: Users, color: "text-blue-600" },
    { title: "High Acuity (1-2)", value: stats.highAcuity, icon: Activity, color: "text-red-600" },
    { title: "Avg Wait (Min)", value: stats.averageWaitTime, icon: Clock, color: "text-orange-600" },
    { title: "Available Beds", value: stats.availableBeds, icon: BedDouble, color: "text-emerald-600" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {items.map((item) => (
        <Card key={item.title} className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">{item.title}</CardTitle>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}