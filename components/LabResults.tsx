"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Beaker, CheckCircle2, ChevronLeft, ChevronRight, FlaskConical, History } from "lucide-react";
import AddLabResult from "./AddLabResult";

const RESULTS_PER_PAGE = 10;

export default function LabResults({ encounterId }: { encounterId: Id<"encounters"> }) {
  const labs = useQuery(api.labs.getByEncounter, { encounterId });
  const orders = useQuery(api.orders.getByEncounter, { encounterId });
  const [pagination, setPagination] = useState({ encounterId, page: 1 });

  const labsSafe = useMemo(() => labs ?? [], [labs]);
  const sortedLabs = useMemo(
    () => [...labsSafe].sort((a, b) => b._creationTime - a._creationTime),
    [labsSafe]
  );
  const totalPages = Math.max(1, Math.ceil(sortedLabs.length / RESULTS_PER_PAGE));

  const requestedPage = pagination.encounterId === encounterId ? pagination.page : 1;
  const page = Math.min(requestedPage, totalPages);

  const startIndex = (page - 1) * RESULTS_PER_PAGE;
  const endIndex = Math.min(startIndex + RESULTS_PER_PAGE, sortedLabs.length);
  const pagedLabs = sortedLabs.slice(startIndex, endIndex);

  const completedLabOrders = (orders ?? [])
    .filter((order) => order.type === "LAB" && order.status === "COMPLETED")
    .sort((a, b) => b.orderedAt - a.orderedAt);

  // 1. Loading State
  if (labs === undefined) {
    return (
      <div className="h-40 w-full bg-slate-50 animate-pulse rounded-2xl border border-slate-100 flex items-center justify-center">
        <FlaskConical className="h-6 w-6 text-slate-300 animate-bounce" />
      </div>
    );
  }

  // 2. Critical Check
  const hasCriticals = labsSafe.some((lab) => lab.isAbnormal);

  return (
    <div className="space-y-4">
      {/* CRITICAL ALERT BANNER */}
      {hasCriticals && (
        <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="h-5 w-5 text-red-600 animate-pulse" />
          <div>
            <p className="text-[10px] font-black text-red-900 uppercase tracking-widest leading-none">Critical Results Pending Review</p>
            <p className="text-[10px] text-red-700 font-bold mt-1 uppercase opacity-80">Notify Attending Physician Immediately</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50/50 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Beaker className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Laboratory Data</h3>
          </div>
          <div className="flex items-center gap-2">
            <AddLabResult encounterId={encounterId} />
            <span className="text-[9px] font-black text-slate-400 bg-white px-2 py-1 rounded border border-slate-200 uppercase tracking-tighter">
              HMN Health Lab Services
            </span>
          </div>
        </div>

        <Table>
          <TableHeader className="bg-slate-50/30">
            <TableRow className="hover:bg-transparent border-b border-slate-100">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-6 h-10">Test Component</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Result</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ref Range</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pr-6 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {labsSafe.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-20">
                  <FlaskConical className="h-10 w-10 text-slate-100 mx-auto mb-3" />
                  <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Awaiting Specimen Analysis</p>
                </TableCell>
              </TableRow>
            ) : (
              pagedLabs.map((lab) => (
                <TableRow key={lab._id} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0">
                  <TableCell className="pl-6 py-4">
                    <span className="font-black text-slate-800 text-sm tracking-tight">{lab.testName}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-black ${lab.isAbnormal ? 'text-red-600' : 'text-slate-700'}`}>
                        {lab.value} 
                        <span className="text-[10px] ml-1 font-bold opacity-60">{lab.unit}</span>
                      </span>
                      {lab.isAbnormal && (
                        <Badge className="bg-red-100 text-red-700 border-none hover:bg-red-100 h-4 px-1.5 text-[8px] font-black uppercase tracking-tighter">
                          Abnormal
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[11px] font-mono font-bold text-slate-400 italic">
                    {lab.range}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Badge variant="outline" className={`text-[9px] uppercase font-black h-5 px-2 tracking-widest border-2 ${
                      lab.status === 'final' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
                    }`}>
                      {lab.status === 'final' && <CheckCircle2 className="h-2.5 w-2.5 mr-1" />}
                      {lab.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-white">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Showing {startIndex + 1}-{endIndex} of {sortedLabs.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setPagination({ encounterId, page: Math.max(1, page - 1) })
                }
                disabled={page === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronLeft className="h-3 w-3" /> Prev
              </button>
              <span className="text-[10px] font-black text-slate-500">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setPagination({ encounterId, page: Math.min(totalPages, page + 1) })
                }
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Next <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
        
        <div className="px-6 py-3 bg-slate-50/30 border-t border-slate-100 flex justify-between items-center">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter italic">
            Electronic Review Signature: Sophia Amanda Ramirez, RN
          </p>
          <p className="text-[9px] text-slate-400 font-black uppercase">
            Total Tests: {labsSafe.length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/40 flex items-center gap-2">
          <History className="h-4 w-4 text-blue-600" />
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Resulted From Orders</h4>
        </div>

        {orders === undefined ? (
          <div className="p-6 text-[11px] text-slate-400 font-semibold">Loading order result history...</div>
        ) : completedLabOrders.length === 0 ? (
          <div className="p-6 text-[11px] text-slate-500 font-semibold">
            No accepted lab order results yet. Completed lab orders will stay visible here.
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
            {completedLabOrders.map((order) => (
              <div key={order._id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-800 tracking-tight">{order.testName}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Ordered {new Date(order.orderedAt).toLocaleString()}
                  </p>
                </div>
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase tracking-wide">
                  Resulted
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}