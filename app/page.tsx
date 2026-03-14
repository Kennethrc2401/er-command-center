"use client";

import React from "react";
import { SignInButton } from "@clerk/nextjs";
import { 
  Monitor, 
  ShieldCheck, 
  UserPlus, 
  ArrowRight,
  Stethoscope,
  GraduationCap,
  KeyRound,
  Loader2,
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

function PortalDashboard({ displayName, isAdmin }: { displayName: string; isAdmin: boolean }) {

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
    ...(isAdmin ? [{
      title: "Executive Suite",
      desc: "Revenue analytics and compliance audits",
      href: "/dashboard/admin",
      icon: ShieldCheck,
      color: "bg-slate-900",
      role: "Admin Only"
    }] : [])
  ];

  const colorMap: Record<string, string> = {
    "bg-blue-600": "#2563eb",
    "bg-emerald-500": "#10b981",
    "bg-violet-600": "#7c3aed",
    "bg-slate-900": "#0f172a"
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

      {/* Some space before the grid */}
      <div className="h-6" />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {portals.map((p) => {
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
