"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, KeyRound, Loader2, Lock, UserRound } from "lucide-react";

export default function StaffLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "reset">("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
    officeKey: "",
  });

  const [resetForm, setResetForm] = useState({
    username: "",
    officeKey: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/staff-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(loginForm),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to sign in.");
        return;
      }

      setSuccess("Access granted. Redirecting to triage dashboard...");
      router.push("/dashboard/triage");
      router.refresh();
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    if (resetForm.newPassword.length < 8) {
      setPending(false);
      setError("New password must be at least 8 characters.");
      return;
    }

    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setPending(false);
      setError("New password and confirmation do not match.");
      return;
    }

    try {
      const response = await fetch("/api/staff-auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: resetForm.username,
          officeKey: resetForm.officeKey,
          newPassword: resetForm.newPassword,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to reset password.");
        return;
      }

      setSuccess("Password updated. You can now sign in with your new password.");
      setTab("login");
      setLoginForm((prev) => ({ ...prev, username: resetForm.username }));
      setResetForm({ username: "", officeKey: "", newPassword: "", confirmPassword: "" });
    } catch {
      setError("Unable to reset password right now. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.2),transparent_55%),linear-gradient(180deg,#0f172a_0%,#020617_100%)] px-4 py-10 text-white sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-xl space-y-8">
        <header className="space-y-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300">Hackensack Meridian Staff Access</p>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter sm:text-5xl">
            Staff <span className="text-blue-400">Credential Login</span>
          </h1>
          <p className="mx-auto max-w-md text-sm text-slate-300">
            Use your assigned username, password, and office key to access Nexus ER systems.
          </p>
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-slate-700/80 bg-slate-950/70 shadow-2xl shadow-blue-900/20 backdrop-blur">
          <div className="grid grid-cols-2 border-b border-slate-800">
            <button
              onClick={() => {
                setTab("login");
                setError(null);
                setSuccess(null);
              }}
              className={`px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
                tab === "login" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-900"
              }`}
              type="button"
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setTab("reset");
                setError(null);
                setSuccess(null);
              }}
              className={`px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
                tab === "reset" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-900"
              }`}
              type="button"
            >
              Forgot Password
            </button>
          </div>

          <div className="space-y-4 p-6 sm:p-8">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {success}
              </div>
            )}

            {tab === "login" ? (
              <form className="space-y-4" onSubmit={handleLogin}>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Username</span>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={loginForm.username}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 pl-10 pr-3 text-sm outline-none transition-all focus:border-blue-500"
                      required
                      autoComplete="username"
                    />
                  </div>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Password</span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 pl-10 pr-3 text-sm outline-none transition-all focus:border-blue-500"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Office Key</span>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      value={loginForm.officeKey}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, officeKey: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 pl-10 pr-3 text-sm outline-none transition-all focus:border-blue-500"
                      required
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {pending ? "Signing In" : "Access Triage Dashboard"}
                </button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleReset}>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Username</span>
                  <input
                    value={resetForm.username}
                    onChange={(e) => setResetForm((prev) => ({ ...prev, username: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm outline-none transition-all focus:border-blue-500"
                    required
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Office Key</span>
                  <input
                    type="password"
                    value={resetForm.officeKey}
                    onChange={(e) => setResetForm((prev) => ({ ...prev, officeKey: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm outline-none transition-all focus:border-blue-500"
                    required
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">New Password</span>
                  <input
                    type="password"
                    value={resetForm.newPassword}
                    onChange={(e) => setResetForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm outline-none transition-all focus:border-blue-500"
                    required
                    minLength={8}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Confirm New Password</span>
                  <input
                    type="password"
                    value={resetForm.confirmPassword}
                    onChange={(e) => setResetForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm outline-none transition-all focus:border-blue-500"
                    required
                    minLength={8}
                  />
                </label>

                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {pending ? "Updating Password" : "Reset Password"}
                </button>
              </form>
            )}
          </div>
        </section>

        <div className="text-center text-xs text-slate-400">
          Need provider SSO access instead?{" "}
          <Link href="/" className="font-semibold text-blue-400 hover:text-blue-300">
            Return to main portal
          </Link>
        </div>
      </div>
    </main>
  );
}
