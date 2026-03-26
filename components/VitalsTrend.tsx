"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, ReferenceArea 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Loader2, LineChart as ChartIcon } from "lucide-react";
import { toast } from "sonner";
import type { ActorRole } from "@/lib/auth/roles";

// --- INTERFACES ---
interface VitalsPoint {
  time: string;
  hr: number;
  spO2: number;
  temp: number;
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

const ESCALATION_WINDOW_MS = 30 * 60 * 1000;

function formatElapsedDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${totalMinutes}m`;
}

function getSepsisSignals(point: VitalsPoint) {
  const signals: string[] = [];

  if (point.hr >= 90) signals.push(`HR ${point.hr} bpm`);
  if (point.temp >= 100.4 || point.temp <= 96.8) signals.push(`Temp ${point.temp.toFixed(1)}F`);
  if (point.spO2 <= 92) signals.push(`SpO2 ${point.spO2}%`);
  if (point.sbp > 0 && point.sbp <= 100) signals.push(`SBP ${point.sbp} mmHg`);

  return signals;
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

export default function VitalsTrend({
  encounterId,
  actorName = "Clinical Staff",
  actorRole = "UNKNOWN",
}: {
  encounterId: Id<"encounters">;
  actorName?: string;
  actorRole?: ActorRole;
}) {
  const history = useQuery(api.vitals.getHistory, { encounterId });
  const persistedSepsisAck = useQuery(api.vitals.getLatestSepsisWatchAck, { encounterId });
  const acknowledgeSepsisWatch = useMutation(api.vitals.acknowledgeSepsisWatch);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [optimisticAckAt, setOptimisticAckAt] = useState<number | null>(null);
  const [ackSaving, setAckSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // 2. Data Transformation (Parsing BP string to SBP number)
  const formattedData: VitalsPoint[] = useMemo(
    () =>
      (history ?? []).map((v) => {
        const bpString = v.bp || "0/0";
        return {
          ...v,
          bp: bpString,
          // Extract first number from "120/80"
          sbp: parseInt(bpString?.split("/")[0]) || 0,
        };
      }),
    [history]
  );

  const sepsisWatch = useMemo(() => {
    if (formattedData.length === 0) {
      return {
        active: false,
        latestSignals: [] as string[],
        triggeredAt: null as number | null,
      };
    }

    const latest = formattedData[formattedData.length - 1];
    const latestSignals = getSepsisSignals(latest);
    const active = latestSignals.length >= 2;

    if (!active) {
      return {
        active: false,
        latestSignals,
        triggeredAt: null,
      };
    }

    const triggerPoint = formattedData.find((point) => getSepsisSignals(point).length >= 2) ?? latest;

    return {
      active: true,
      latestSignals,
      triggeredAt: triggerPoint.recordedAt,
    };
  }, [formattedData]);

  useEffect(() => {
    if (!sepsisWatch.active) {
      if (optimisticAckAt !== null) setOptimisticAckAt(null);
      return;
    }

    const persistedAckAt = persistedSepsisAck?.acknowledgedAt ?? null;
    if (
      optimisticAckAt &&
      persistedAckAt &&
      persistedAckAt >= optimisticAckAt
    ) {
      setOptimisticAckAt(null);
    }

    const activeAckAt = Math.max(persistedAckAt ?? 0, optimisticAckAt ?? 0) || null;
    if (activeAckAt && sepsisWatch.triggeredAt && sepsisWatch.triggeredAt > activeAckAt) {
      setOptimisticAckAt(null);
    }
  }, [sepsisWatch, optimisticAckAt, persistedSepsisAck]);

  const escalationElapsedMs = sepsisWatch.active && sepsisWatch.triggeredAt
    ? Math.max(0, nowTs - sepsisWatch.triggeredAt)
    : 0;
  const escalationPastWindow = escalationElapsedMs >= ESCALATION_WINDOW_MS;
  const escalationElapsedLabel = formatElapsedDuration(escalationElapsedMs);
  const persistedAckAt = persistedSepsisAck?.acknowledgedAt ?? null;
  const activeAckAt = Math.max(persistedAckAt ?? 0, optimisticAckAt ?? 0) || null;
  const acknowledgedByName = persistedSepsisAck?.acknowledgedBy ?? (optimisticAckAt ? actorName : null);
  const acknowledgedByRole = persistedSepsisAck?.acknowledgedByRole ?? (optimisticAckAt ? actorRole : null);
  const escalationAcknowledged = Boolean(
    sepsisWatch.active &&
    sepsisWatch.triggeredAt &&
    activeAckAt &&
    activeAckAt >= sepsisWatch.triggeredAt
  );

  const acknowledgeEscalation = async () => {
    if (!sepsisWatch.active || !sepsisWatch.triggeredAt || ackSaving) return;

    const ackAt = Date.now();
    setOptimisticAckAt(ackAt);
    setAckSaving(true);

    try {
      await acknowledgeSepsisWatch({
        encounterId,
        actorName,
        actorRole,
        triggeredAt: sepsisWatch.triggeredAt,
        signals: sepsisWatch.latestSignals,
      });
      toast.success("Sepsis escalation acknowledged.");
    } catch (error) {
      setOptimisticAckAt(null);
      const message = error instanceof Error ? error.message : "Unable to acknowledge sepsis escalation.";
      toast.error(message);
    } finally {
      setAckSaving(false);
    }
  };

  // 1. Loading State
  if (history === undefined) {
    return (
      <Card className="border-slate-200 shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="h-62.5 flex items-center justify-center text-slate-400 bg-slate-50/50">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Accessing Telemetry...</span>
        </div>
      </Card>
    );
  }

  // 3. Empty State
  if (formattedData.length === 0) {
    return (
      <Card className="border-slate-200 shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="pb-2 bg-slate-50/50 border-b dark:border-slate-800 dark:bg-slate-900">
          <CardTitle className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-600 dark:text-slate-100">
            <Activity className="h-4 w-4" />
            Clinical Hemodynamics
          </CardTitle>
        </CardHeader>
        <CardContent className="h-55 flex flex-col items-center justify-center bg-white text-center p-6 dark:bg-slate-900">
          <div className="p-3 bg-slate-50 rounded-full mb-3 text-slate-200 dark:bg-slate-800 dark:text-slate-400">
            <ChartIcon className="h-6 w-6" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-tight dark:text-slate-300">No Vitals History</p>
          <p className="text-[10px] text-slate-300 mt-1 max-w-45 dark:text-slate-400">
            Record a new set of vitals to begin clinical trend monitoring.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="pb-2 bg-slate-50/50 border-b dark:border-slate-800 dark:bg-slate-900">
        <CardTitle className="text-[11px] font-black uppercase tracking-widest flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-100">
            <Activity className="h-4 w-4 text-red-500" />
            Clinical Hemodynamics
          </div>
          <div className="flex items-center gap-1">
             <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[9px] text-emerald-600 uppercase tracking-tighter dark:text-emerald-300">Live Monitor</span>
          </div>
        </CardTitle>
      </CardHeader>
      {sepsisWatch.active && (
        <div className="mx-6 mt-4 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 dark:border-rose-500/40 dark:bg-rose-500/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
                Sepsis Watch Escalation
              </p>
              <p className="mt-1 flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-200">
                <Clock3 className="h-3.5 w-3.5" />
                Running for {escalationElapsedLabel}
                {escalationPastWindow && (
                  <span className="uppercase tracking-wide text-rose-600 dark:text-rose-300">(exceeds 30m)</span>
                )}
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              variant={escalationAcknowledged ? "outline" : "default"}
              onClick={acknowledgeEscalation}
              disabled={ackSaving}
              className={
                escalationAcknowledged
                  ? "h-8 gap-1.5 border-emerald-300 bg-emerald-50 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                  : "h-8 gap-1.5 bg-rose-600 text-[10px] font-black uppercase tracking-widest text-white hover:bg-rose-700"
              }
            >
              {escalationAcknowledged ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {escalationAcknowledged
                ? `Acknowledged ${new Date(activeAckAt as number).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : ackSaving
                  ? "Saving..."
                  : "Acknowledge Escalation"}
            </Button>
          </div>

          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-200">
            Trigger signals: {sepsisWatch.latestSignals.join(" • ")}
          </p>
          {escalationAcknowledged && acknowledgedByName && (
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Acknowledged by {acknowledgedByName}
              {acknowledgedByRole ? ` (${acknowledgedByRole})` : ""}
            </p>
          )}
        </div>
      )}
      <CardContent className="pt-6 dark:bg-slate-900">
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