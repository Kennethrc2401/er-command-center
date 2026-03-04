"use client";

import Link from "next/link";
import { Activity, LayoutDashboard, UserPlus, Settings } from "lucide-react";
import NewPatientModal from "./NewPatientModal";

export default function Navbar() {
  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-blue-700 font-black text-xl tracking-tight">
          <Activity className="h-6 w-6" />
          <span>MED-OS</span>
        </Link>

        <div className="flex gap-6 items-center text-sm font-medium text-slate-600">
          <Link href="/" className="flex items-center gap-2 hover:text-blue-600 transition-colors">
            <LayoutDashboard className="h-4 w-4" />
            Command Center
          </Link>
          <NewPatientModal 
            trigger={
              <button className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                <UserPlus className="h-4 w-4" />
                New Admission
              </button>
            } 
          />
        </div>
      </div>
    </nav>
  );
}