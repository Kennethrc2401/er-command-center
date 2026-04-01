"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Calendar, UserPlus, CreditCard } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function HistoryPage() {
  // We can reuse getActiveEncounters or create a specific 'getHistory' query
  const history = useQuery(api.encounters.getActive); 

  return (
    <div className="space-y-8 text-slate-900 animate-in slide-in-from-bottom-4 duration-500 dark:text-slate-100">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-slate-100">Unit <span className="text-blue-600">History</span></h1>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Shift Audit Trail | TEANECK-HACKENSACK HUB</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase dark:border-slate-700 dark:bg-slate-900">
          <Calendar className="h-3 w-3 text-blue-600" />
          March 05, 2026
        </div>
      </div>

      <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-950/50">
            <TableRow>
              <TableHead className="text-[9px] font-black uppercase tracking-widest pl-8">Event Timestamp</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest">Activity Type</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest">Detail</TableHead>
              <TableHead className="text-[9px] font-black uppercase tracking-widest">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history?.map((entry, i) => (
              <TableRow key={entry._id} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <TableCell className="pl-8 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                  {new Date(entry._creationTime).toLocaleTimeString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {i % 3 === 0 ? <UserPlus className="h-3 w-3 text-blue-500" /> : <CreditCard className="h-3 w-3 text-emerald-500" />}
                    <span className="text-[10px] font-black uppercase italic text-slate-700 dark:text-slate-200">
                      {i % 3 === 0 ? "Admission" : "POS Collection"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-300">
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