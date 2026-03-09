"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import StaffHeader from "@/components/StaffHeader";
import Navbar from "@/components/Navbar";

export default function AuthUIWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Authenticated>
        <div className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.1),transparent_45%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_40%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] overflow-x-clip">
          <StaffHeader />
          <Navbar />
          <main className="flex-1 min-h-[calc(100vh-8.5rem)]">
            <div className="mx-auto w-full max-w-screen-2xl px-3 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8 animate-in fade-in duration-500">
              {children}
            </div>
          </main>
        </div>
      </Authenticated>

      <Unauthenticated>
        <main className="flex-1 min-h-screen bg-[linear-gradient(135deg,#020617_0%,#0f172a_45%,#0b1120_100%)]">
          <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_55%)]">
            {children}
          </div>
        </main>
      </Unauthenticated>
    </>
  );
}