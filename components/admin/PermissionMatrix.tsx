"use client";

import { ROLE_POLICY_MATRIX, type PolicyActionKey } from "@/lib/auth/roles";
import { ShieldCheck } from "lucide-react";

const ACTION_LABELS: Record<PolicyActionKey, string> = {
  view_triage: "View Triage",
  view_admin: "View Admin",
  manage_users: "Manage Users",
  manage_passkeys: "Manage Passkeys",
  clear_throttle: "Clear Throttle",
  unlock_staff: "Unlock Staff",
  activate_break_glass: "Break-Glass",
};

export default function PermissionMatrix() {
  return (
    <section className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-sm">
      <header className="flex items-center gap-3 border-b border-slate-50 bg-slate-50/60 p-6">
        <div className="rounded-xl border border-slate-200 bg-slate-100 p-2">
          <ShieldCheck className="h-4 w-4 text-slate-700" />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">Permission Matrix</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Role · Route · Action Policy</p>
        </div>
      </header>

      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-245 text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Role</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Routes</th>
              {Object.keys(ACTION_LABELS).map((actionKey) => (
                <th key={actionKey} className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">
                  {ACTION_LABELS[actionKey as PolicyActionKey]}
                </th>
              ))}
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Notes</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_POLICY_MATRIX.map((policy) => (
              <tr key={policy.role} className="border-b border-slate-50 last:border-b-0">
                <td className="px-4 py-3">
                  <p className="text-xs font-black uppercase text-slate-800">{policy.label}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{policy.role}</p>
                </td>
                <td className="px-4 py-3 text-[11px] text-slate-600">
                  {policy.routes.map((route) => (
                    <div key={route} className="mb-1 last:mb-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold">
                      {route}
                    </div>
                  ))}
                </td>
                {Object.keys(ACTION_LABELS).map((actionKey) => {
                  const allowed = policy.actions[actionKey as PolicyActionKey];
                  return (
                    <td key={actionKey} className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                          allowed
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-slate-200 bg-slate-50 text-slate-400"
                        }`}
                      >
                        {allowed ? "Yes" : "No"}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-[11px] text-slate-500">{policy.notes || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
