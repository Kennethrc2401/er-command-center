"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AlertTriangle, CheckCircle2, Copy, Fingerprint, LockKeyhole, PencilLine, ServerCog, ShieldAlert, ShieldPlus, TimerReset, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { actionRequiresBreakGlass, canRolePerformAction, defaultCredentialsForRole, normalizeStaffRole, type PolicyActionKey } from "@/lib/auth/roles";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { useStaffSession } from "@/lib/hooks/useStaffSession";

type DeploymentCheck = {
  key: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
  fixStep?: string;
};

type DeploymentHealthPayload = {
  summaryStatus: "ok" | "warn" | "fail";
  deploymentOrigin: string;
  deploymentHost: string;
  rpId: string;
  allowedOrigins: string[];
  vercelEnvUrl: string;
  checks: DeploymentCheck[];
};

const formatTimestamp = (timestamp: number) => {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString();
};

const maskKey = (key: string) => {
  if (!key) return "unknown";
  if (key.startsWith("unknown:")) return "unknown-client";
  if (key.length <= 8) return key;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
};

const maskCredentialId = (credentialId: string) => {
  if (!credentialId) return "-";
  if (credentialId.length <= 12) return credentialId;
  return `${credentialId.slice(0, 6)}...${credentialId.slice(-6)}`;
};

const formatDurationMinutes = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
};

function PolicyBadge({
  action,
  actorRole,
}: {
  action: PolicyActionKey;
  actorRole: Parameters<typeof canRolePerformAction>[0];
}) {
  const policyAllowed = canRolePerformAction(actorRole, action);
  const breakGlassRequired = actionRequiresBreakGlass(action);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${
          policyAllowed
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border border-slate-200 bg-slate-50 text-slate-400"
        }`}
      >
        {policyAllowed ? "Policy-approved" : "Policy blocked"}
      </span>
      {policyAllowed && breakGlassRequired ? (
        <span className="inline-flex rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-fuchsia-700">
          Break-Glass required
        </span>
      ) : null}
    </div>
  );
}

export default function SecurityDiagnostics() {
  const { user } = useUser();
  const { actorName, actorRole, isAdmin } = useResolvedActor();
  const staffSession = useStaffSession();
  const lockedAccounts = useQuery(api.users.getLockedStaffAccounts);
  const throttleRows = useQuery(api.users.getRecentStaffThrottleActivity, { limit: 20 });
  const passkeyInventory = useQuery(api.passkeys.getAdminPasskeyInventory, { limit: 150 });
  const unlockStaffAccount = useMutation(api.users.unlockStaffAccount);
  const clearStaffIpRateLimit = useMutation(api.users.clearStaffIpRateLimitAdmin);
  const renamePasskey = useMutation(api.passkeys.renamePasskey);
  const revokePasskey = useMutation(api.passkeys.revokePasskey);
  const activateBreakGlass = useMutation(api.breakGlass.activate);
  const revokeBreakGlass = useMutation(api.breakGlass.revoke);
  const ensureUserProfile = useMutation(api.users.ensureUserProfile);
  const logAuditEvent = useMutation(api.audit.logEvent);
  const [unlockingId, setUnlockingId] = useState<Id<"users"> | null>(null);
  const [clearingKey, setClearingKey] = useState<string | null>(null);
  const [renamingPasskeyId, setRenamingPasskeyId] = useState<Id<"staffPasskeys"> | null>(null);
  const [revokingPasskeyId, setRevokingPasskeyId] = useState<Id<"staffPasskeys"> | null>(null);
  const [deploymentHealth, setDeploymentHealth] = useState<DeploymentHealthPayload | null>(null);
  const [deploymentHealthError, setDeploymentHealthError] = useState<string | null>(null);
  const [deploymentHealthLoading, setDeploymentHealthLoading] = useState(true);
  const [breakGlassReason, setBreakGlassReason] = useState("");
  const [breakGlassDuration, setBreakGlassDuration] = useState(60);
  const [breakGlassPending, setBreakGlassPending] = useState(false);

  const breakGlassActorId = staffSession.user?.userId as Id<"users"> | undefined;
  const currentBreakGlass = useQuery(
    api.breakGlass.getCurrentForUser,
    breakGlassActorId ? { userId: breakGlassActorId } : "skip"
  );
  const recentBreakGlass = useQuery(api.breakGlass.getRecent, { limit: 20 });

  const activeThrottleBlocks = throttleRows?.filter((row) => row.isBlocked).length ?? 0;
  const activePasskeyCount = passkeyInventory?.filter((row) => row.status === "ACTIVE").length ?? 0;
  const resolvedActorRole = normalizeStaffRole(actorRole, "NURSE");

  const auditActorId = staffSession.user?.userId as Id<"users"> | undefined;

  useEffect(() => {
    let active = true;

    const loadDeploymentHealth = async () => {
      setDeploymentHealthLoading(true);
      setDeploymentHealthError(null);

      try {
        const response = await fetch("/api/admin/deployment-health", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const data = (await response.json()) as DeploymentHealthPayload & { error?: string };
        if (!active) return;

        if (!response.ok) {
          setDeploymentHealthError(data.error ?? "Unable to load deployment diagnostics.");
          setDeploymentHealth(null);
          return;
        }

        setDeploymentHealth(data);
      } catch {
        if (!active) return;
        setDeploymentHealthError("Unable to load deployment diagnostics.");
        setDeploymentHealth(null);
      } finally {
        if (active) setDeploymentHealthLoading(false);
      }
    };

    void loadDeploymentHealth();

    return () => {
      active = false;
    };
  }, []);

  const resolveAuditActorId = async (): Promise<Id<"users"> | null> => {
    if (auditActorId) return auditActorId;

    const primaryEmail = user?.primaryEmailAddress?.emailAddress;
    if (!primaryEmail) return null;

    const role = normalizeStaffRole(user.publicMetadata?.role, "NURSE");
    const profile = await ensureUserProfile({
      email: primaryEmail,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || primaryEmail,
      username: user.username ?? undefined,
      role,
      credentials: defaultCredentialsForRole(role),
      department: "Emergency Medicine",
    });

    return profile._id;
  };

  const writePasskeyAudit = async (action: string, metadata: string) => {
    try {
      const resolvedActorId = await resolveAuditActorId();
      if (!resolvedActorId) return;

      await logAuditEvent({
        userId: resolvedActorId,
        userName: actorName,
        action,
        patientName: "Security Admin",
        metadata,
      });
    } catch {
      toast.warning("Passkey action completed, but audit logging was unavailable.");
    }
  };

  const handleUnlock = async (userId: Id<"users">, name: string) => {
    const confirmed = window.confirm(`Unlock ${name}'s account now?`);
    if (!confirmed) return;

    setUnlockingId(userId);
    try {
      const resolvedActorId = await resolveAuditActorId();
      if (!resolvedActorId) {
        toast.error("Unable to resolve admin actor identity.");
        return;
      }

      await unlockStaffAccount({ actorUserId: resolvedActorId, id: userId });
      toast.success(`${name} unlocked.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to unlock account.";
      toast.error(message);
    } finally {
      setUnlockingId(null);
    }
  };

  const handleClearThrottle = async (key: string) => {
    const confirmed = window.confirm("Clear this client throttle key and remove its current rate-limit state?");
    if (!confirmed) return;

    setClearingKey(key);
    try {
      const resolvedActorId = await resolveAuditActorId();
      if (!resolvedActorId) {
        toast.error("Unable to resolve admin actor identity.");
        return;
      }

      await clearStaffIpRateLimit({ actorUserId: resolvedActorId, key });
      toast.success("Throttle key cleared.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to clear throttle key.";
      toast.error(message);
    } finally {
      setClearingKey(null);
    }
  };

  const handleRenamePasskey = async (passkeyId: Id<"staffPasskeys">, currentName: string, userName: string) => {
    const suggestedName = currentName || "";
    const nextName = window.prompt(`Rename passkey for ${userName}:`, suggestedName);
    if (nextName === null) return;

    setRenamingPasskeyId(passkeyId);
    try {
      const resolvedActorId = await resolveAuditActorId();
      if (!resolvedActorId) {
        toast.error("Unable to resolve admin actor identity.");
        return;
      }

      await renamePasskey({
        actorUserId: resolvedActorId,
        passkeyId,
        name: nextName,
      });
      await writePasskeyAudit(
        "PASSKEY_RENAMED",
        `Target user=${userName}; passkeyId=${passkeyId}; label=${nextName.trim() || "(cleared)"}`
      );
      toast.success("Passkey label updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to rename passkey.";
      toast.error(message);
    } finally {
      setRenamingPasskeyId(null);
    }
  };

  const handleRevokePasskey = async (passkeyId: Id<"staffPasskeys">, userName: string) => {
    const confirmed = window.confirm(`Revoke this passkey for ${userName}? This device will no longer be able to sign in.`);
    if (!confirmed) return;

    setRevokingPasskeyId(passkeyId);
    try {
      const resolvedActorId = await resolveAuditActorId();
      if (!resolvedActorId) {
        toast.error("Unable to resolve admin actor identity.");
        return;
      }

      await revokePasskey({ actorUserId: resolvedActorId, passkeyId });
      await writePasskeyAudit(
        "PASSKEY_REVOKED",
        `Target user=${userName}; passkeyId=${passkeyId}`
      );
      toast.success("Passkey revoked.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to revoke passkey.";
      toast.error(message);
    } finally {
      setRevokingPasskeyId(null);
    }
  };

  const handleCopyFix = async (check: DeploymentCheck) => {
    if (!check.fixStep) return;
    try {
      await navigator.clipboard.writeText(check.fixStep);
      toast.success(`Copied fix for ${check.label}.`);
    } catch {
      toast.error("Unable to copy remediation text.");
    }
  };

  const handleActivateBreakGlass = async () => {
    if (!breakGlassActorId) {
      toast.error("Staff admin session is required to activate break-glass.");
      return;
    }

    const reason = breakGlassReason.trim();
    if (!reason) {
      toast.error("Provide a reason before activating break-glass.");
      return;
    }

    setBreakGlassPending(true);
    try {
      await activateBreakGlass({
        actorUserId: breakGlassActorId,
        reason,
        durationMinutes: breakGlassDuration,
      });
      setBreakGlassReason("");
      toast.success("Break-glass access activated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to activate break-glass.";
      toast.error(message);
    } finally {
      setBreakGlassPending(false);
    }
  };

  const handleRevokeBreakGlass = async () => {
    if (!breakGlassActorId || !currentBreakGlass) return;

    setBreakGlassPending(true);
    try {
      await revokeBreakGlass({
        actorUserId: breakGlassActorId,
        sessionId: currentBreakGlass._id,
        reason: "Manual revoke from Security Diagnostics",
      });
      toast.success("Break-glass access revoked.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to revoke break-glass.";
      toast.error(message);
    } finally {
      setBreakGlassPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2.5rem] border border-fuchsia-100 bg-white shadow-sm">
        <header className="flex items-center justify-between gap-3 border-b border-fuchsia-50 bg-fuchsia-50/40 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-100 p-2">
              <ShieldPlus className="h-4 w-4 text-fuchsia-700" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">Break-Glass Access</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-600">Temporary Elevated Privileges</p>
            </div>
          </div>

          <span
            className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
              currentBreakGlass
                ? "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700"
                : "border-slate-200 bg-slate-100 text-slate-500"
            }`}
          >
            {currentBreakGlass ? "Active" : "Inactive"}
          </span>
        </header>

        <div className="grid gap-4 p-4 xl:grid-cols-5">
          <div className="space-y-3 xl:col-span-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Emergency Reason
            </label>
            <textarea
              value={breakGlassReason}
              onChange={(event) => setBreakGlassReason(event.target.value)}
              placeholder="Example: Immediate access needed for critical trauma workflow override"
              className="min-h-24 w-full rounded-2xl border border-fuchsia-200 bg-fuchsia-50/30 px-3 py-2 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-fuchsia-400"
              disabled={!isAdmin || !breakGlassActorId || breakGlassPending}
            />

            <div className="flex flex-wrap items-center gap-2">
              {[30, 60, 120, 240].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setBreakGlassDuration(minutes)}
                  className={`rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                    breakGlassDuration === minutes
                      ? "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-700"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                  disabled={!isAdmin || !breakGlassActorId || breakGlassPending}
                >
                  {formatDurationMinutes(minutes)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleActivateBreakGlass()}
                disabled={!isAdmin || !breakGlassActorId || breakGlassPending}
                className="rounded-xl border border-fuchsia-300 bg-fuchsia-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-fuchsia-700 transition-colors hover:bg-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {breakGlassPending ? "Applying..." : "Activate Break-Glass"}
              </button>

              <button
                type="button"
                onClick={() => void handleRevokeBreakGlass()}
                disabled={!currentBreakGlass || breakGlassPending}
                className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {breakGlassPending ? "Processing..." : "Revoke"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 xl:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Session</p>
            {currentBreakGlass ? (
              <div className="mt-2 space-y-2">
                <p className="text-xs font-semibold text-slate-700">{currentBreakGlass.reason}</p>
                <p className="text-[11px] text-slate-500">Started: {formatTimestamp(currentBreakGlass.startedAt)}</p>
                <p className="text-[11px] text-slate-500">Expires: {formatTimestamp(currentBreakGlass.expiresAt)}</p>
              </div>
            ) : (
              <p className="mt-2 text-xs font-semibold text-slate-500">No active break-glass session.</p>
            )}
          </div>
        </div>

        <div className="border-t border-fuchsia-100 px-4 py-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Recent Break-Glass Events</p>
          <div className="space-y-2">
            {!recentBreakGlass && <p className="text-xs font-semibold text-slate-400">Loading break-glass history...</p>}
            {recentBreakGlass?.length === 0 && <p className="text-xs font-semibold text-slate-400">No break-glass events yet.</p>}
            {recentBreakGlass?.slice(0, 6).map((row) => (
              <div key={row._id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                <p className="text-[11px] font-black uppercase text-slate-700">{row.reason}</p>
                <p className="text-[10px] text-slate-500">
                  {formatTimestamp(row.startedAt)} - {row.isActive ? "Active" : `Inactive${row.revokedAt ? ` (revoked ${formatTimestamp(row.revokedAt)})` : ""}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2.5rem] border border-indigo-100 bg-white shadow-sm">
        <header className="flex items-center justify-between gap-3 border-b border-indigo-50 bg-indigo-50/40 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-indigo-200 bg-indigo-100 p-2">
              <ServerCog className="h-4 w-4 text-indigo-700" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">Deployment Health</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">Auth · Passkey · Runtime Config</p>
            </div>
          </div>

          <div
            className={`rounded-2xl border px-3 py-2 text-right ${
              deploymentHealth?.summaryStatus === "fail"
                ? "border-rose-200 bg-rose-100/70"
                : deploymentHealth?.summaryStatus === "warn"
                  ? "border-amber-200 bg-amber-100/70"
                  : "border-emerald-200 bg-emerald-100/70"
            }`}
          >
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-700">Runtime Status</p>
            <p className="text-lg font-black leading-none text-slate-800">
              {deploymentHealthLoading ? "..." : deploymentHealth?.summaryStatus?.toUpperCase() ?? "N/A"}
            </p>
            {deploymentHealth?.vercelEnvUrl ? (
              <a
                href={deploymentHealth.vercelEnvUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex rounded-lg border border-slate-300 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-100"
              >
                Open Vercel Env
              </a>
            ) : null}
          </div>
        </header>

        <div className="space-y-4 p-4">
          {deploymentHealthLoading && (
            <p className="p-2 text-xs font-semibold text-slate-400">Checking deployment configuration...</p>
          )}

          {deploymentHealthError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              {deploymentHealthError}
            </div>
          )}

          {deploymentHealth && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deployment Origin</p>
                  <p className="text-xs font-semibold text-slate-800">{deploymentHealth.deploymentOrigin}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Resolved RP ID</p>
                  <p className="text-xs font-semibold text-slate-800">{deploymentHealth.rpId}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-160 text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Check</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Status</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Detail</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Remediation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deploymentHealth.checks.map((check) => (
                      <tr key={check.key} className="border-b border-slate-50 last:border-b-0">
                        <td className="px-4 py-3 text-xs font-black uppercase text-slate-800">{check.label}</td>
                        <td className="px-4 py-3">
                          {check.status === "ok" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              OK
                            </span>
                          ) : check.status === "warn" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
                              <AlertTriangle className="h-3 w-3" />
                              WARN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-rose-700">
                              <XCircle className="h-3 w-3" />
                              FAIL
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-600">{check.detail}</td>
                        <td className="px-4 py-3">
                          {check.status === "ok" ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">No action</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleCopyFix(check)}
                              disabled={!check.fixStep}
                              className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Copy className="h-3 w-3" />
                              Copy Fix
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2 overflow-hidden rounded-[2.5rem] border border-rose-100 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-rose-50 bg-rose-50/40 p-6">
          <div className="rounded-xl border border-rose-200 bg-rose-100 p-2">
            <LockKeyhole className="h-4 w-4 text-rose-700" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">Locked Staff Accounts</h2>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-500">Account Lockout Monitor</p>
          </div>
        </header>

        <div className="p-4">
          {!lockedAccounts && <p className="p-4 text-xs font-semibold text-slate-400">Loading lockout state...</p>}

          {lockedAccounts && lockedAccounts.length === 0 && (
            <p className="p-4 text-xs font-semibold text-emerald-600">No currently locked staff accounts.</p>
          )}

          {lockedAccounts?.map((user) => (
            <div key={user._id} className="mb-2 rounded-2xl border border-rose-100 bg-rose-50/30 p-4 last:mb-0">
              <p className="text-xs font-black uppercase text-slate-800">{user.name}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                @{user.username || "unset"} • {user.role} • {user.department}
              </p>
              <p className="mt-2 text-[10px] font-bold uppercase text-rose-600">
                Locked Until: {formatTimestamp(user.lockedUntil)}
              </p>
              <p className="text-[10px] font-medium text-slate-500">Last Failed: {formatTimestamp(user.lastFailedLoginAt)}</p>
              <div className="mt-3">
                <PolicyBadge action="unlock_staff" actorRole={resolvedActorRole} />
              </div>
              <button
                type="button"
                onClick={() => handleUnlock(user._id, user.name)}
                disabled={unlockingId === user._id}
                title="Requires active break-glass access"
                className="mt-3 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex items-center gap-1">
                  <span>Break-Glass</span>
                  <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] tracking-[0.16em] text-rose-700">REQUIRED</span>
                </span>
                <span className="ml-2">{unlockingId === user._id ? "Unlocking..." : "Unlock Account"}</span>
              </button>
            </div>
          ))}
        </div>
        </div>

        <div className="xl:col-span-3 overflow-hidden rounded-[2.5rem] border border-amber-100 bg-white shadow-sm">
        <header className="flex items-center justify-between gap-3 border-b border-amber-50 bg-amber-50/40 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-amber-200 bg-amber-100 p-2">
              <ShieldAlert className="h-4 w-4 text-amber-700" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">IP Throttle Activity</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">Recent Login Pressure</p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-100/60 px-3 py-2 text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">Active Blocks</p>
            <p className="text-lg font-black leading-none text-amber-800">{activeThrottleBlocks}</p>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Client Key</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Attempts</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Window Start</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Last Activity</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Block Status</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {!throttleRows && (
                <tr>
                  <td className="px-4 py-6 text-xs font-semibold text-slate-400" colSpan={6}>
                    Loading throttle activity...
                  </td>
                </tr>
              )}

              {throttleRows && throttleRows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-xs font-semibold text-slate-400" colSpan={6}>
                    No throttle data recorded yet.
                  </td>
                </tr>
              )}

              {throttleRows?.map((row) => (
                <tr key={row._id} className="border-b border-slate-50 last:border-b-0">
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">{maskKey(row.key)}</td>
                  <td className="px-4 py-3 text-xs font-black text-slate-700">{row.attemptCount}</td>
                  <td className="px-4 py-3 text-[11px] text-slate-500">{formatTimestamp(row.windowStartedAt)}</td>
                  <td className="px-4 py-3 text-[11px] text-slate-500">{formatTimestamp(row.updatedAt)}</td>
                  <td className="px-4 py-3">
                    {row.isBlocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-rose-700">
                        <TimerReset className="h-3 w-3" />
                        Blocked Until {new Date(row.blockedUntil).toLocaleTimeString()}
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                        Monitoring
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="mb-2">
                      <PolicyBadge action="clear_throttle" actorRole={resolvedActorRole} />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleClearThrottle(row.key)}
                      disabled={clearingKey === row.key}
                      title="Requires active break-glass access"
                      className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>Break-Glass</span>
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] tracking-[0.16em] text-amber-800">REQUIRED</span>
                      </span>
                      <span className="ml-2">{clearingKey === row.key ? "Clearing..." : "Clear Key"}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2.5rem] border border-blue-100 bg-white shadow-sm">
        <header className="flex items-center justify-between gap-3 border-b border-blue-50 bg-blue-50/40 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-blue-200 bg-blue-100 p-2">
              <Fingerprint className="h-4 w-4 text-blue-700" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">Staff Passkeys</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">Device Inventory & Revocation</p>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-100/60 px-3 py-2 text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-blue-700">Active Accounts</p>
            <p className="text-lg font-black leading-none text-blue-800">{activePasskeyCount}</p>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-220 text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Staff</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Role / Status</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Passkey Label</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Credential</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Device</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Created</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Last Used</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!passkeyInventory && (
                <tr>
                  <td className="px-4 py-6 text-xs font-semibold text-slate-400" colSpan={8}>
                    Loading passkey inventory...
                  </td>
                </tr>
              )}

              {passkeyInventory && passkeyInventory.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-xs font-semibold text-slate-400" colSpan={8}>
                    No passkeys enrolled yet.
                  </td>
                </tr>
              )}

              {passkeyInventory?.map((row) => (
                <tr key={row._id} className="border-b border-slate-50 last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="text-xs font-black uppercase text-slate-800">{row.userName}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">@{row.username || "unset"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-700">{row.role}</p>
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                        row.status === "ACTIVE"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">{row.name || "Unlabeled Device"}</td>
                  <td className="px-4 py-3 text-[11px] font-semibold text-slate-500">{maskCredentialId(row.credentialId)}</td>
                  <td className="px-4 py-3 text-[11px] text-slate-500">
                    {(row.deviceType ?? "unknown").replaceAll("_", " ")}
                    {row.backedUp ? " · backed up" : ""}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-500">{formatTimestamp(row.createdAt)}</td>
                  <td className="px-4 py-3 text-[11px] text-slate-500">{formatTimestamp(row.lastUsedAt ?? 0)}</td>
                  <td className="px-4 py-3">
                    <div className="mb-2">
                      <PolicyBadge action="manage_passkeys" actorRole={resolvedActorRole} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRenamePasskey(row._id, row.name, row.userName)}
                        disabled={renamingPasskeyId === row._id || revokingPasskeyId === row._id}
                        title="Requires active break-glass access"
                        className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[8px] tracking-[0.16em] text-blue-700">BG</span>
                        <PencilLine className="h-3 w-3" />
                        {renamingPasskeyId === row._id ? "Renaming" : "Rename"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevokePasskey(row._id, row.userName)}
                        disabled={revokingPasskeyId === row._id || renamingPasskeyId === row._id}
                        title="Requires active break-glass access"
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[8px] tracking-[0.16em] text-rose-700">BG</span>
                        <Trash2 className="h-3 w-3" />
                        {revokingPasskeyId === row._id ? "Revoking" : "Revoke"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
