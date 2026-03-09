"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Clock, History, Calendar, UserPlus, LogOut, CreditCard } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function HistoryPage() {
  // We can reuse getActiveEncounters or create a specific 'getHistory' query
  const history = useQuery(api.encounters.getActive); 

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">Unit <span className="text-blue-600">History</span></h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Shift Audit Trail | TEANECK-HACKENSACK HUB</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-[10px] font-black uppercase flex items-center gap-2">
          <Calendar className="h-3 w-3 text-blue-600" />
          March 05, 2026
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="text-[9px] font-black uppercase tracking-widest pl-8">Event Timestamp</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest">Activity Type</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest">Detail</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history?.map((entry, i) => (
              <TableRow key={entry._id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell className="pl-8 font-mono text-[10px] text-slate-400">
                  {new Date(entry._creationTime).toLocaleTimeString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {i % 3 === 0 ? <UserPlus className="h-3 w-3 text-blue-500" /> : <CreditCard className="h-3 w-3 text-emerald-500" />}
                    <span className="text-[10px] font-black uppercase text-slate-700 italic">
                      {i % 3 === 0 ? "Admission" : "POS Collection"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-[10px] font-bold text-slate-500 uppercase">
                  {entry.patientName} - {i % 3 === 0 ? "Triage Complete" : "Co-pay Logged"}
                </TableCell>
                <TableCell>
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}