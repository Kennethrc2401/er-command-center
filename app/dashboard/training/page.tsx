"use client";

import TriageQuiz from "@/components/Training/TriageQuiz";
import ReferenceSidebar from "../../../components/Training/ReferenceSidebar";
import { GraduationCap, BookOpen, ChevronRight, Activity, Sparkles } from "lucide-react";
import EsiWizard from "@/components/Training/EsiWizard";
import SimulateShift from "@/components/Training/SimulateShift";
import WorkflowAnalytics from "@/components/Training/WorkflowAnalytics";
import SurgerySimulation from "@/components/Training/SurgerySimulation";

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

export default function TrainingPage() {
  return (
    <main id="top" className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.08),transparent_30%),linear-gradient(to_bottom,rgba(248,250,252,0.98),rgba(241,245,249,0.9))] px-4 pb-10 pt-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:gap-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-8 lg:p-10 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-slate-950/40">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-linear-to-l from-purple-500/10 to-transparent lg:block" />
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
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/90 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-4xl bg-white px-5 py-4 text-center shadow-sm dark:bg-slate-900">
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

        <WorkflowAnalytics />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8 xl:gap-10">
          <aside className="order-2 min-w-0 space-y-4 lg:order-1 lg:col-span-3 lg:space-y-6">
            <div className="flex items-center gap-2 px-1">
              <BookOpen className="h-4 w-4 text-slate-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Lab References</span>
            </div>
            <div className="min-w-0 lg:sticky lg:top-28">
              <ReferenceSidebar />
            </div>
          </aside>

          <section className="order-1 min-w-0 space-y-6 lg:order-2 lg:col-span-6 lg:space-y-8">
            <div className="min-w-0">
              <TriageQuiz />
            </div>
            <div className="min-w-0">
              <EsiWizard />
            </div>
            <div className="min-w-0">
              <SurgerySimulation />
            </div>

            <div className="group relative overflow-hidden rounded-[2.5rem] bg-purple-600 p-6 text-white shadow-xl shadow-purple-200 sm:p-8">
              <GraduationCap className="absolute -bottom-6 -right-4 h-28 w-28 text-white/10 transition-transform group-hover:scale-110 sm:h-32 sm:w-32" />
              <div className="relative max-w-2xl space-y-3">
                <h4 className="text-base font-black uppercase tracking-[0.2em] italic sm:text-lg">Pro-Tip for Triage</h4>
                <p className="text-sm font-medium leading-7 text-purple-100">
                  Always consider the &quot;Sixth Vital Sign&quot;, pain. While ESI level 3 is common for abdominal pain, any patient who looks &quot;toxic&quot; or is hemodynamically unstable should be escalated immediately to Level 2.
                </p>
              </div>
            </div>
          </section>

          <aside className="order-3 min-w-0 space-y-4 lg:col-span-3 lg:space-y-6">
            <div className="flex items-center gap-2 px-1">
              <Activity className="h-4 w-4 text-slate-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Quick Protocols</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {quickProtocols.map((item) => (
                <a
                  key={item.title}
                  href={`#${item.id}`}
                  className="group flex w-full min-w-0 items-start justify-between gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:hover:border-purple-500/70"
                >
                  <div className="min-w-0 space-y-2">
                    <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">{item.title}</span>
                    <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">{item.detail}</p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-purple-500" />
                </a>
              ))}
            </div>
          </aside>
        </div>

        <section className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Protocol Playbooks</p>
              <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                Shift-Ready Clinical Guides
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">
              These quick-reference blocks are built for triage review. Use the cards above to jump directly to the protocol you need during orientation, drills, or case debriefs.
            </p>
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
                        Pair this guide with the quiz and ESI decision tree above to rehearse prioritization, escalation language, and next-step communication.
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}