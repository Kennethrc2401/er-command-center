"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";
import { 
  Activity, 
  BrainCircuit,
  Command,
  LayoutDashboard, 
  UserPlus, 
  ShieldCheck, 
  LogOut,
  MapPin,
  Shield,
  ShieldOff,
  FileText,
  ClipboardList,
  Sparkles,
  BookOpen,
  FlaskConical,
  Briefcase
} from "lucide-react";
import NewPatientModal from "./NewPatientModal";
import { LucideIcon } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { usePrivacyMode } from "@/lib/hooks/usePrivacyMode";
import NotificationBell from "@/components/clinical/NotificationBell";
import { defaultCredentialsForRole, normalizeStaffRole } from "@/lib/auth/roles";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";

interface NavLinkProps {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  variant?: "default" | "admin";
}

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { isAdmin } = useResolvedActor();
  const primaryEmail = user?.primaryEmailAddress?.emailAddress;
  const ensureUserProfile = useMutation(api.users.ensureUserProfile);
  const provisionAttemptedRef = useRef(false);
  const convexUser = useQuery(
    api.users.getByEmail,
    primaryEmail ? { email: primaryEmail } : "skip"
  );
  const { isPrivate, togglePrivacy } = usePrivacyMode();

  useEffect(() => {
    if (!user || !primaryEmail) return;
    if (convexUser === undefined || convexUser) return;
    if (provisionAttemptedRef.current) return;

    provisionAttemptedRef.current = true;

    const role = normalizeStaffRole(user.publicMetadata?.role, "NURSE");

    void ensureUserProfile({
      email: primaryEmail,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || primaryEmail,
      username: user.username ?? undefined,
      role,
      credentials: defaultCredentialsForRole(role),
      department: "Emergency Medicine",
    }).catch(() => {
      provisionAttemptedRef.current = false;
    });
  }, [convexUser, ensureUserProfile, primaryEmail, user]);

  if (pathname === "/kiosk") return null;

  return (
    <nav className="sticky top-10 z-40 border-b border-slate-200 bg-white/90 px-3 py-3 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-6 lg:gap-10">
          {/* 🏥 BRANDING SECTION (Merged from StaffHeader) */}
          <Link href="/" className="flex items-center gap-4 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 shadow-lg shadow-slate-200 transition-all group-hover:bg-blue-600 dark:bg-slate-800 dark:shadow-slate-950">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div className="hidden md:block">
              <div className="mb-1 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <p className="text-[9px] font-black uppercase leading-none tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  System Online • Unit 4B
                </p>
              </div>
              <p className="text-lg font-black italic uppercase leading-none tracking-tighter text-slate-900 dark:text-slate-100">
                Nexus <span className="text-blue-600">ER</span>
              </p>
            </div>
          </Link>

          <div className="hidden h-10 w-px bg-slate-200 dark:bg-slate-800 md:block" />

          {/* 🧭 NAVIGATION LINKS */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <NavLink
              href="/dashboard/triage"
              icon={LayoutDashboard}
              label="Triage Board"
              active={pathname.includes("/triage")}
            />
            <NavLink
              href="/dashboard/faxes"
              icon={FileText}
              label="Faxes"
              active={pathname.includes("/faxes")}
            />
            <NavLink
              href="/dashboard/or-scheduler"
              icon={ClipboardList}
              label="OR Scheduler"
              active={pathname.includes("/or-scheduler")}
            />
            <NavLink
              href="/dashboard/ai-tools"
              icon={BrainCircuit}
              label="AI Tools"
              active={pathname.includes("/ai-tools")}
            />
            <NavLink
              href="/dashboard/study-notes"
              icon={BookOpen}
              label="Study Notes"
              active={pathname.includes("/study-notes")}
            />
            <NavLink
              href="/dashboard/references"
              icon={FlaskConical}
              label="References"
              active={pathname.includes("/references")}
            />
            <NavLink
              href="/dashboard/productivity"
              icon={Briefcase}
              label="Productivity"
              active={pathname.includes("/productivity")}
            />

            {isAdmin && (
              <NavLink
                href="/dashboard/admin"
                icon={ShieldCheck}
                label="Admin Suite"
                active={pathname.includes("/admin")}
                variant="admin"
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end lg:gap-6">
          <div className="hidden items-center gap-2 xl:flex">
            <Link
              href="/dashboard/training?tab=protocols#protocol-stroke-nihss"
              className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              Stroke
            </Link>
            <Link
              href="/dashboard/training?tab=protocols#protocol-stemi-cardiac"
              className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
            >
              STEMI
            </Link>
            <Link
              href="/dashboard/training?tab=protocols#protocol-sepsis-criteria"
              className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-700 transition-colors hover:bg-cyan-100 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300"
            >
              Sepsis
            </Link>
          </div>

          <button 
            onClick={togglePrivacy}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all sm:px-4 sm:py-2.5 ${
              isPrivate 
                ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-200 animate-pulse" 
                : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
            }`}
          >
            {isPrivate ? <Shield className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
            <span className="hidden lg:inline">{isPrivate ? "Privacy Active" : "Privacy Off"}</span>
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-global-launcher"))}
            className="flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-violet-700 transition-all hover:border-violet-300 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300"
          >
            <Command className="h-4 w-4" />
            <span className="hidden sm:inline">Launcher</span>
          </button>

        {/* 🔔 NOTIFICATIONS */}
        <NotificationBell userId={convexUser?._id} />

        <ThemeToggle />

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-global-scribe"))}
          className="flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">AI Scribe</span>
        </button>

        {/* ➕ QUICK ACTION */}
        <NewPatientModal 
          trigger={
            <button className="flex items-center gap-2 rounded-2xl bg-blue-600 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200 transition-all active:scale-95 hover:bg-slate-900 dark:shadow-blue-900/40 dark:hover:bg-blue-500 sm:px-5">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">New Admission</span>
            </button>
          } 
        />

        <div className="hidden h-10 w-px bg-slate-200 dark:bg-slate-800 sm:block" />

        {/* 👤 USER PROFILE (Merged from StaffHeader) */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="hidden lg:flex flex-col items-end">
            <p className="text-[10px] font-black uppercase leading-none italic text-slate-900 dark:text-slate-100">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="mt-1.5 flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              <MapPin className="h-2 w-2" /> {isAdmin ? "Unit Coordinator" : "Clinical Staff"}
            </p>
          </div>
          
          <SignOutButton>
            <button className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-red-950/40 active:scale-95">
              <LogOut className="h-4 w-4" />
            </button>
          </SignOutButton>
        </div>
      </div>
      </div>
    </nav>
  );
}

function NavLink({ href, icon: Icon, label, active, variant = "default" }: NavLinkProps) {
  return (
    <Link href={href}>
      <button className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-left transition-all duration-300 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 ${
        active 
          ? "bg-slate-100 text-slate-900 shadow-inner dark:bg-slate-800 dark:text-slate-100" 
          : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900"
      }`}>
        <Icon className={`h-4 w-4 ${active ? (variant === "admin" ? "text-emerald-500" : "text-blue-600") : "text-slate-400"}`} />
        <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">
          {label}
        </span>
      </button>
    </Link>
  );
}