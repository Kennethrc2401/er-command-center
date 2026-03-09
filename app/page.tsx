"use client";

import { useUser } from "@clerk/nextjs";
import { SignInButton, SignOutButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { 
  Monitor, 
  ShieldCheck, 
  UserPlus, 
  ChevronRight, 
  Lock, 
  ArrowRight,
  Stethoscope
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <AuthLoading>
        <div className="flex h-screen items-center justify-center bg-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AuthLoading>

      <Authenticated>
        <PortalDashboard />
      </Authenticated>

      <Unauthenticated>
        <PublicLanding />
      </Unauthenticated>
    </div>
  );
}

function PortalDashboard() {
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";

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
    ...(isAdmin ? [{
      title: "Executive Suite",
      desc: "Revenue analytics and compliance audits",
      href: "/dashboard/admin",
      icon: ShieldCheck,
      color: "bg-slate-900",
      role: "Admin Only"
    }] : [])
  ];

  return (
    <main className="max-w-6xl mx-auto px-6 py-20 space-y-12">
      <div className="space-y-2">
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter italic uppercase">
          Welcome back, <span className="text-blue-600">{user?.firstName || "Staff"}</span>
        </h1>
        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">
          Nexus ER Ecosystem • Unit 4B • {new Date().toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {portals.map((p) => (
          <Link href={p.href} key={p.title} className="group">
            <Card className="h-full border-none rounded-[3rem] bg-white shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 overflow-hidden">
              <CardContent className="p-10 flex flex-col h-full">
                <div className={`h-14 w-14 rounded-2xl ${p.color} flex items-center justify-center mb-8 shadow-lg`}>
                  <p.icon className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900">{p.title}</h3>
                    <span className="text-[8px] font-black text-slate-400 uppercase border border-slate-200 px-2 py-0.5 rounded-full">
                      {p.role}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-500 leading-relaxed">{p.desc}</p>
                </div>
                <div className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase text-blue-600 tracking-widest group-hover:gap-4 transition-all">
                  Access Portal <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
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

        <SignInButton mode="modal">
          <button className="px-12 py-5 bg-white text-slate-900 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-blue-500 hover:text-white transition-all shadow-2xl active:scale-95">
            Authenticate to Enter
          </button>
        </SignInButton>
        
        <div className="pt-10 border-t border-slate-800 flex items-center justify-center gap-8 opacity-40">
           <span className="text-[9px] font-black uppercase tracking-widest">HIPAA Compliant</span>
           <span className="text-[9px] font-black uppercase tracking-widest">EHR Integrated</span>
           <span className="text-[9px] font-black uppercase tracking-widest">Audit Secure</span>
        </div>
      </div>
    </main>
  );
}