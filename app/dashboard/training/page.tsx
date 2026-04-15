"use client";

import { useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, BookOpen, ChevronRight, Sparkles } from "lucide-react";
import { CLINICAL_REF } from "@/lib/constants/references";

const TriageQuiz = dynamic(() => import("@/components/Training/TriageQuiz"));
const EsiWizard = dynamic(() => import("@/components/Training/EsiWizard"));
const SimulateShift = dynamic(() => import("@/components/Training/SimulateShift"));
const WorkflowAnalytics = dynamic(() => import("@/components/Training/WorkflowAnalytics"));
const SurgerySimulation = dynamic(() => import("@/components/Training/SurgerySimulation"));
const GynProcedureQuickCard = dynamic(() => import("@/components/Training/GynProcedureQuickCard"));
const ReferenceSidebar = dynamic(() => import("@/components/Training/ReferenceSidebar"));

const quickProtocols = [
  {
    id: "protocol-esi-algorithm",
    title: "ESI Algorithm",
    detail: "Rapid decision support for acuity assignment and resource prediction.",
    cue: "Use this when you need to determine acuity quickly before workup begins.",
    checkpoints: [
      "Assess for immediate life-saving intervention needs first. If yes, assign ESI 1.",
      "If the patient is high risk, confused, lethargic, disoriented, or in severe pain or distress, assign ESI 2.",
      "Estimate resource use next. Many resources usually maps to ESI 3, one resource to ESI 4, and none to ESI 5.",
      "Re-check danger-zone vitals before finalizing ESI 3 patients, especially pediatric and elderly presentations."
    ],
    escalate: "Escalate immediately when appearance, airway, perfusion, or mental status is worse than the initial complaint suggests."
  },
  {
    id: "protocol-stroke-nihss",
    title: "Stroke / NIHSS",
    detail: "Red-flag symptoms, timing windows, and escalation thresholds.",
    cue: "Use for facial droop, unilateral weakness, aphasia, neglect, or sudden severe neuro change.",
    checkpoints: [
      "Document last-known-well time immediately and confirm anticoagulant use, glucose, and baseline deficits.",
      "Activate stroke workflow for new focal neurologic deficits, aphasia, gaze deviation, or sudden altered level of consciousness.",
      "Prioritize bedside glucose, urgent CT readiness, NIHSS scoring, and rapid provider notification.",
      "Maintain head-of-bed and swallowing precautions until the patient is cleared."
    ],
    escalate: "Any abrupt neuro deficit with a known or suspected recent onset should be treated as time-sensitive until proven otherwise."
  },
  {
    id: "protocol-stemi-cardiac",
    title: "STEMI / Cardiac",
    detail: "Chest-pain intake cues, monitor priorities, and early activation steps.",
    cue: "Use for chest pain, diaphoresis, dyspnea, syncope, crushing pressure, or atypical cardiac symptoms.",
    checkpoints: [
      "Obtain or confirm a 12-lead ECG as early as possible and keep the patient on continuous monitoring.",
      "Watch for radiation to arm, jaw, or back, associated nausea, diaphoresis, and hemodynamic instability.",
      "Flag high-risk presentations even when pain is mild, especially in older adults, women, and diabetic patients.",
      "Ensure IV access, repeat vitals, and immediate provider notification for ischemic changes or unstable symptoms."
    ],
    escalate: "Chest pain with ECG changes, hypotension, arrhythmia, or persistent distress should bypass routine queueing."
  },
  {
    id: "protocol-sepsis-criteria",
    title: "Sepsis Criteria",
    detail: "Screening checkpoints for unstable vitals, infection risk, and lactate workup.",
    cue: "Use for suspected infection with tachycardia, hypotension, fever, hypothermia, tachypnea, or altered mentation.",
    checkpoints: [
      "Screen for infection source, abnormal temperature, tachycardia, tachypnea, hypotension, and new confusion.",
      "Escalate when lactate is elevated, perfusion is poor, urine output drops, or the patient appears toxic.",
      "Move quickly on cultures, lactate, fluid readiness, and early antibiotic pathway triggers per unit process.",
      "Trend repeat vitals closely because deterioration can be rapid even when the first presentation looks stable."
    ],
    escalate: "Suspected infection plus organ dysfunction, shock signs, or worsening mentation should be treated as urgent high-risk triage."
  }
];

type PackSection = {
  heading: string;
  bullets: string[];
};

function openPrintablePack(title: string, subtitle: string, sections: PackSection[]) {
  const printable = window.open("", "_blank", "width=960,height=760");
  if (!printable) return false;

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 28px; color: #111827; line-height: 1.45; }
        h1 { margin: 0 0 6px; font-size: 24px; text-transform: uppercase; letter-spacing: 0.04em; }
        .sub { margin: 0 0 18px; color: #4b5563; font-size: 13px; }
        .section { margin: 18px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 18px; }
        .section h2 { margin: 0 0 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #7c3aed; }
        ul { margin: 0; padding-left: 18px; }
        li { margin-bottom: 7px; }
        .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p class="sub">${subtitle}</p>
      ${sections.map((section) => `
        <div class="section">
          <h2>${section.heading}</h2>
          <ul>
            ${section.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}
          </ul>
        </div>
      `).join("")}
      <p class="footer">Training reference only. Follow local policy, provider orders, and role scope.</p>
      <script>window.print();</script>
    </body>
  </html>`;

  printable.document.open();
  printable.document.write(html);
  printable.document.close();
  return true;
}

export default function TrainingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledLauncherActionRef = useRef<string | null>(null);

  const activeTab = (() => {
    const raw = searchParams.get("tab");
    if (raw === "prep" || raw === "protocols" || raw === "practice") return raw;
    return "practice";
  })();

  const practiceLabTab = (() => {
    const raw = searchParams.get("practice");
    if (raw === "esi" || raw === "or" || raw === "analytics" || raw === "quiz") return raw;
    return "quiz";
  })();

  const updateTrainingUrl = useCallback((nextTab: "practice" | "prep" | "protocols", nextPractice?: "quiz" | "esi" | "or" | "analytics") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);

    if (nextPractice) {
      params.set("practice", nextPractice);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const printTriagePack = useCallback(() => {
    openPrintablePack("Triage Rapid Pack", "Quick review for bedside triage and escalation", [
      {
        heading: "Core Escalation Reminders",
        bullets: quickProtocols.map((item) => `${item.title}: ${item.escalate}`),
      },
      {
        heading: "Top Review Cues",
        bullets: quickProtocols.flatMap((item) => item.checkpoints.slice(0, 2).map((checkpoint) => `${item.title} - ${checkpoint}`)),
      },
    ]);
  }, []);

  const printProcedurePack = useCallback(() => {
    openPrintablePack("Procedure Prep Pack", "Clinic, hospital, and Labor & Delivery quick staging guide", [
      {
        heading: "High-Use Setup Areas",
        bullets: CLINICAL_REF.PROCEDURE_PREP_GUIDES.slice(0, 8).map((procedure) => `${procedure.unit}: ${procedure.name}`),
      },
      {
        heading: "Universal Setup Habits",
        bullets: [
          "Verify patient identity and procedure indication before opening supplies.",
          "Stage labels, requisitions, and transport workflow before the patient enters the room.",
          "Confirm chaperone, comfort, and privacy workflow early when needed.",
          "Keep emergency escalation and follow-up instructions available at room reset.",
        ],
      },
    ]);
  }, []);

  useEffect(() => {
    const action = searchParams.get("action");
    if (!action) {
      handledLauncherActionRef.current = null;
      return;
    }

    if (action !== "print-triage-pack" && action !== "print-procedure-pack") return;

    const actionKey = `${action}:${searchParams.toString()}`;
    if (handledLauncherActionRef.current === actionKey) return;
    handledLauncherActionRef.current = actionKey;

    if (action === "print-triage-pack") {
      printTriagePack();
    } else {
      printProcedurePack();
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "protocols");
    params.delete("action");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, printProcedurePack, printTriagePack, router, searchParams]);

  return (
    <main id="top" className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.08),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.98),rgba(241,245,249,0.9))] px-4 pb-10 pt-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:gap-10">
        <section className="aurora-panel glass-panel relative rounded-[2rem] p-6 sm:p-8 lg:p-10">
          <div className="absolute -left-8 top-8 h-24 w-24 rounded-full bg-purple-400/15 blur-3xl soft-float" />
          <div className="absolute right-8 top-10 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl soft-float-delayed" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)] lg:items-end">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-purple-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Clinical Education Portal</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Skills Lab Active
                </div>
              </div>

              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-black uppercase italic tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl lg:text-6xl">
                  Staff <span className="text-purple-600">Training</span> Center
                </h1>
                <p className="max-w-2xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
                  Scenario practice, ESI reinforcement, and quick clinical reference tools for staff onboarding and recurrent triage training.
                </p>
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                  FDU Clinical Prep | Unit 4B | ESI Certification Module
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                  Shareable Views
                </span>
                <span className="rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                  Responsive Tabs
                </span>
                <span className="rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                  Procedure Prep Library
                </span>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/references")}
                  className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-700 shadow-sm transition-colors hover:bg-cyan-100 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300"
                >
                  Open References Hub
                </button>
              </div>
            </div>

            <div className="glass-panel rounded-[1.75rem] border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="shimmer-bar rounded-4xl bg-white px-5 py-4 text-center shadow-sm dark:bg-slate-900">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Current Score</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-slate-100">84%</p>
                </div>
                <div className="rounded-4xl bg-white px-5 py-4 text-center shadow-sm dark:bg-slate-900">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Rank</p>
                  <p className="text-2xl font-black text-purple-600">Lead CCMA</p>
                </div>
              </div>
              <div className="mt-3 rounded-4xl border border-emerald-100 bg-white p-3 dark:border-emerald-500/20 dark:bg-slate-900">
                <SimulateShift />
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[1.75rem] border border-slate-200 bg-white/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {([
              ["practice", "Practice Lab"],
              ["prep", "Procedure Prep"],
              ["protocols", "Protocol Guides"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => updateTrainingUrl(value)}
                className={`rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeTab === value
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-300/40"
                    : "bg-slate-100 text-slate-600 hover:-translate-y-0.5 hover:bg-purple-100 hover:text-purple-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-purple-800/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === "practice" && (
          <section className="space-y-6">
            <section className="glass-panel rounded-[1.5rem] border border-slate-200 bg-white/75 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:p-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {([
                  ["quiz", "Triage Quiz"],
                  ["esi", "ESI Wizard"],
                  ["or", "OR Simulation"],
                  ["analytics", "Analytics"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateTrainingUrl("practice", value)}
                    className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                      practiceLabTab === value
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-300/40"
                        : "bg-slate-100 text-slate-600 hover:-translate-y-0.5 hover:bg-blue-100 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-800/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                {practiceLabTab === "quiz" && <TriageQuiz />}
                {practiceLabTab === "esi" && <EsiWizard />}
                {practiceLabTab === "or" && <SurgerySimulation />}
                {practiceLabTab === "analytics" && <WorkflowAnalytics />}
              </div>
              <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
                <div className="group relative overflow-hidden rounded-[1.5rem] bg-linear-to-br from-purple-600 via-fuchsia-600 to-indigo-600 p-5 text-white shadow-xl shadow-purple-200 sm:p-6">
                  <GraduationCap className="absolute -bottom-6 -right-4 h-24 w-24 text-white/10 transition-transform group-hover:scale-110" />
                  <div className="relative space-y-2">
                    <h4 className="text-sm font-black uppercase tracking-[0.2em] italic">Pro-Tip for Triage</h4>
                    <p className="text-sm leading-6 text-purple-100">
                      Always consider the &quot;Sixth Vital Sign&quot;, pain. Patients who appear toxic or unstable should be escalated quickly even when baseline triage category seems lower.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}

        {activeTab === "prep" && (
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <GynProcedureQuickCard />
            </div>
            <aside className="min-w-0 xl:sticky xl:top-28 xl:self-start">
              <div className="flex items-center gap-2 px-1 pb-2">
                <BookOpen className="h-4 w-4 text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Reference Sidebar</span>
              </div>
              <ReferenceSidebar />
            </aside>
          </section>
        )}

        {activeTab === "protocols" && (
          <section className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={printTriagePack}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Printable Pack</p>
                <h3 className="mt-1 text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Triage Rapid Pack</h3>
                <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">Print escalation cues and review checkpoints for the live desk.</p>
              </button>
              <button
                type="button"
                onClick={printProcedurePack}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Printable Pack</p>
                <h3 className="mt-1 text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Procedure Prep Pack</h3>
                <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">Print staged setup reminders for clinic, hospital, and Labor & Delivery procedures.</p>
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Protocol Playbooks</p>
                <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                  Shift-Ready Clinical Guides
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">
                Use these for orientation drills and real-time refreshers when triage risk, escalation language, or next-step flow needs quick reinforcement.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quickProtocols.map((item) => (
                <a
                  key={item.title}
                  href={`#${item.id}`}
                  className="group flex items-start justify-between gap-3 rounded-4xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:hover:border-purple-500/70"
                >
                  <div className="min-w-0 space-y-1">
                    <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">{item.title}</span>
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{item.detail}</p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-purple-500" />
                </a>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              {quickProtocols.map((item) => (
                <article
                  key={item.id}
                  id={item.id}
                  className="scroll-mt-32 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50 sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/30"
                >
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200">
                        Rapid Review
                      </span>
                      <a href="#top" className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 transition-colors hover:text-purple-600 dark:text-slate-500 dark:hover:text-purple-300">
                        Back To Top
                      </a>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-slate-100">
                        {item.title}
                      </h3>
                      <p className="text-sm leading-7 text-slate-500 dark:text-slate-400">{item.cue}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Core Checkpoints</p>
                      <div className="space-y-3">
                        {item.checkpoints.map((checkpoint, index) => (
                          <div key={`${item.id}-${index}`} className="flex items-start gap-3 rounded-4xl bg-slate-50 p-4 dark:bg-slate-950/60">
                            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white dark:bg-slate-100 dark:text-slate-900">
                              {index + 1}
                            </div>
                            <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{checkpoint}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Escalation Trigger</p>
                      <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">{item.escalate}</p>
                      <div className="rounded-4xl bg-white p-4 dark:bg-slate-900">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Use In Practice</p>
                        <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
                          Pair this guide with training simulations and decision trees to rehearse prioritization, escalation language, and communication sequencing.
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}