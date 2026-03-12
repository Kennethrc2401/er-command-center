"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, ReferenceArea 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Loader2, LineChart as ChartIcon } from "lucide-react";

// --- INTERFACES ---
interface VitalsPoint {
  time: string;
  hr: number;
  spO2: number;
  bp: string;      // The raw string from the database (e.g., "120/80")
  sbp: number;     // The parsed Systolic value for the chart Y-axis
  recordedAt: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: VitalsPoint;
  }>;
  label?: string;
}

// --- COMPONENTS ---
const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-xl ring-1 ring-black/5">
        <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-tighter">
          Logged at {label}
        </p>
        <div className="space-y-1">
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <span className="text-[11px] font-bold text-slate-500">{entry.name}:</span>
              <span 
                style={{ color: entry.color }} 
                className="text-xs font-black"
              >
                {entry.value}{entry.name === 'SpO2' ? '%' : entry.name === 'Systolic' ? ' mmHg' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function VitalsTrend({ encounterId }: { encounterId: Id<"encounters"> }) {
  const history = useQuery(api.vitals.getHistory, { encounterId });

  // 1. Loading State
  if (history === undefined) return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <div className="h-62.5 flex items-center justify-center text-slate-400 bg-slate-50/50">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> 
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Accessing Telemetry...</span>
      </div>
    </Card>
  );

  // 2. Data Transformation (Parsing BP string to SBP number)
  const formattedData: VitalsPoint[] = history?.map(v => {
    const bpString = v.bp || "0/0";
    return {
      ...v,
      bp: bpString,
      // Extract first number from "120/80"
      sbp: parseInt(bpString?.split('/')[0]) || 0 
    };
  }) || [];

  // 3. Empty State
  if (formattedData.length === 0) return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 bg-slate-50/50 border-b">
        <CardTitle className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-400">
          <Activity className="h-4 w-4" />
          Clinical Hemodynamics
        </CardTitle>
      </CardHeader>
      <CardContent className="h-55 flex flex-col items-center justify-center bg-white text-center p-6">
        <div className="p-3 bg-slate-50 rounded-full mb-3 text-slate-200">
          <ChartIcon className="h-6 w-6" />
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">No Vitals History</p>
        <p className="text-[10px] text-slate-300 mt-1 max-w-45">
          Record a new set of vitals to begin clinical trend monitoring.
        </p>
      </CardContent>
    </Card>
  );

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 bg-slate-50/50 border-b">
        <CardTitle className="text-[11px] font-black uppercase tracking-widest flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-slate-500">
            <Activity className="h-4 w-4 text-red-500" />
            Clinical Hemodynamics
          </div>
          <div className="flex items-center gap-1">
             <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[9px] text-emerald-600 uppercase tracking-tighter">Live Monitor</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-55 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="time" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: '#94a3b8' }}
              />
              <YAxis 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: '#94a3b8' }}
                domain={[40, 'auto']} 
              />
              
              {/* Highlight Hypoxemia Zone (Critical < 90%) */}
              <ReferenceArea 
                y1={0} 
                y2={90} 
                fill="#fee2e2" 
                fillOpacity={0.4} 
                stroke="none"
              />

              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle" 
                wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
              />
              
              {/* HEART RATE - RED */}
              <Line 
                type="monotone" 
                dataKey="hr" 
                name="Heart Rate" 
                stroke="#ef4444" 
                strokeWidth={3} 
                dot={{ r: 4, strokeWidth: 2, fill: 'white' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />

              {/* SYSTOLIC BP - INDIGO */}
              <Line 
                type="monotone" 
                dataKey="sbp" 
                name="Systolic" 
                stroke="#6366f1" 
                strokeWidth={3} 
                dot={{ r: 4, strokeWidth: 2, fill: 'white' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />

              {/* SpO2 - SKY BLUE */}
              <Line 
                type="monotone" 
                dataKey="spO2" 
                name="SpO2" 
                stroke="#0ea5e9" 
                strokeWidth={3} 
                dot={{ r: 4, strokeWidth: 2, fill: 'white' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}