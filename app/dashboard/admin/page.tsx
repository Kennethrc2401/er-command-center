"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, DollarSign, Users, ShieldCheck, 
  TrendingUp, ArrowUpRight, Search, FileText, 
  Activity, PieChart, Lock, Eye
} from "lucide-react";

// Your Custom Components
import UnitRevenueSummary from "@/components/mgmt/UnitRevenueSummary";
import DashboardStats from "@/components/DashboardStats";
import RevenuePayerMix from "@/components/mgmt/RevenuePayerMix";
import ShiftHandoffModal from "@/components/mgmt/ShiftHandoffModal";
import SurgeAlertBanner from "@/components/alerts/SurgeAlertBanner";

export default function AdminDashboard() {
  const stats = useQuery(api.encounters.getERStats);
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  // Simulated payer mix for the analytics
  const payerMix = [
    { name: "Horizon BCBS", count: 42, color: "bg-blue-600" },
    { name: "United Healthcare", count: 25, color: "bg-emerald-600" },
    { name: "Medicare", count: 28, color: "bg-purple-600" },
    { name: "Aetna", count: 15, color: "bg-slate-400" },
    { name: "Self-Pay", count: 10, color: "bg-amber-500" },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 bg-slate-50/30 min-h-screen">
      
      {/* 1. ADMIN HEADER & TOGGLE */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">
            Unit Ops <span className="text-blue-600">Command</span>
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            Hackensack Meridian Health | Emergency Dept 4B
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 px-3">
            {isPresentationMode ? <Lock className="h-3 w-3 text-blue-600" /> : <Eye className="h-3 w-3 text-slate-400" />}
            <span className={`text-[9px] font-black uppercase tracking-widest ${isPresentationMode ? 'text-blue-600' : 'text-slate-400'}`}>
              {isPresentationMode ? "Privacy Mode Active" : "Internal Data View"}
            </span>
          </div>
          <button 
            onClick={() => setIsPresentationMode(!isPresentationMode)}
            className={`relative w-14 h-7 rounded-full transition-all duration-500 ${isPresentationMode ? 'bg-blue-600 shadow-inner' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-500 ${isPresentationMode ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
        </div>
      </header>

      {/* NEW SURGE ALERT SYSTEM */}
       {stats && <SurgeAlertBanner stats={stats} />}

      {/* 2. OPERATIONAL KPI BAR */}
      <DashboardStats />

      {/* 3. MAIN ANALYTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* REVENUE & PAYER ANALYTICS (2/3) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Revenue Chart */}
          {stats && <UnitRevenueSummary stats={stats} isPresentationMode={isPresentationMode} />}
          
          {/* Payer Mix Visual (Fixed Nesting) */}
          <RevenuePayerMix payerData={payerMix} />
        </div>

        {/* REVENUE CYCLE TASKS (1/3) */}
        <aside className="space-y-6">
          <Card className="border-slate-900 bg-slate-900 text-white rounded-[2.5rem] overflow-hidden shadow-2xl">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Shift Collection Goal</p>
                <h2 className="text-4xl font-black italic">$2,500</h2>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                  <span>Current: ${stats?.dailyRevenue || 0}</span>
                  <span>{stats ? Math.round((stats.dailyRevenue / 2500) * 100) : 0}%</span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                  <div 
                    className="h-full bg-linear-to-r from-blue-500 to-emerald-400 transition-all duration-1000" 
                    style={{ width: `${stats ? Math.min(100, (stats.dailyRevenue / 2500) * 100) : 0}%` }} 
                  />
                </div>
              </div>

              <div className="pt-4 grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700/50">
                  <p className="text-[8px] font-black uppercase text-slate-500">Self-Pay</p>
                  <p className="text-sm font-bold text-slate-200">12 Patients</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700/50">
                  <p className="text-[8px] font-black uppercase text-slate-500">Unverified</p>
                  <p className="text-sm font-bold text-amber-400">{stats?.pendingInsurance || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QUICK ADMIN ACTIONS */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-2 italic">Admin Actions</h4>
            
            {/* SHIFT HANDOFF (Safely rendered) */}
            {stats && <ShiftHandoffModal stats={stats} />}

            <Link href="/dashboard/admin/audit" className="w-full">
              <Button className="w-full py-7 rounded-2xl bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 font-black text-[10px] uppercase tracking-widest shadow-sm gap-3 group">
                <ShieldCheck className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                Identity Audit Log (Full Unit)
              </Button>
            </Link>

            <Button className="w-full py-7 rounded-2xl bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 font-black text-[10px] uppercase tracking-widest shadow-sm gap-3 group">
              <Activity className="h-4 w-4 text-purple-600 group-hover:animate-pulse" />
              ESI vs. Payer Disparity Analysis
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}