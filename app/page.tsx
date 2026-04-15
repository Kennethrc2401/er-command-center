"use client";

import React, { useState } from "react";
import { SignInButton } from "@clerk/nextjs";
import { 
  Monitor, 
  BrainCircuit,
  ShieldCheck, 
  UserPlus, 
  ArrowRight,
  Stethoscope,
  GraduationCap,
  KeyRound,
  Loader2,
  ClipboardList,
  BookOpen,
  FlaskConical,
} from "lucide-react";
import Link from "next/link";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";

export default function LandingPage() {
  const { actorName, isAdmin, isAuthenticated, isResolvingAuth } = useResolvedActor();

  const displayName = actorName.split(" ")[0] || "Staff";

  if (isResolvingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800 px-6 py-4 text-xs font-black uppercase tracking-[0.2em]">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          Checking Access
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {isAuthenticated ? <PortalDashboard displayName={displayName} isAdmin={isAdmin} /> : <PublicLanding />}
    </div>
  );
}

function readLauncherUsageTop() {
  if (typeof window === "undefined") return [] as Array<{ key: string; count: number }>;

  try {
    const raw = window.localStorage.getItem("global-launcher:usage");
    if (!raw) return [] as Array<{ key: string; count: number }>;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed ?? {})
      .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
      .map(([key, value]) => ({ key, count: Math.floor(value as number) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  } catch {
    return [] as Array<{ key: string; count: number }>;
  }
}

function fireLauncherPreferenceAction(action: "export" | "download" | "import" | "reset") {
  window.dispatchEvent(new CustomEvent("global-launcher-preferences-action", { detail: { action } }));
}

function PortalDashboard({ displayName, isAdmin }: { displayName: string; isAdmin: boolean }) {
  const { actorRole } = useResolvedActor();
  const [usageTop, setUsageTop] = useState<Array<{ key: string; count: number }>>(() => readLauncherUsageTop());

  const portals = [
    {
      title: "Clinical Command",
      desc: "Live Triage, Bed Matrix, and Patient Charts",
      href: "/dashboard/triage",
      icon: Monitor,
      color: "bg-blue-600",
      role: "Staff Only"
    },
    {
      title: "Patient Kiosk",
      desc: "Self-service check-in for arriving patients",
      href: "/kiosk",
      icon: UserPlus,
      color: "bg-emerald-500",
      role: "Public Facing"
    },
    {
      title: "Training Center",
      desc: "Scenario drills, ESI refreshers, and onboarding practice tools",
      href: "/dashboard/training",
      icon: GraduationCap,
      color: "bg-violet-600",
      role: "Staff Learning"
    },
    {
      title: "OR Scheduler",
      desc: "Schedule, track, and update operative room case flow",
      href: "/dashboard/or-scheduler",
      icon: ClipboardList,
      color: "bg-cyan-600",
      role: "Perioperative"
    },
    {
      title: "AI Tools Hub",
      desc: "Clinical, handoff, and denial-risk copilots in one workspace",
      href: "/dashboard/ai-tools",
      icon: BrainCircuit,
      color: "bg-teal-600",
      role: "Staff AI"
    },
    {
      title: "Study Notes",
      desc: "Record, organize, and review academic class notes with AI topics",
      href: "/dashboard/study-notes",
      icon: BookOpen,
      color: "bg-purple-600",
      role: "Academic"
    },
    {
      title: "Clinical References",
      desc: "Dedicated drug dictionary and bedside labs, vitals, and procedure guides",
      href: "/dashboard/references",
      icon: FlaskConical,
      color: "bg-sky-600",
      role: "Staff Knowledge"
    },
    ...(isAdmin ? [{
      title: "Executive Suite",
      desc: "Revenue analytics and compliance audits",
      href: "/dashboard/admin",
      icon: ShieldCheck,
      color: "bg-slate-900",
      role: "Admin Only"
    }, {
      title: "POS Terminal",
      desc: "Open drawer reconciliation and payment controls",
      href: "/dashboard/admin/revenue#pos-terminal",
      icon: ClipboardList,
      color: "bg-amber-600",
      role: "Admin Only"
    }, {
      title: "Insurance Ops",
      desc: "Eligibility, prior auth, and claims response workbench",
      href: "/dashboard/admin/insurance",
      icon: ShieldCheck,
      color: "bg-emerald-500",
      role: "Admin Only"
    }, {
      title: "Clinical Research",
      desc: "Build de-identified operational cohorts and export findings",
      href: "/dashboard/admin/research",
      icon: FlaskConical,
      color: "bg-indigo-600",
      role: "Admin Only"
    }] : [])
  ];

  const colorMap: Record<string, string> = {
    "bg-blue-600": "#2563eb",
    "bg-emerald-500": "#10b981",
    "bg-violet-600": "#7c3aed",
    "bg-cyan-600": "#0891b2",
    "bg-teal-600": "#0d9488",
    "bg-slate-900": "#0f172a",
    "bg-amber-600": "#d97706",
    "bg-purple-600": "#9333ea",
    "bg-indigo-600": "#4f46e5",
    "bg-sky-600": "#0284c7"
  };

  const rolePriorityMap: Record<string, string[]> = {
    ADMIN: ["Executive Suite", "Clinical Research", "Clinical Command", "Clinical References"],
    PROVIDER: ["Clinical Command", "Clinical References", "AI Tools Hub", "Training Center"],
    RN: ["Clinical Command", "Clinical References", "Training Center", "Study Notes"],
    CCMA: ["Clinical Command", "Clinical References", "Patient Kiosk", "OR Scheduler"],
  };

  const rolePriority = rolePriorityMap[actorRole] ?? ["Clinical Command", "Training Center", "AI Tools Hub"];
  const orderedPortals = [...portals].sort((a, b) => {
    const score = (title: string) => {
      const index = rolePriority.indexOf(title);
      return index === -1 ? 999 : index;
    };

    return score(a.title) - score(b.title);
  });

  const recommended = orderedPortals.slice(0, 3);

  const usageLabelMap: Record<string, string> = {
    "action:new-admission": "New Admission",
    "action:open-scribe": "Open AI Scribe",
    "action:procedure-prep": "Procedure Prep",
    "action:protocol-guides": "Protocol Guides",
    "action:print-triage-pack": "Print Triage Pack",
    "action:print-procedure-pack": "Print Procedure Pack",
    "action:stroke-protocol": "Stroke Protocol",
    "action:stemi-protocol": "STEMI Protocol",
    "action:sepsis-protocol": "Sepsis Protocol",
    "action:open-research": "Clinical Research",
    "action:open-references": "References Hub",
    "route:triage-board": "Triage Board",
    "route:training-center": "Training Center",
    "route:study-notes": "Study Notes",
    "route:references-hub": "References Hub",
    "route:ai-tools": "AI Tools Hub",
    "route:or-scheduler": "OR Scheduler",
    "route:faxes": "Faxes",
    "route:procedure-pack": "Procedure Prep",
    "route:protocol-pack": "Protocol Pack",
    "route:admin-suite": "Admin Suite",
    "route:clinical-research": "Clinical Research",
  };

  const refreshUsage = () => {
    setUsageTop(readLauncherUsageTop());
  };

  const clearUsage = () => {
    window.localStorage.removeItem("global-launcher:usage");
    setUsageTop([]);
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-20 space-y-12">
      <div className="space-y-2">
        <h1 className="text-5xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-slate-100">
          Welcome back, <span className="text-blue-600">{displayName}</span>
        </h1>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
          Nexus ER Ecosystem • Unit 4B • {new Date().toLocaleDateString()}
        </p>
      </div>

      <section className="aurora-panel glass-panel rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Recommended for You</p>
            <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-slate-100">
              Role-aware quick access
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              Your landing page now prioritizes the tools most relevant to your current role so you can get to work faster.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open-global-launcher"))}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-300 transition-all hover:bg-violet-600 dark:bg-white dark:text-slate-900 dark:hover:bg-violet-200"
          >
            <BrainCircuit className="h-4 w-4" />
            Open Global Launcher
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {recommended.map((portal) => (
            <Link
              key={portal.title}
              href={portal.href}
              className="group rounded-[1.5rem] border border-slate-200 bg-white/85 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Priority</p>
                  <h3 className="mt-1 text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{portal.title}</h3>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${portal.color} text-white shadow-lg`}>
                  {React.createElement(portal.icon, { className: "h-5 w-5" })}
                </div>
              </div>
              <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">{portal.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Launcher Usage</p>
            <h2 className="mt-1 text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-slate-100">Top Actions This Shift</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("open-global-launcher"))}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            >
              Open Launcher
            </button>
            <button
              type="button"
              onClick={refreshUsage}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            >
              Refresh Usage
            </button>
            <button
              type="button"
              onClick={clearUsage}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-700 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              Clear Usage
            </button>
            <button
              type="button"
              onClick={() => fireLauncherPreferenceAction("export")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            >
              Export Prefs
            </button>
            <button
              type="button"
              onClick={() => fireLauncherPreferenceAction("download")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            >
              Download Prefs
            </button>
            <button
              type="button"
              onClick={() => fireLauncherPreferenceAction("import")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            >
              Import Prefs
            </button>
            <button
              type="button"
              onClick={() => fireLauncherPreferenceAction("reset")}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-700 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              Reset Prefs
            </button>
          </div>
        </div>

        {usageTop.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {usageTop.map((entry) => (
              <div key={entry.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/60">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  {entry.key.startsWith("action:") ? "Action" : "Route"}
                </p>
                <p className="mt-1 text-sm font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                  {usageLabelMap[entry.key] ?? entry.key.replace(/^[^:]+:/, "").replace(/-/g, " ")}
                </p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
                  {entry.count} runs
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
            No launcher usage yet. Run a few commands and your top shortcuts will appear here.
          </p>
        )}
      </section>

      {/* Some space before the grid */}
      <div className="h-6" />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orderedPortals.map((p) => {
          return (
            <Link href={p.href} key={p.title} className="group block">
              <div className="h-full rounded-[2rem] overflow-hidden bg-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 dark:bg-slate-900">
                {/* Icon Header Banner */}
              <div style={{ backgroundColor: colorMap[p.color as keyof typeof colorMap], height: "128px" }} className="flex items-center justify-center relative">
                  {React.createElement(p.icon, { className: "h-16 w-16 text-white drop-shadow-xl" })}
                </div>
                
                {/* Content Area */}
                <div className="p-6 flex flex-col h-[calc(100%-128px)]">
                  <div className="flex-1">
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900 dark:text-slate-100 flex-1">
                        {p.title}
                      </h3>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[7px] font-black uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap">
                        {p.role}
                      </span>
                    </div>
                    <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                      {p.desc}
                    </p>
                  </div>
                  
                  {/* Action Footer */}
                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600 tracking-widest group-hover:gap-3 transition-all">
                      Enter <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

function PublicLanding() {
  return (
    <main className="h-screen flex items-center justify-center p-6 bg-slate-900 text-white overflow-hidden relative">
      {/* Background Graphic */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600 skew-x-12 translate-x-32 opacity-10 pointer-events-none" />
      
      <div className="max-w-2xl text-center space-y-10 relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 mb-4">
            <Stethoscope className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Next-Gen ER Management</span>
          </div>
          <h1 className="text-7xl font-black italic tracking-tighter leading-[0.9] uppercase">
            Nexus <span className="text-blue-500">ER</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-lg mx-auto uppercase tracking-tighter">
            An integrated clinical and administrative ecosystem designed for high-acuity environments. Restricted to Hackensack Meridian staff.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/staff-login"
            className="inline-flex items-center gap-2 px-10 py-5 bg-blue-500 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-blue-400 transition-all shadow-2xl active:scale-95"
          >
            <KeyRound className="h-4 w-4" />
            Staff Login
          </Link>

          <SignInButton mode="modal">
            <button className="px-10 py-5 bg-white text-slate-900 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-200 transition-all shadow-2xl active:scale-95">
              Clerk Login
            </button>
          </SignInButton>
        </div>
        
        <div className="pt-10 border-t border-slate-800 flex items-center justify-center gap-8 opacity-40">
           <span className="text-[9px] font-black uppercase tracking-widest">HIPAA Compliant</span>
           <span className="text-[9px] font-black uppercase tracking-widest">EHR Integrated</span>
           <span className="text-[9px] font-black uppercase tracking-widest">Audit Secure</span>
        </div>
      </div>
    </main>
  );
}
