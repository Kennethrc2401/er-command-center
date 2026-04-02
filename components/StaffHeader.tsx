"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { notifyStaffSessionUpdated, useStaffSession } from "@/lib/hooks/useStaffSession";

export default function StaffHeader() {
  const { isSignedIn } = useAuth();
  const staffSession = useStaffSession();
  const router = useRouter();
  const [logoutPending, setLogoutPending] = useState(false);

  const handleStaffLogout = async () => {
    setLogoutPending(true);
    try {
      await fetch("/api/staff-auth/logout", {
        method: "POST",
        credentials: "include",
      });
      notifyStaffSessionUpdated();
      await staffSession.refresh();
      router.push("/staff-login");
      router.refresh();
    } finally {
      setLogoutPending(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full shrink-0 border-b border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
          <div className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-100">
              Nexus <span className="text-sky-300">Core</span>
            </span>
            <span className="hidden rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 sm:inline">
              System Live
            </span>
          </div>

          <span className="hidden rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200 md:inline-flex">
            Hackensack Meridian Main
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:justify-end lg:gap-4">
          <div className="hidden items-center gap-2 lg:flex">
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-300">
              HIPAA Tunnel Active
            </span>
            <div className="h-3.5 w-px bg-slate-700" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">
              Unit 4B Triage
            </span>
          </div>

          {isSignedIn ? (
            <UserButton afterSignOutUrl="/" />
          ) : staffSession.authenticated && staffSession.user ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                {staffSession.user.username}
              </span>
              <button
                onClick={handleStaffLogout}
                disabled={logoutPending}
                className="rounded-md bg-slate-700 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {logoutPending ? "Signing Out..." : "Sign Out"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/staff-login"
                className="rounded-md bg-sky-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950 transition-colors hover:bg-sky-400"
              >
                Staff Login
              </Link>
              <SignInButton mode="modal">
                <button className="rounded-md bg-slate-700 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-100 transition-colors hover:bg-slate-600">
                  Clerk Login
                </button>
              </SignInButton>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}