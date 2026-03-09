"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Users, 
  LogOut, 
  Clock, 
  AlertTriangle, 
  GitPullRequest, 
  Activity,
  Stethoscope,
  TrendingDown
} from "lucide-react";
import { 
  Area, 
  AreaChart, 
  Cell, 
  Pie, 
  PieChart, 
  ResponsiveContainer, 
  Tooltip 
} from "recharts";
import { usePresentationMode } from "@/lib/hooks/usePresentationMode";

// --- Types to resolve ESLint 'any' errors ---

interface HighRiskPatient {
  name: string;
  issue: string;
  location: string;
}

interface AcuityData {
  name: string;
  value: number;
  fill: string;
}

interface TrendPoint {
  value: number;
}

interface MetricProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: React.ReactNode;
  alert?: boolean;
  active?: boolean;
  children?: React.ReactNode;
}

interface ShiftSummaryProps {
  onFilterChange: (filter: string | null) => void;
  activeFilter: string | null;
}

export default function ShiftSummary({ onFilterChange, activeFilter }: ShiftSummaryProps) {
  const metrics = useQuery(api.encounters.getShiftMetrics);
  const { isDemoMode } = usePresentationMode();

  const formatPatientName = (name: string) => {
    if (!isDemoMode) return name;

    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return `${parts[0][0]}. ${parts[1]}`;
    }
    return `Patient-${name.length}${name.charCodeAt(0)}`;
  };

  if (!metrics) return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 opacity-50">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-24 bg-slate-100 rounded-3xl animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="space-y-4 mb-8">
      {/* 1. HIGH RISK VITALS TICKER */}
      {metrics?.highRiskPatients && metrics.highRiskPatients.length > 0 && (
        <div className="bg-red-600 overflow-hidden py-2 rounded-xl shadow-lg shadow-red-200 mb-6">
          <div className="flex animate-marquee whitespace-nowrap items-center">
            {[...metrics.highRiskPatients, ...metrics.highRiskPatients].map((p, i) => (
              <span key={i} className="mx-8 flex items-center gap-2 text-white text-[10px] font-black uppercase tracking-tighter">
                <Activity className="h-3 w-3 animate-pulse" />
                CRITICAL VITALS: {formatPatientName(p.name)} ({p.location}) {isDemoMode ? "- Sensitive details hidden" : `- ${p.issue}`}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* 2. THE METRIC CARDS (Left Side) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 grow">
          
          <MetricCard 
            label="Staff Ratio" 
            value={`1:${metrics.staffRatio}`} 
            icon={<Stethoscope className="h-5 w-5 text-indigo-600" />} 
            color="bg-indigo-50"
            alert={metrics.staffRatio > 6}
            subtitle={metrics.staffRatio > 6 ? "Critical Ratio" : "Safe"}
          />

          <MetricCard 
            label="Avg TTP" 
            value={`${metrics.avgTTP}m`} 
            icon={<Activity className="h-5 w-5 text-orange-600" />} 
            color="bg-orange-50"
            alert={metrics.avgTTP > metrics.ttpTarget}
            subtitle={
              <div className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                <span>Goal: {metrics.ttpTarget}m</span>
              </div>
            }
          />

          <MetricCard 
            label="Avg LOS" 
            value={`${metrics.avgLOS}m`} 
            icon={<Clock className="h-5 w-5 text-purple-600" />} 
            color="bg-purple-50"
            alert={metrics.avgLOS > 240}
          >
            <div className="h-8 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.losTrend as TrendPoint[]}>
                  <Area type="monotone" dataKey="value" stroke="#9333ea" fill="#f3e8ff" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </MetricCard>

          {/* INTERACTIVE CARDS */}
          <div onClick={() => onFilterChange(activeFilter === "Bottle-Neck" ? null : "Bottle-Neck")} className="cursor-pointer">
            <MetricCard 
              label="Bottle-Neck" 
              value={metrics.bottleneckStatus} 
              icon={<GitPullRequest className="h-5 w-5 text-amber-600" />} 
              color="bg-amber-50"
              active={activeFilter === "Bottle-Neck"}
              subtitle={`${metrics.bottleneckCount} Patients Stuck`}
            />
          </div>

          <div onClick={() => onFilterChange(activeFilter === "Critical" ? null : "Critical")} className="cursor-pointer">
            <MetricCard 
              label="Critical (ESI 1)" 
              value={metrics.criticalCount} 
              icon={<AlertTriangle className="h-5 w-5 text-red-600" />} 
              color="bg-red-50"
              alert={metrics.criticalCount > 0}
              active={activeFilter === "Critical"}
              subtitle={metrics.criticalCount > 0 ? "Immediate Action" : "Stable"}
            />
          </div>

          <MetricCard 
            label="Total Census" 
            value={metrics.activeCount} 
            icon={<Users className="h-5 w-5 text-blue-600" />} 
            color="bg-blue-50"
          />
        </div>

        {/* 3. ACUITY PIE CHART (Right Side) */}
        <Card className="border-none shadow-sm bg-white w-full lg:w-72 overflow-hidden">
          <CardContent className="p-4 flex flex-col h-full">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">Acuity Mix</p>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.acuityDist as AcuityData[]}
                    innerRadius={35}
                    outerRadius={50}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(metrics.acuityDist as AcuityData[]).map((entry: AcuityData, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ fontSize: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
              {(metrics.acuityDist as AcuityData[]).map((d: AcuityData) => (
                <div key={d.name} className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: d.fill }} />
                  <span className="text-[8px] font-black text-slate-500 uppercase">{d.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}



function MetricCard({ label, value, icon, color, subtitle, alert, active, children }: MetricProps) {
  return (
    <Card className={`border-none shadow-sm transition-all duration-300 ${
      alert ? 'ring-2 ring-red-500 bg-red-50/10' : active ? 'ring-2 ring-blue-500 bg-blue-50/10' : 'bg-white'
    }`}>
      <CardContent className="p-4 flex flex-col h-full justify-center">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${color} shrink-0`}>
            {icon}
          </div>
          <div className="min-w-0 text-left">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest truncate">{label}</p>
            <h3 className={`text-lg font-black leading-none mt-1 capitalize ${
              alert && (label.includes("Critical") || label.includes("Ratio")) ? "text-red-600" : "text-slate-900"
            }`}>
              {value}
            </h3>
            {subtitle && (
              <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase truncate">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}