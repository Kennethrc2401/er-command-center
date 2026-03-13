"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ShieldCheck, User, Clock, FileSearch } from "lucide-react";

export default function AuditLogViewer() {
  const logs = useQuery(api.audit.getRecentLogs);

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
      <header className="p-8 border-b border-slate-50 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
        <div>
          <h2 className="text-lg font-black uppercase italic tracking-tight text-slate-900">Security Audit Trail</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HIPAA Compliance Log</p>
        </div>
      </header>

      <div className="p-4 space-y-2">
        {logs?.map((log) => (
          <div key={log._id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  <span className="text-blue-600 uppercase font-black">{log.userName}</span> 
                  <span className="mx-2 text-slate-300 font-normal">performed</span> 
                  <span className="uppercase tracking-tighter bg-slate-100 px-2 py-0.5 rounded text-[10px]">{log.action}</span>
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-1">
                  Target: {log.patientName || "System"} • {log.metadata}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                {new Date(log.timestamp).toLocaleTimeString()}
              </p>
              <p className="text-[9px] font-medium text-slate-300">
                {new Date(log.timestamp).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}