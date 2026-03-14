"use client";

import { ClerkLoaded, ClerkLoading, useAuth } from "@clerk/nextjs";
import StaffHeader from "@/components/StaffHeader";
import Navbar from "@/components/Navbar";
import { EkgLoader } from "@/components/ui/EkgLoader";
import { useStaffSession } from "@/lib/hooks/useStaffSession";

export default function AuthUIWrapper({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const staffSession = useStaffSession();
  const isAppAuthenticated = Boolean(isSignedIn || staffSession.authenticated);
  const isResolvingAuth = !isSignedIn && staffSession.loading;

  return (
    <>
      <ClerkLoading>
        <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#020617_0%,#0f172a_45%,#0b1120_100%)] px-6">
          <EkgLoader message="Verifying staff credentials..." className="max-w-2xl" />
        </main>
      </ClerkLoading>

      <ClerkLoaded>
        {isResolvingAuth ? (
          <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#020617_0%,#0f172a_45%,#0b1120_100%)] px-6">
            <EkgLoader message="Verifying staff credentials..." className="max-w-2xl" />
          </main>
        ) : isAppAuthenticated ? (
          <div className="min-h-screen flex flex-col overflow-x-clip bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.1),transparent_45%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_40%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_45%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_40%),linear-gradient(180deg,#020617_0%,#0b1120_100%)]">
            <StaffHeader />
            <Navbar />
            <main className="flex-1 min-h-[calc(100vh-8.5rem)]">
              <div className="mx-auto w-full max-w-screen-2xl px-3 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8 animate-in fade-in duration-500">
                {children}
              </div>
            </main>
          </div>
        ) : (
          <main className="flex-1 min-h-screen bg-[linear-gradient(135deg,#f8fafc_0%,#e2e8f0_50%,#e0e7ff_100%)] dark:bg-[linear-gradient(135deg,#020617_0%,#0f172a_45%,#0b1120_100%)]">
            <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(2,132,199,0.08),transparent_55%)] dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_55%)]">
              {children}
            </div>
          </main>
        )}
      </ClerkLoaded>
    </>
  );
}