"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Clock,
  Download,
  FileText,
  Filter,
  Pause,
  Play,
  ShieldAlert,
  StepBack,
  StepForward,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

type TimelineEvent = {
  type: "VITALS" | "DOCUMENT" | "ORDER" | "NOTE" | "AUDIT";
  time?: number;
  title: string;
  description: string;
  actor?: string;
  priority?: "normal" | "attention" | "critical";
};

const TYPE_STYLES: Record<TimelineEvent["type"], { icon: typeof Activity; badge: string }> = {
  VITALS: { icon: Activity, badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  DOCUMENT: { icon: FileText, badge: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  ORDER: { icon: Stethoscope, badge: "bg-blue-100 text-blue-700 border-blue-200" },
  NOTE: { icon: FileText, badge: "bg-violet-100 text-violet-700 border-violet-200" },
  AUDIT: { icon: ShieldAlert, badge: "bg-amber-100 text-amber-700 border-amber-200" },
};

function formatEventTime(value?: number) {
  if (!value) return "Unknown time";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PatientTimeline({ encounterId, patientId }: { encounterId: Id<"encounters">; patientId: Id<"patients"> }) {
  const events = useQuery(api.encounters.getPatientTimeline, { encounterId, patientId }) as TimelineEvent[] | undefined;
  const [playheadIndex, setPlayheadIndex] = useState(Number.MAX_SAFE_INTEGER);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [typeFilter, setTypeFilter] = useState<"ALL" | TimelineEvent["type"]>("ALL");
  const [criticalOnly, setCriticalOnly] = useState(false);

  const chronologicalEvents = useMemo(
    () => (events ? [...events].sort((a, b) => (a.time ?? 0) - (b.time ?? 0)) : []),
    [events]
  );

  const replayEvents = useMemo(
    () =>
      chronologicalEvents.filter((event) => {
        const matchesType = typeFilter === "ALL" || event.type === typeFilter;
        const matchesPriority = !criticalOnly || event.priority === "critical";
        return matchesType && matchesPriority;
      }),
    [chronologicalEvents, typeFilter, criticalOnly]
  );

  const safePlayheadIndex = replayEvents.length === 0
    ? 0
    : Math.min(Math.max(playheadIndex, 0), replayEvents.length - 1);

  const jumpToLatest = () => {
    setIsPlaying(false);
    setPlayheadIndex(Number.MAX_SAFE_INTEGER);
  };

  const applyTypeFilter = (option: "ALL" | TimelineEvent["type"]) => {
    setTypeFilter(option);
    jumpToLatest();
  };

  const toggleCriticalOnly = () => {
    setCriticalOnly((prev) => !prev);
    jumpToLatest();
  };

  const resetFilters = () => {
    setTypeFilter("ALL");
    setCriticalOnly(false);
    jumpToLatest();
  };

  useEffect(() => {
    if (!isPlaying || replayEvents.length <= 1) return;

    const interval = window.setInterval(() => {
      setPlayheadIndex((prev) => {
        if (prev >= replayEvents.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, Math.max(400, Math.floor(1400 / playbackSpeed)));

    return () => window.clearInterval(interval);
  }, [isPlaying, playbackSpeed, replayEvents.length]);

  const exportReplay = () => {
    if (replayEvents.length === 0) {
      toast.error("No events to export for the selected filters.");
      return;
    }

    const lines = [
      `Encounter Timeline Export`,
      `Encounter ID: ${encounterId}`,
      `Patient ID: ${patientId}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Filter: ${typeFilter}${criticalOnly ? " + critical only" : ""}`,
      "",
      ...replayEvents.map((event, index) => {
        const when = formatEventTime(event.time);
        const actor = event.actor ? ` | Actor: ${event.actor}` : "";
        const priority = event.priority ? ` | Priority: ${event.priority.toUpperCase()}` : "";
        return `${index + 1}. [${event.type}] ${event.title} @ ${when}${actor}${priority}\n${event.description}`;
      }),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `encounter-timeline-${timestamp}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);

    toast.success("Encounter timeline exported.");
  };

  if (!events) return <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500 animate-pulse">Loading Clinical History...</div>;
  if (chronologicalEvents.length === 0) {
    return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">No timeline events yet for this encounter.</div>;
  }

  if (replayEvents.length === 0) {
    return (
      <div className="space-y-4">
        <div className="mb-2 flex items-center gap-2 px-1">
          <Clock className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Encounter Timeline Replay</span>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center">
          <p className="text-sm font-bold text-slate-600">No events match the current filters.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              resetFilters();
            }}
            className="mt-4"
          >
            Reset Filters
          </Button>
        </div>
      </div>
    );
  }

  const activeEvent = replayEvents[safePlayheadIndex];
  const progressPercent = replayEvents.length > 1 ? (safePlayheadIndex / (replayEvents.length - 1)) * 100 : 100;

  return (
    <div className="space-y-5">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Clock className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Encounter Timeline Replay</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Filters</span>
            {(["ALL", "VITALS", "ORDER", "DOCUMENT", "NOTE", "AUDIT"] as const).map((option) => (
              <button
                key={option}
                onClick={() => applyTypeFilter(option)}
                className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                  typeFilter === option
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {option}
              </button>
            ))}
            <button
              onClick={() => toggleCriticalOnly()}
              className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                criticalOnly
                  ? "border-rose-600 bg-rose-600 text-white"
                  : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              Critical Only
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportReplay}
            className="h-8 gap-1 text-[10px] font-black uppercase tracking-wide"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Replay Playhead</p>
            <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">{activeEvent.title}</p>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-300">{formatEventTime(activeEvent.time)}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsPlaying(false);
                setPlayheadIndex(0);
              }}
              className="h-8 gap-1 text-[10px] font-black uppercase tracking-wide"
            >
              <StepBack className="h-3.5 w-3.5" /> Start
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsPlaying((prev) => !prev)}
              className="h-8 gap-1 bg-blue-600 text-[10px] font-black uppercase tracking-wide hover:bg-blue-700"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                jumpToLatest();
              }}
              className="h-8 gap-1 text-[10px] font-black uppercase tracking-wide"
            >
              <StepForward className="h-3.5 w-3.5" /> Latest
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, replayEvents.length - 1)}
            value={safePlayheadIndex}
            onChange={(event) => {
              setIsPlaying(false);
              setPlayheadIndex(Number(event.target.value));
            }}
            className="w-full accent-blue-600"
          />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-wide text-slate-400">
              {safePlayheadIndex + 1}/{replayEvents.length} events (of {chronologicalEvents.length} total)
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                    playbackSpeed === speed
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="relative ml-3 space-y-6 before:absolute before:inset-0 before:ml-1 before:-translate-x-px before:h-full before:w-0.5 before:bg-linear-to-b before:from-blue-500 before:via-slate-200 before:to-transparent">
        {replayEvents.map((event, idx) => {
          const relation = idx < safePlayheadIndex ? "past" : idx === safePlayheadIndex ? "current" : "future";
          const eventType = TYPE_STYLES[event.type] ?? TYPE_STYLES.NOTE;
          const Icon = eventType.icon;

          return (
          <div
            key={`${event.type}-${event.time ?? idx}-${idx}`}
            className={`group relative flex items-start gap-5 transition-opacity ${relation === "future" ? "opacity-45" : "opacity-100"}`}
          >
            {/* The Node Dot */}
            <div className={`absolute left-0 mt-2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white transition-colors ${
              relation === "current"
                ? "bg-blue-600 ring-4 ring-blue-100"
                : event.type === "VITALS"
                  ? "bg-emerald-500"
                  : "bg-slate-400"
            }`} />

            <div className={`flex-1 rounded-2xl border bg-white p-4 shadow-sm transition-all sm:p-5 ${
              relation === "current"
                ? "border-blue-300 ring-2 ring-blue-100"
                : "border-slate-100 group-hover:border-blue-200"
            }`}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  {formatEventTime(event.time)}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wide ${eventType.badge}`}>
                    {event.type}
                  </span>
                  <Icon className="h-3.5 w-3.5 text-slate-600" />
                </div>
              </div>
              <h4 className="text-xs font-black uppercase leading-tight text-slate-900 sm:text-[13px]">
                {event.title}
              </h4>
              <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-slate-600 sm:text-xs">
                {event.description}
              </p>
              {event.actor && (
                <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Actor: {event.actor}
                </p>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}