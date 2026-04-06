"use client";

import Link from "next/link";
import { Activity, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";

type TriageTabKey = "overview" | "patients";

type TriageTabsProps = {
  activeTab: TriageTabKey;
  className?: string;
};

export default function TriageTabs({ activeTab, className }: TriageTabsProps) {
  const isOverview = activeTab === "overview";
  const isPatients = activeTab === "patients";

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-950",
        className
      )}
    >
      <Link href="/dashboard/triage">
        <button
          type="button"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
            isOverview
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Triage Overview</span>
        </button>
      </Link>
      <Link href="/dashboard/triage/patients">
        <button
          type="button"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
            isPatients
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <Rows3 className="h-3.5 w-3.5" />
          <span>Patient List</span>
        </button>
      </Link>
    </div>
  );
}
