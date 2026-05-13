"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RevenuePayerMix from "@/components/mgmt/RevenuePayerMix";
import { toast } from "sonner";

interface RevenueCardProps {
  title: string;
  value: string | number;
  trend: string;
  trendUp: boolean;
}

export default function RevenuePage() {
  const stats = useQuery(api.encounters.getERStats);
  // POS functions disabled - pos.ts backend deleted due to schema conflicts
  // const posQueueSummary = useQuery(api.pos.getPosQueueSummary);
  // const posPermissions = useQuery(api.pos.getPosPermissions, {});
  // const activeDrawer = useQuery(api.pos.getActiveDrawerSession, {});
  // const recentDrawerSessions = useQuery(api.pos.getRecentDrawerSessions, {});
  // const closeout = useQuery(api.pos.getDailyCloseout, {});

  // const openDrawer = useMutation(api.pos.openDrawerSession);
  // const closeDrawer = useMutation(api.pos.closeDrawerSession);
  // const acknowledgeVariance = useMutation(api.pos.acknowledgeDrawerVariance);
  
  // Stub objects and functions for disabled POS functionality
  const posQueueSummary = { claimScrubQueue: 0, denialsAtRisk: 0, readyToSubmit: 0, todayCollectionsCents: 0, todayNetCollectionsCents: 0, todayRefundsCents: 0 };
  const posPermissions = { canManage: false };
  const activeDrawer: any = undefined;
  const recentDrawerSessions: any[] = [];
  const closeout: any = undefined;
  const openDrawer = async (_args?: any) => Promise.resolve({});
  const closeDrawer = async (_args?: any) => Promise.resolve({ varianceCents: 0 });
  const acknowledgeVariance = async (_args?: any) => Promise.resolve();

  const [openingFloat, setOpeningFloat] = useState("200.00");
  const [actualCash, setActualCash] = useState("0.00");
  const [closeNote, setCloseNote] = useState("");
  const [ackNote, setAckNote] = useState("");
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false);
  const [isClosingDrawer, setIsClosingDrawer] = useState(false);
  const [isAcknowledgingVariance, setIsAcknowledgingVariance] = useState(false);

  const projectedCashCents = useMemo(() => {
    if (!activeDrawer) return 0;
    const grossCash = closeout?.totalsByMethod.cash ?? 0;
    const refundedCash = (closeout?.refunds ?? []).reduce((sum: number, refund: any) => sum + refund.amountCents, 0);
    return Math.max(0, activeDrawer.openingFloatCents + grossCash - refundedCash);
  }, [activeDrawer, closeout]);

  const pendingVarianceSession = useMemo(() => {
    if (!recentDrawerSessions) return null;
    return recentDrawerSessions.find(
      (session) =>
        session.status === "closed" &&
        Math.abs(session.varianceCents ?? 0) > 0 &&
        !session.varianceAcknowledged
    ) ?? null;
  }, [recentDrawerSessions]);

  const handleOpenDrawer = async () => {
    const openingFloatCents = Math.round(Number(openingFloat) * 100);
    if (!Number.isFinite(openingFloatCents) || openingFloatCents < 0) {
      toast.error("Enter a valid opening float");
      return;
    }

    setIsOpeningDrawer(true);
    try {
      await openDrawer({ openingFloatCents });
      toast.success("Drawer opened");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open drawer");
    } finally {
      setIsOpeningDrawer(false);
    }
  };

  const handleCloseDrawer = async () => {
    if (!activeDrawer) {
      toast.error("No open drawer session found");
      return;
    }

    const actualCashCents = Math.round(Number(actualCash) * 100);
    if (!Number.isFinite(actualCashCents) || actualCashCents < 0) {
      toast.error("Enter a valid cash count");
      return;
    }

    setIsClosingDrawer(true);
    try {
      const result = await closeDrawer({
        sessionId: activeDrawer._id,
        actualCashCents,
        closeNote: closeNote.trim() || undefined,
      });

      const variance = (result.varianceCents / 100).toFixed(2);
      toast.success(`Drawer closed. Variance: $${variance}`);
      setCloseNote("");
      setActualCash("0.00");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to close drawer");
    } finally {
      setIsClosingDrawer(false);
    }
  };

  const handleAcknowledgeVariance = async () => {
    if (!pendingVarianceSession) {
      toast.error("No pending variance to acknowledge");
      return;
    }

    setIsAcknowledgingVariance(true);
    try {
      await acknowledgeVariance({
        sessionId: pendingVarianceSession._id,
        note: ackNote.trim() || undefined,
      });
      toast.success("Variance acknowledged. Drawer can be reopened.");
      setAckNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to acknowledge variance");
    } finally {
      setIsAcknowledgingVariance(false);
    }
  };

  // Simulated payer mix for the chart
  const payerMix = [
    { name: "Horizon BCBS", count: 42, color: "bg-blue-600" },
    { name: "United Healthcare", count: 25, color: "bg-emerald-600" },
    { name: "Medicare", count: 28, color: "bg-purple-600" },
    { name: "Self-Pay", count: 10, color: "bg-amber-500" },
  ];

  return (
    <div id="pos-terminal" className="space-y-8 text-slate-900 animate-in fade-in duration-500 dark:text-slate-100">
      <div>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-slate-100">Revenue <span className="text-blue-600">Analytics</span></h1>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Fiscal Year 2026 | Unit 4B Performance</p>
      </div>

      <Card className="rounded-[2rem] border-violet-200 bg-violet-50/70 p-6 dark:border-violet-800 dark:bg-violet-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">AdvancedMD POS</p>
            <h2 className="text-2xl font-black uppercase tracking-tight text-violet-800 dark:text-violet-200">Drawer Reconciliation</h2>
          </div>
          <Badge className={`${activeDrawer ? "bg-emerald-600" : "bg-slate-600"} border-none px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white`}>
            {activeDrawer ? "Drawer Open" : "Drawer Closed"}
          </Badge>
        </div>

        {pendingVarianceSession ? (
          <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">Shift Close Acknowledgement Required</p>
            <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
              The most recent closed drawer has an unacknowledged variance of ${((pendingVarianceSession.varianceCents ?? 0) / 100).toFixed(2)}.
              New drawer sessions are blocked until a manager acknowledges this variance.
            </p>
            <input
              value={ackNote}
              onChange={(event) => setAckNote(event.target.value.slice(0, 160))}
              placeholder="Acknowledgement note (optional)"
              className="mt-3 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-amber-500 dark:border-amber-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <Button
              onClick={() => void handleAcknowledgeVariance()}
              disabled={isAcknowledgingVariance || !posPermissions?.canManage}
              className="mt-3 rounded-xl bg-amber-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-amber-500"
            >
              {isAcknowledgingVariance ? "Acknowledging..." : "Acknowledge Variance"}
            </Button>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Open Drawer</p>
            <input
              value={openingFloat}
              onChange={(event) => setOpeningFloat(event.target.value)}
              placeholder="Opening float"
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <Button
              onClick={() => void handleOpenDrawer()}
              disabled={isOpeningDrawer || Boolean(activeDrawer)}
              className="mt-3 w-full rounded-xl bg-violet-600 py-5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-violet-500"
            >
              {isOpeningDrawer ? "Opening..." : "Open Drawer Session"}
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Close Drawer</p>
            <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Projected Cash: ${(projectedCashCents / 100).toFixed(2)}</p>
            <input
              value={actualCash}
              onChange={(event) => setActualCash(event.target.value)}
              placeholder="Actual cash count"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <input
              value={closeNote}
              onChange={(event) => setCloseNote(event.target.value.slice(0, 160))}
              placeholder="Close note (optional)"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <Button
              onClick={() => void handleCloseDrawer()}
              disabled={isClosingDrawer || !activeDrawer}
              className="mt-3 w-full rounded-xl bg-emerald-600 py-5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-500"
            >
              {isClosingDrawer ? "Closing..." : "Close Drawer Session"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricChip label="Claim Scrub Queue" value={String(posQueueSummary?.claimScrubQueue ?? 0)} />
          <MetricChip label="Net Collections Today" value={`$${((posQueueSummary?.todayNetCollectionsCents ?? 0) / 100).toFixed(2)}`} />
          <MetricChip label="Refunds Today" value={`$${((posQueueSummary?.todayRefundsCents ?? 0) / 100).toFixed(2)}`} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RevenueCard title="Net Collections" value={`$${stats?.dailyRevenue || 0}`} trend="+12.5%" trendUp={true} />
        <RevenueCard title="Avg. Reimbursement" value="$1,840" trend="-2.1%" trendUp={false} />
        <RevenueCard title="Clean Claim Rate" value="98.4%" trend="+0.5%" trendUp={true} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <RevenuePayerMix payerData={payerMix} />
        <Card className="rounded-[2.5rem] border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-6 text-xs font-black uppercase italic tracking-widest text-slate-400 dark:text-slate-500">Shift Collection Velocity</h3>
          <div className="h-64 flex items-end gap-2 px-4">
            {[40, 70, 45, 90, 65, 80, 95].map((h, i) => (
              <div key={i} className="group relative flex-1 rounded-t-lg bg-slate-100 transition-colors hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-950/40">
                <div className="absolute bottom-0 w-full bg-blue-600 rounded-t-lg transition-all duration-1000" style={{ height: `${h}%` }} />
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 dark:text-slate-500">0{i+1}:00</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Hourly Cash Capture (Current Shift)</p>
        </Card>
      </div>

      <Card className="rounded-[2rem] border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Recent Drawer Sessions</h3>
        <div className="mt-3 space-y-2">
          {(recentDrawerSessions ?? []).length === 0 ? (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">No drawer sessions yet.</p>
          ) : (
            (recentDrawerSessions ?? []).map((session) => (
              <div key={session._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {new Date(session.openedAt).toLocaleString()} • {session.openedBy}
                  </p>
                  <Badge className={`${session.status === "open" ? "bg-emerald-600" : "bg-slate-600"} border-none text-white`}>
                    {session.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                  Float ${(session.openingFloatCents / 100).toFixed(2)}
                  {typeof session.varianceCents === "number" ? ` • Variance $${(session.varianceCents / 100).toFixed(2)}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function RevenueCard({ title, value, trend, trendUp }: RevenueCardProps) {
  return (
    <Card className="rounded-[2rem] border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{title}</p>
      <div className="flex items-baseline gap-3">
        <h2 className="text-3xl font-black italic tracking-tighter text-slate-900 dark:text-slate-100">{value}</h2>
        <div className={`flex items-center text-[10px] font-black ${trendUp ? 'text-emerald-500' : 'text-red-500'}`}>
          {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trend}
        </div>
      </div>
    </Card>
  );
}