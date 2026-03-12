"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { 
  Activity, 
  LayoutDashboard, 
  UserPlus, 
  ShieldCheck, 
  LogOut,
  MapPin,
  Shield,
  ShieldOff,
  FileText
} from "lucide-react";
import NewPatientModal from "./NewPatientModal";
import { LucideIcon } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { usePrivacyMode } from "@/lib/hooks/usePrivacyMode";

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
  const isAdmin = user?.publicMetadata?.role === "admin";
  const { isPrivate, togglePrivacy } = usePrivacyMode();

  if (pathname === "/kiosk") return null;

  return (
    <nav className="sticky top-10 z-40 h-24 border-b border-slate-200 bg-white/90 px-4 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 sm:px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 sm:gap-10 min-w-0">
        {/* 🏥 BRANDING SECTION (Merged from StaffHeader) */}
        <Link href="/" className="flex items-center gap-4 group">
          <div className="h-12 w-12 rounded-2xl bg-slate-900 shadow-lg shadow-slate-200 transition-all group-hover:bg-blue-600 dark:bg-slate-800 dark:shadow-slate-950 flex items-center justify-center">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-2 mb-1">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
               </span>
               <p className="text-[9px] font-black uppercase tracking-[0.2em] leading-none text-slate-400 dark:text-slate-500">
                 System Online • Unit 4B
               </p>
            </div>
            <p className="text-lg font-black italic tracking-tighter uppercase leading-none text-slate-900 dark:text-slate-100">
              Nexus <span className="text-blue-600">ER</span>
            </p>
          </div>
        </Link>

        <div className="hidden h-10 w-px bg-slate-200 dark:bg-slate-800 md:block" />

        {/* 🧭 NAVIGATION LINKS */}
        <div className="flex items-center gap-2">
          <NavLink 
            href="/dashboard/triage" 
            icon={LayoutDashboard} 
            label="Triage Board" 
            active={pathname.includes("/triage")} 
          />
          {/* Faxes */}
          <NavLink 
            href="/dashboard/faxes" 
            icon={FileText}
            label="Faxes"
            active={pathname.includes("/faxes")}
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

      <div className="flex items-center gap-3 sm:gap-6">
          <button 
            onClick={togglePrivacy}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              isPrivate 
                ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-200 animate-pulse" 
                : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
            }`}
          >
            {isPrivate ? <Shield className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
            <span className="hidden lg:inline">{isPrivate ? "Privacy Active" : "Privacy Off"}</span>
          </button>

        <ThemeToggle />

        {/* ➕ QUICK ACTION */}
        <NewPatientModal 
          trigger={
            <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 dark:hover:bg-blue-500 transition-all shadow-blue-200 dark:shadow-blue-900/40 shadow-lg active:scale-95">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">New Admission</span>
            </button>
          } 
        />

        <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

        {/* 👤 USER PROFILE (Merged from StaffHeader) */}
        <div className="flex items-center gap-4">
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
    </nav>
  );
}

function NavLink({ href, icon: Icon, label, active, variant = "default" }: NavLinkProps) {
  return (
    <Link href={href}>
      <button className={`flex items-center gap-2 px-5 py-3 rounded-2xl transition-all duration-300 ${
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