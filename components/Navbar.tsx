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
  MapPin
} from "lucide-react";
import NewPatientModal from "./NewPatientModal";
import { LucideIcon } from "lucide-react";

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

  if (pathname === "/kiosk") return null;

  return (
    <nav className="sticky top-10 z-40 h-24 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4 sm:gap-10 min-w-0">
        {/* 🏥 BRANDING SECTION (Merged from StaffHeader) */}
        <Link href="/" className="flex items-center gap-4 group">
          <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-all shadow-lg shadow-slate-200">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-2 mb-1">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
               </span>
               <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] leading-none">
                 System Online • Unit 4B
               </p>
            </div>
            <p className="text-lg font-black italic tracking-tighter uppercase leading-none text-slate-900">
              Nexus <span className="text-blue-600">ER</span>
            </p>
          </div>
        </Link>

        <div className="h-10 w-px bg-slate-200 hidden md:block" />

        {/* 🧭 NAVIGATION LINKS */}
        <div className="flex items-center gap-2">
          <NavLink 
            href="/dashboard/triage" 
            icon={LayoutDashboard} 
            label="Triage Board" 
            active={pathname.includes("/triage")} 
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
        {/* ➕ QUICK ACTION */}
        <NewPatientModal 
          trigger={
            <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-blue-200 shadow-lg active:scale-95">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">New Admission</span>
            </button>
          } 
        />

        <div className="h-10 w-px bg-slate-200 hidden sm:block" />

        {/* 👤 USER PROFILE (Merged from StaffHeader) */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex flex-col items-end">
            <p className="text-[10px] font-black uppercase text-slate-900 leading-none italic">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest mt-1.5 flex items-center gap-1">
              <MapPin className="h-2 w-2" /> {isAdmin ? "Unit Coordinator" : "Clinical Staff"}
            </p>
          </div>
          
          <SignOutButton>
            <button className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all border border-slate-100 active:scale-95">
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
          ? "bg-slate-100 text-slate-900 shadow-inner" 
          : "text-slate-500 hover:bg-slate-50"
      }`}>
        <Icon className={`h-4 w-4 ${active ? (variant === "admin" ? "text-emerald-500" : "text-blue-600") : "text-slate-400"}`} />
        <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">
          {label}
        </span>
      </button>
    </Link>
  );
}