"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Clock, BedDouble, AlertCircle, ShieldAlert, DollarSign } from "lucide-react";

export default function DashboardStats() {
  const stats = useQuery(api.encounters.getERStats);

  if (!stats) return null;

  // 1. DYNAMIC STATUS LOGIC
  const getSystemStatus = (status: string, beds: number) => {
    if (beds <= 2 || status === "CRITICAL") {
      return { label: "CRITICAL LOAD", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" };
    }
    if (beds <= 5 || status === "HIGH_VOLUME") {
      return { label: "HIGH VOLUME", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" };
    }
    return { label: "NORMAL OPERATIONS", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" };
  };

  const currentStatus = getSystemStatus(stats.status, stats.availableBeds);

  const items = [
    { title: "Total Census", value: stats.totalPatients, icon: Users, color: "text-blue-600" },
    { title: "High Acuity (1-2)", value: stats.highAcuity, icon: Activity, color: "text-red-600" },
    { title: "Boarding Patients", value: stats.boardingPatients, icon: Clock, color: "text-orange-600" },
    { title: "Available Beds", value: stats.availableBeds, icon: BedDouble, color: "text-emerald-600" },
    { 
      title: "Insurance Tasks", 
      value: stats.pendingInsurance, 
      icon: ShieldAlert, 
      color: stats.pendingInsurance > 0 ? "text-amber-500" : "text-slate-300" 
    },
    { 
      title: "POS Collected", 
      value: `$${stats.dailyRevenue}`, 
      icon: DollarSign, 
      color: "text-emerald-600",
      description: `${stats.collectionCount} Transactions Today`
    }
  ];

  return (
    <div className="space-y-4 mb-8">
      {/* 2. DYNAMIC SYSTEM STATUS BAR */}
      <div className={`flex items-center justify-between px-6 py-3 rounded-2xl border ${currentStatus.bg} ${currentStatus.border} transition-all duration-500`}>
        <div className="flex items-center gap-3">
          <div className={`relative flex h-3 w-3`}>
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${currentStatus.label === "NORMAL OPERATIONS" ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${currentStatus.label === "NORMAL OPERATIONS" ? 'bg-emerald-500' : 'bg-red-600'}`}></span>
          </div>
          <span className={`text-xs font-black uppercase tracking-[0.2em] ${currentStatus.color}`}>
            System Status: {currentStatus.label}
          </span>
        </div>
        
        {stats.status === "CRITICAL" && (
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
            <AlertCircle className="h-3.5 w-3.5" />
            Ambulance Diversion Recommended
          </div>
        )}
      </div>

      {/* 3. STAT CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <Card key={item.title} className="border-none shadow-sm bg-white rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {item.title}
              </CardTitle>
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tighter text-slate-900">{item.value}</div>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {item.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}