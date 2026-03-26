"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle2, Clock3, ShieldAlert, Sparkles, Syringe, Trophy } from "lucide-react";

type SimPhase = "prep" | "timeout" | "procedure" | "closure" | "done";

type SimEvent = {
  id: string;
  prompt: string;
  choices: Array<{ id: string; label: string; isBest: boolean; feedback: string }>;
};

type Scenario = {
  id: string;
  name: string;
  subtitle: string;
  events: SimEvent[];
};

type LeaderboardRow = {
  scenarioId: string;
  scenarioName: string;
  score: number;
  timeSec: number;
  achievedAt: number;
};

const LEADERBOARD_STORAGE_KEY = "training-or-sim-leaderboard-v1";

const SCRUB_CHECKLIST = [
  "Surgical scrub complete",
  "Sterile gown and gloves confirmed",
  "Instrument table verified",
  "Antibiotic timing checked",
];

const SCENARIOS: Scenario[] = [
  {
    id: "lap-appendectomy",
    name: "Laparoscopic Appendectomy",
    subtitle: "Routine case with hemodynamic and closure safety checks.",
    events: [
      {
        id: "bp-drop",
        prompt: "Blood pressure trends down to 88/54 during dissection.",
        choices: [
          { id: "ignore", label: "Continue without adjustment", isBest: false, feedback: "Team missed early hemodynamic correction." },
          { id: "fluids", label: "Call anesthesia, volume bolus, reassess", isBest: true, feedback: "Great response. Perfusion stabilized and procedure continues safely." },
          { id: "finish-fast", label: "Rush to closure immediately", isBest: false, feedback: "Premature closure without stabilization increased risk." },
        ],
      },
      {
        id: "count-check",
        prompt: "Scrub tech requests a count reconciliation before closure.",
        choices: [
          { id: "skip", label: "Skip count to save time", isBest: false, feedback: "Unsafe workflow. Count verification is mandatory." },
          { id: "confirm", label: "Pause and complete full count", isBest: true, feedback: "Correct. Count verified and closure can proceed." },
          { id: "delegate", label: "Defer until patient leaves OR", isBest: false, feedback: "Count delay increases retained-item risk." },
        ],
      },
      {
        id: "o2",
        prompt: "SpO2 drops from 99% to 91% after repositioning.",
        choices: [
          { id: "observe", label: "Observe for 10 minutes", isBest: false, feedback: "Delayed action increased instability." },
          { id: "airway", label: "Notify anesthesia and optimize airway/ventilation", isBest: true, feedback: "Excellent. Saturation recovered to baseline." },
          { id: "abort", label: "Abort immediately without assessment", isBest: false, feedback: "Assessment should happen before abrupt abort decisions." },
        ],
      },
    ],
  },
  {
    id: "lap-chole",
    name: "Laparoscopic Cholecystectomy",
    subtitle: "Biliary case with anatomy verification and bleeding control decisions.",
    events: [
      {
        id: "critical-view",
        prompt: "Team is about to clip structures, but anatomy view is not fully clear.",
        choices: [
          { id: "clip-now", label: "Proceed with clipping to maintain pace", isBest: false, feedback: "Unsafe. Critical view should be confirmed first." },
          { id: "retract-and-confirm", label: "Pause, improve exposure, confirm critical view", isBest: true, feedback: "Excellent safety step before clipping." },
          { id: "convert-immediate", label: "Convert to open without reassessment", isBest: false, feedback: "Conversion can be considered, but reassessment should come first." },
        ],
      },
      {
        id: "ooze",
        prompt: "Diffuse oozing develops in the gallbladder fossa.",
        choices: [
          { id: "irrigate-only", label: "Irrigate and close quickly", isBest: false, feedback: "Source control and hemostasis were incomplete." },
          { id: "hemostasis", label: "Apply targeted hemostasis and reassess field", isBest: true, feedback: "Hemostasis achieved and field remains clear." },
          { id: "ignore-trend", label: "Ignore while anesthesia monitors", isBest: false, feedback: "Surgical hemostasis cannot be deferred." },
        ],
      },
      {
        id: "specimen-label",
        prompt: "Specimen cup is present but not labeled at back table.",
        choices: [
          { id: "send-unlabeled", label: "Send now and label later", isBest: false, feedback: "Chain-of-custody process failed." },
          { id: "pause-label", label: "Pause and complete label/read-back", isBest: true, feedback: "Correct specimen safety protocol." },
          { id: "skip-path", label: "Discard specimen to avoid delay", isBest: false, feedback: "Specimen handling standards were violated." },
        ],
      },
    ],
  },
  {
    id: "trauma-exlap",
    name: "Trauma Exploratory Laparotomy",
    subtitle: "High-acuity trauma flow with rapid prioritization under pressure.",
    events: [
      {
        id: "massive-transfusion",
        prompt: "Blood loss escalates and MAP falls despite initial resuscitation.",
        choices: [
          { id: "continue-standard", label: "Continue standard fluids only", isBest: false, feedback: "Resuscitation escalation was delayed." },
          { id: "activate-mtp", label: "Activate massive transfusion and damage-control sequence", isBest: true, feedback: "Strong trauma response. Perfusion stabilized enough to proceed." },
          { id: "wait-labs", label: "Wait for full lab panel before action", isBest: false, feedback: "Action was too delayed for instability level." },
        ],
      },
      {
        id: "temp-closure",
        prompt: "Patient remains acidotic and hypothermic near end of first pass.",
        choices: [
          { id: "definitive-close", label: "Definitive closure now", isBest: false, feedback: "Physiology did not support definitive closure." },
          { id: "damage-control", label: "Damage-control closure and ICU transfer", isBest: true, feedback: "Appropriate damage-control strategy selected." },
          { id: "prolong-op", label: "Prolong operation for complete repair", isBest: false, feedback: "Extended operative time increased physiologic risk." },
        ],
      },
      {
        id: "handoff",
        prompt: "ICU receiving team requests concise operative handoff.",
        choices: [
          { id: "minimal", label: "Give only diagnosis and leave", isBest: false, feedback: "Handoff omitted key resuscitation and operative details." },
          { id: "structured", label: "Structured SBAR with resuscitation totals and next steps", isBest: true, feedback: "Excellent handoff quality and continuity." },
          { id: "chart-later", label: "Document later without verbal handoff", isBest: false, feedback: "Critical transitions require immediate handoff." },
        ],
      },
    ],
  },
];

function nextPhase(phase: SimPhase): SimPhase {
  if (phase === "prep") return "timeout";
  if (phase === "timeout") return "procedure";
  if (phase === "procedure") return "closure";
  if (phase === "closure") return "done";
  return "done";
}

export default function SurgerySimulation() {
  const [selectedScenarioId, setSelectedScenarioId] = useState(SCENARIOS[0].id);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [phase, setPhase] = useState<SimPhase>("prep");
  const [checklist, setChecklist] = useState<boolean[]>(() => SCRUB_CHECKLIST.map(() => false));
  const [eventIndex, setEventIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string>("Complete scrub prep to begin.");
  const [vitals, setVitals] = useState({ hr: 84, sbp: 122, dbp: 76, spo2: 99 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as LeaderboardRow[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const selectedScenario = useMemo(
    () => SCENARIOS.find((scenario) => scenario.id === selectedScenarioId) ?? SCENARIOS[0],
    [selectedScenarioId]
  );

  const currentEvent = selectedScenario.events[eventIndex] ?? null;
  const prepReady = checklist.every(Boolean);

  const persistLeaderboard = (nextRows: LeaderboardRow[]) => {
    setLeaderboard(nextRows);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(nextRows));
  };

  const addLeaderboardEntry = (finalScore: number, totalSeconds: number) => {
    const entry: LeaderboardRow = {
      scenarioId: selectedScenario.id,
      scenarioName: selectedScenario.name,
      score: finalScore,
      timeSec: totalSeconds,
      achievedAt: Date.now(),
    };

    const nextRows = [...leaderboard, entry]
      .sort((a, b) => b.score - a.score || a.timeSec - b.timeSec || b.achievedAt - a.achievedAt)
      .slice(0, 10);

    persistLeaderboard(nextRows);
  };

  useEffect(() => {
    if (!startedAt || phase === "done") return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, startedAt]);

  useEffect(() => {
    if (!startedAt || phase === "done") return;
    const vitalsTimer = window.setInterval(() => {
      setVitals((prev) => {
        const drift = phase === "procedure" ? 3 : 1;
        return {
          hr: Math.max(58, Math.min(128, prev.hr + Math.round((Math.random() - 0.5) * drift * 2))),
          sbp: Math.max(88, Math.min(150, prev.sbp + Math.round((Math.random() - 0.5) * drift * 2))),
          dbp: Math.max(50, Math.min(96, prev.dbp + Math.round((Math.random() - 0.5) * drift * 2))),
          spo2: Math.max(90, Math.min(100, prev.spo2 + Math.round((Math.random() - 0.5) * 2))),
        };
      });
    }, 1800);

    return () => window.clearInterval(vitalsTimer);
  }, [phase, startedAt]);

  const progress = useMemo(() => {
    if (phase === "done") return 100;
    const map: Record<SimPhase, number> = {
      prep: 20,
      timeout: 40,
      procedure: 70,
      closure: 90,
      done: 100,
    };
    return map[phase];
  }, [phase]);

  const beginSimulation = () => {
    setStartedAt(Date.now());
    setPhase("prep");
    setChecklist(SCRUB_CHECKLIST.map(() => false));
    setEventIndex(0);
    setScore(0);
    setFeedback("Prep checklist initiated. Complete all sterile steps.");
    setElapsedSeconds(0);
  };

  const completePrep = () => {
    if (!prepReady) return;
    setPhase("timeout");
    setFeedback("Team timeout complete: patient, site, and procedure verified.");
    setScore((prev) => prev + 15);
  };

  const advancePhase = () => {
    const next = nextPhase(phase);
    setPhase(next);
    if (next === "procedure") {
      setFeedback("Procedure started. Respond to intra-op events.");
      return;
    }
    if (next === "closure") {
      setFeedback("Closure and final count in progress.");
      return;
    }
    if (next === "done") {
      setFeedback("Simulation complete. Debrief and review decisions.");
      setScore((prev) => prev + 20);
    }
  };

  const answerEvent = (choiceId: string) => {
    if (!currentEvent) return;
    const selected = currentEvent.choices.find((choice) => choice.id === choiceId);
    if (!selected) return;

    setFeedback(selected.feedback);
    if (selected.isBest) {
      setScore((prev) => prev + 15);
    } else {
      setScore((prev) => Math.max(0, prev - 5));
    }

    if (eventIndex < selectedScenario.events.length - 1) {
      setEventIndex((prev) => prev + 1);
      return;
    }

    setPhase("closure");
    setFeedback("Procedure phase complete. Move to closure and final handoff.");
  };

  return (
    <Card className="rounded-[2rem] border border-cyan-200/70 bg-white/90 shadow-lg shadow-cyan-100/50 dark:border-cyan-500/30 dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
          <Syringe className="h-4 w-4 text-cyan-600" /> OR Sim: Scrub-In Lab
          <Badge className="border-none bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200">Training Only</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Score</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{score}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Timer</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{elapsedSeconds}s</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Vitals</p>
            <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">HR {vitals.hr} | BP {vitals.sbp}/{vitals.dbp}</p>
            <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">SpO2 {vitals.spo2}%</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Phase</p>
            <p className="text-[11px] font-black uppercase text-cyan-700 dark:text-cyan-300">{phase.replace(/_/g, " ")}</p>
          </div>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full bg-cyan-500 transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-600" />
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Live Prompt</p>
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{feedback}</p>
        </div>

        {!startedAt && (
          <Button className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={beginSimulation}>
            Start Surgery Simulation
          </Button>
        )}

        {startedAt && phase === "prep" && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Scrub Checklist</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SCRUB_CHECKLIST.map((item, index) => (
                <button
                  key={item}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[11px] font-bold ${
                    checklist[index]
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                  onClick={() =>
                    setChecklist((prev) => prev.map((value, i) => (i === index ? !value : value)))
                  }
                >
                  {item}
                  {checklist[index] ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                </button>
              ))}
            </div>
            <Button disabled={!prepReady} className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={completePrep}>
              Confirm Timeout and Enter OR
            </Button>
          </div>
        )}

        {startedAt && phase === "timeout" && (
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="border-none bg-amber-100 text-amber-700">
              <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Team Time-Out Complete
            </Badge>
            <Button className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={advancePhase}>
              Begin Procedure
            </Button>
          </div>
        )}

        {startedAt && phase === "procedure" && currentEvent && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Intra-Op Scenario</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{currentEvent.prompt}</p>
            <div className="grid gap-2">
              {currentEvent.choices.map((choice) => (
                <Button
                  key={choice.id}
                  variant="outline"
                  className="justify-start border-slate-200 text-left text-[11px] font-bold"
                  onClick={() => answerEvent(choice.id)}
                >
                  <Activity className="mr-2 h-3.5 w-3.5 text-cyan-600" /> {choice.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {startedAt && phase === "closure" && (
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="border-none bg-blue-100 text-blue-700">Final count reconciled</Badge>
            <Button className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={advancePhase}>
              Complete Case and Debrief
            </Button>
          </div>
        )}

        {startedAt && phase === "done" && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <p className="text-sm font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
              Simulation Finished
            </p>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">
              Final score: {score}. Nice run. Try again to improve response timing and decision quality.
            </p>
            <Button
              variant="outline"
              className="border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100"
              onClick={() => addLeaderboardEntry(score, elapsedSeconds)}
            >
              Save To Leaderboard
            </Button>
            <Button className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={beginSimulation}>
              Run Another Sim Case
            </Button>
          </div>
        )}

        {!startedAt && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Choose Scenario</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  className={`rounded-lg border px-3 py-2 text-left text-[11px] font-bold ${
                    selectedScenarioId === scenario.id
                      ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                  onClick={() => setSelectedScenarioId(scenario.id)}
                >
                  <p className="font-black uppercase tracking-wide">{scenario.name}</p>
                  <p className="mt-1 text-[10px] font-semibold normal-case">{scenario.subtitle}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Top Simulation Scores</p>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-[11px] font-semibold text-slate-500">No runs saved yet. Finish a simulation and save your score.</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((row, index) => (
                <div
                  key={`${row.scenarioId}-${row.achievedAt}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200"
                >
                  <span className="font-black text-slate-400">#{index + 1}</span>
                  <span className="min-w-44 flex-1">{row.scenarioName}</span>
                  <span>Score {row.score}</span>
                  <span>{row.timeSec}s</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
