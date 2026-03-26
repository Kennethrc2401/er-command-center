"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Fingerprint, LockKeyhole, PencilLine, ShieldAlert, TimerReset, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { defaultCredentialsForRole, normalizeStaffRole } from "@/lib/auth/roles";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { useStaffSession } from "@/lib/hooks/useStaffSession";

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

export default function SecurityDiagnostics() {
  const { user } = useUser();
  const { actorName } = useResolvedActor();
  const staffSession = useStaffSession();
  const lockedAccounts = useQuery(api.users.getLockedStaffAccounts);
  const throttleRows = useQuery(api.users.getRecentStaffThrottleActivity, { limit: 20 });
  const passkeyInventory = useQuery(api.passkeys.getAdminPasskeyInventory, { limit: 150 });
  const unlockStaffAccount = useMutation(api.users.unlockStaffAccount);
  const clearStaffIpRateLimit = useMutation(api.users.clearStaffIpRateLimit);
  const renamePasskey = useMutation(api.passkeys.renamePasskey);
  const revokePasskey = useMutation(api.passkeys.revokePasskey);
  const ensureUserProfile = useMutation(api.users.ensureUserProfile);
  const logAuditEvent = useMutation(api.audit.logEvent);
  const [unlockingId, setUnlockingId] = useState<Id<"users"> | null>(null);
  const [clearingKey, setClearingKey] = useState<string | null>(null);
  const [renamingPasskeyId, setRenamingPasskeyId] = useState<Id<"staffPasskeys"> | null>(null);
  const [revokingPasskeyId, setRevokingPasskeyId] = useState<Id<"staffPasskeys"> | null>(null);

  const activeThrottleBlocks = throttleRows?.filter((row) => row.isBlocked).length ?? 0;
  const activePasskeyCount = passkeyInventory?.filter((row) => row.status === "ACTIVE").length ?? 0;

  const auditActorId = staffSession.user?.userId as Id<"users"> | undefined;

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
      await unlockStaffAccount({ id: userId });
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
      await clearStaffIpRateLimit({ key });
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
      await renamePasskey({
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
      await revokePasskey({ passkeyId });
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

  return (
    <div className="space-y-6">
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
              <button
                type="button"
                onClick={() => handleUnlock(user._id, user.name)}
                disabled={unlockingId === user._id}
                className="mt-3 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {unlockingId === user._id ? "Unlocking..." : "Unlock Account"}
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
                    <button
                      type="button"
                      onClick={() => handleClearThrottle(row.key)}
                      disabled={clearingKey === row.key}
                      className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {clearingKey === row.key ? "Clearing..." : "Clear Key"}
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRenamePasskey(row._id, row.name, row.userName)}
                        disabled={renamingPasskeyId === row._id || revokingPasskeyId === row._id}
                        className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <PencilLine className="h-3 w-3" />
                        {renamingPasskeyId === row._id ? "Renaming" : "Rename"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevokePasskey(row._id, row.userName)}
                        disabled={revokingPasskeyId === row._id || renamingPasskeyId === row._id}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
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
