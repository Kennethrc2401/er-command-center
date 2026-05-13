"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

// UI Components
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Activity, Lock, Eye, FolderCog } from "lucide-react";
import { toast } from "sonner";

// Your Custom Components
import UnitRevenueSummary from "@/components/mgmt/UnitRevenueSummary";
import DashboardStats from "@/components/DashboardStats";
import RevenuePayerMix from "@/components/mgmt/RevenuePayerMix";
import ShiftHandoffModal from "@/components/mgmt/ShiftHandoffModal";
import SurgeAlertBanner from "@/components/alerts/SurgeAlertBanner";
import VolumeHeatmap from "@/components/clinical/VolumeHeatmap";
import { saveAIToolsPrefill } from "@/lib/helpers/aiTools";

const ADMIN_LAUNCH_CONSOLE_COLLAPSE_KEY = "admin-launch-console-collapsed";
const ADMIN_SHIFT_CHECKLIST_KEY = "admin-shift-readiness-checklist";
const ADMIN_RCM_CHECKLIST_KEY = "admin-rcm-checklist";

type ShiftChecklistState = {
  staffingConfirmed: boolean;
  criticalCoverage: boolean;
  bedHuddle: boolean;
  escalationReview: boolean;
};

type RcmChecklistState = {
  eligibilitySweep: boolean;
  chargeCaptureReview: boolean;
  denialWorkbench: boolean;
  claimBatchReady: boolean;
};

type PosQueueSummary = {
  claimScrubQueue: number;
  denialsAtRisk: number;
  readyToSubmit: number;
  todayCollectionsCents: number;
};

type PosPaymentRow = {
  collectedAt: string | Date;
  method: string;
  amountCents: number;
  reference?: string | null;
  collectedBy: string;
  chargeId: string | number;
  encounterId: string | number;
};

type PosRefundRow = {
  refundedAt: string | Date;
  amountCents: number;
  reason?: string | null;
  refundedBy: string;
  chargeId: string | number;
  encounterId: string | number;
};

type PosCloseout = {
  payments: PosPaymentRow[];
  refunds: PosRefundRow[];
};

const DEFAULT_SHIFT_CHECKLIST: ShiftChecklistState = {
  staffingConfirmed: false,
  criticalCoverage: false,
  bedHuddle: false,
  escalationReview: false,
};

const DEFAULT_RCM_CHECKLIST: RcmChecklistState = {
  eligibilitySweep: false,
  chargeCaptureReview: false,
  denialWorkbench: false,
  claimBatchReady: false,
};

export default function AdminDashboard() {
  const router = useRouter();
  const stats = useQuery(api.encounters.getERStats);
  // POS functions disabled - pos.ts backend deleted due to schema conflicts
  // const posQueueSummary = useQuery(api.pos.getPosQueueSummary);
  // const posCloseout = useQuery(api.pos.getDailyCloseout, {});
  
  // Stub objects for disabled POS functionality
  const posQueueSummary: PosQueueSummary = {
    claimScrubQueue: 0,
    denialsAtRisk: 0,
    readyToSubmit: 0,
    todayCollectionsCents: 0,
  };
  const posCloseout: PosCloseout = {
    payments: [],
    refunds: [],
  };
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isLaunchConsoleCollapsed, setIsLaunchConsoleCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(ADMIN_LAUNCH_CONSOLE_COLLAPSE_KEY) === "1";
  });
  const [shiftChecklist, setShiftChecklist] = useState<ShiftChecklistState>(() => {
    if (typeof window === "undefined") return DEFAULT_SHIFT_CHECKLIST;
    const stored = window.localStorage.getItem(ADMIN_SHIFT_CHECKLIST_KEY);
    if (!stored) return DEFAULT_SHIFT_CHECKLIST;
    try {
      const parsed = JSON.parse(stored) as Partial<ShiftChecklistState>;
      return {
        staffingConfirmed: Boolean(parsed.staffingConfirmed),
        criticalCoverage: Boolean(parsed.criticalCoverage),
        bedHuddle: Boolean(parsed.bedHuddle),
        escalationReview: Boolean(parsed.escalationReview),
      };
    } catch {
      return DEFAULT_SHIFT_CHECKLIST;
    }
  });
  const [rcmChecklist, setRcmChecklist] = useState<RcmChecklistState>(() => {
    if (typeof window === "undefined") return DEFAULT_RCM_CHECKLIST;
    const stored = window.localStorage.getItem(ADMIN_RCM_CHECKLIST_KEY);
    if (!stored) return DEFAULT_RCM_CHECKLIST;
    try {
      const parsed = JSON.parse(stored) as Partial<RcmChecklistState>;
      return {
        eligibilitySweep: Boolean(parsed.eligibilitySweep),
        chargeCaptureReview: Boolean(parsed.chargeCaptureReview),
        denialWorkbench: Boolean(parsed.denialWorkbench),
        claimBatchReady: Boolean(parsed.claimBatchReady),
      };
    } catch {
      return DEFAULT_RCM_CHECKLIST;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_LAUNCH_CONSOLE_COLLAPSE_KEY, isLaunchConsoleCollapsed ? "1" : "0");
  }, [isLaunchConsoleCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_SHIFT_CHECKLIST_KEY, JSON.stringify(shiftChecklist));
  }, [shiftChecklist]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_RCM_CHECKLIST_KEY, JSON.stringify(rcmChecklist));
  }, [rcmChecklist]);

  const checklistCompletedCount = Object.values(shiftChecklist).filter(Boolean).length;
  const checklistProgress = Math.round((checklistCompletedCount / 4) * 100);
  const rcmCompletedCount = Object.values(rcmChecklist).filter(Boolean).length;
  const rcmProgress = Math.round((rcmCompletedCount / 4) * 100);

  const rcmMetrics = {
    claimScrubQueue: posQueueSummary?.claimScrubQueue ?? 0,
    denialsAtRisk: posQueueSummary?.denialsAtRisk ?? 0,
    readyToSubmit: posQueueSummary?.readyToSubmit ?? 0,
    todayCollectionsCents: posQueueSummary?.todayCollectionsCents ?? 0,
  };

  const toggleChecklistItem = (field: keyof ShiftChecklistState) => {
    setShiftChecklist((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  const resetChecklist = () => {
    setShiftChecklist(DEFAULT_SHIFT_CHECKLIST);
    toast.success("Shift readiness checklist reset");
  };

  const toggleRcmChecklistItem = (field: keyof RcmChecklistState) => {
    setRcmChecklist((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  const resetRcmChecklist = () => {
    setRcmChecklist(DEFAULT_RCM_CHECKLIST);
    toast.success("RCM checklist reset");
  };

  const handleCopySnapshot = async () => {
    if (!stats) {
      toast.error("Operational stats are still loading");
      return;
    }

    const summaryLines = [
      `Unit Ops Snapshot (${new Date().toLocaleString()})`,
      `Active Census: ${stats.totalPatients}`,
      `High Acuity Patients: ${stats.highAcuity}`,
      `Available Beds: ${stats.availableBeds}`,
      `Pending Insurance: ${stats.pendingInsurance}`,
      `Revenue Today: $${stats.dailyRevenue}`,
    ];

    try {
      await navigator.clipboard.writeText(summaryLines.join("\n"));
      toast.success("Copied admin snapshot to clipboard");
    } catch {
      toast.error("Unable to copy snapshot");
    }
  };

  const handleCopyRcmBrief = async () => {
    const summaryLines = [
      `AdvancedMD RCM Brief (${new Date().toLocaleString()})`,
      `Claim Scrub Queue: ${rcmMetrics.claimScrubQueue}`,
      `Denials At Risk: ${rcmMetrics.denialsAtRisk}`,
      `Ready To Submit: ${rcmMetrics.readyToSubmit}`,
      `Today POS Collections: $${(rcmMetrics.todayCollectionsCents / 100).toFixed(2)}`,
      `Checklist Completion: ${rcmCompletedCount}/4`,
    ];

    try {
      await navigator.clipboard.writeText(summaryLines.join("\n"));
      toast.success("Copied RCM brief to clipboard");
    } catch {
      toast.error("Unable to copy RCM brief");
    }
  };

  const sendSnapshotToAiTools = () => {
    if (!stats) {
      toast.error("Operational stats are still loading");
      return;
    }

    saveAIToolsPrefill({
      version: 1,
      target: "differential",
      chiefComplaint: "Unit throughput risk monitoring",
      vitalsSummary: `Census ${stats.totalPatients}, High acuity ${stats.highAcuity}, Open beds ${stats.availableBeds}`,
      clinicalContext: `Pending insurance ${stats.pendingInsurance}, Revenue ${stats.dailyRevenue}`,
    });
    void router.push("/dashboard/ai-tools?tool=differential");
  };

  const sendRcmToAiTools = () => {
    saveAIToolsPrefill({
      version: 1,
      target: "denial",
      codingSummary: `Claim Scrub Queue ${rcmMetrics.claimScrubQueue}; Ready To Submit ${rcmMetrics.readyToSubmit}`,
      documentationSummary: `Denials At Risk ${rcmMetrics.denialsAtRisk}; Today POS Collections $${(rcmMetrics.todayCollectionsCents / 100).toFixed(2)}`,
    });
    void router.push("/dashboard/ai-tools?tool=denial");
  };

  const exportCloseoutCsv = () => {
    const paymentRows = posCloseout.payments.map((row) => [
      "payment",
      new Date(row.collectedAt).toISOString(),
      row.method,
      (row.amountCents / 100).toFixed(2),
      row.reference ?? "",
      row.collectedBy,
      String(row.chargeId),
      String(row.encounterId),
    ]);
    const refundRows = posCloseout.refunds.map((row) => [
      "refund",
      new Date(row.refundedAt).toISOString(),
      "refund",
      (row.amountCents / 100).toFixed(2),
      row.reason ?? "",
      row.refundedBy,
      String(row.chargeId),
      String(row.encounterId),
    ]);

    const rows = [
      ["type", "timestamp", "method", "amount", "reference_or_reason", "actor", "chargeId", "encounterId"],
      ...paymentRows,
      ...refundRows,
    ];

    const csvRows: Array<Array<string | number | null | undefined>> = rows;
    const csv = csvRows.map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pos-closeout-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("POS close-out CSV exported");
  };

  // Simulated payer mix for the analytics
  const payerMix = [
    { name: "Horizon BCBS", count: 42, color: "bg-blue-600" },
    { name: "United Healthcare", count: 25, color: "bg-emerald-600" },
    { name: "Medicare", count: 28, color: "bg-purple-600" },
    { name: "Aetna", count: 15, color: "bg-slate-400" },
    { name: "Self-Pay", count: 10, color: "bg-amber-500" },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-7xl space-y-8 bg-slate-50/30 p-4 text-slate-900 dark:bg-slate-950/30 dark:text-slate-100 md:p-8">
      
      {/* 1. ADMIN HEADER & TOGGLE */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-slate-100">
            Unit Ops <span className="text-blue-600">Command</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
            Hackensack Meridian Health | Emergency Dept 4B
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-[2rem] border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 px-3">
            {isPresentationMode ? <Lock className="h-3 w-3 text-blue-600" /> : <Eye className="h-3 w-3 text-slate-400" />}
            <span className={`text-[9px] font-black uppercase tracking-widest ${isPresentationMode ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}`}>
              {isPresentationMode ? "Privacy Mode Active" : "Internal Data View"}
            </span>
          </div>
          <button 
            onClick={() => setIsPresentationMode(!isPresentationMode)}
            className={`relative h-7 w-14 rounded-full transition-all duration-500 ${isPresentationMode ? 'bg-blue-600 shadow-inner' : 'bg-slate-200 dark:bg-slate-700'}`}
          >
            <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-500 ${isPresentationMode ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
        </div>
      </header>

      {/* NEW SURGE ALERT SYSTEM */}
       {stats && <SurgeAlertBanner stats={stats} />}

      {/* 2. OPERATIONAL KPI BAR */}
      <DashboardStats />

      <section className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Admin Launch Console</p>
            <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">Cross-Unit Command Shortcuts</h3>
          </div>
          <button
            onClick={() => setIsLaunchConsoleCollapsed((prev) => !prev)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
          >
            {isLaunchConsoleCollapsed ? "Show" : "Hide"}
          </button>
        </div>

        {isLaunchConsoleCollapsed ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-950/40">
            <span className="rounded-full bg-blue-600 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">Quick Launch</span>
            <span className="rounded-full bg-emerald-600 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">Snapshot Export</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Security, Audit, Staff, Revenue, Research, History</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Link href="/dashboard/admin/security">
                <Button className="w-full justify-start rounded-2xl border border-slate-200 bg-white py-6 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  Security Diagnostics
                </Button>
              </Link>
              <Link href="/dashboard/admin/audit">
                <Button className="w-full justify-start rounded-2xl border border-slate-200 bg-white py-6 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  Full Audit Logs
                </Button>
              </Link>
              <Link href="/dashboard/admin/staff">
                <Button className="w-full justify-start rounded-2xl border border-slate-200 bg-white py-6 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  Clinician Directory
                </Button>
              </Link>
              <Link href="/dashboard/admin/revenue">
                <Button className="w-full justify-start rounded-2xl border border-slate-200 bg-white py-6 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  Revenue Board
                </Button>
              </Link>
              <Link href="/dashboard/admin/revenue#pos-terminal">
                <Button className="w-full justify-start rounded-2xl border border-violet-200 bg-violet-50 py-6 text-[10px] font-black uppercase tracking-widest text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/50">
                  POS Terminal
                </Button>
              </Link>
              <Link href="/dashboard/admin/insurance">
                <Button className="w-full justify-start rounded-2xl border border-emerald-200 bg-emerald-50 py-6 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50">
                  Insurance Ops (Availity)
                </Button>
              </Link>
              <Link href="/dashboard/admin/research">
                <Button className="w-full justify-start rounded-2xl border border-blue-200 bg-blue-50 py-6 text-[10px] font-black uppercase tracking-widest text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/50">
                  Clinical Research Hub
                </Button>
              </Link>
              <Link href="/dashboard/admin/history">
                <Button className="w-full justify-start rounded-2xl border border-slate-200 bg-white py-6 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  Throughput History
                </Button>
              </Link>
              <Link href="/dashboard/admin/documents">
                <Button className="w-full justify-start rounded-2xl border border-slate-200 bg-white py-6 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  Document Policy
                </Button>
              </Link>
            </div>

            <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
              <CardContent className="space-y-4 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Executive Snapshot</p>
                <div className="space-y-1 text-sm font-semibold text-slate-600 dark:text-slate-200">
                  <p>Patients: {stats?.totalPatients ?? "--"}</p>
                  <p>High Acuity: {stats?.highAcuity ?? "--"}</p>
                  <p>Open Beds: {stats?.availableBeds ?? "--"}</p>
                </div>
                <Button
                  onClick={() => void handleCopySnapshot()}
                  className="w-full rounded-xl bg-blue-600 py-5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-700"
                >
                  Copy Snapshot Brief
                </Button>
                <Button
                  onClick={sendSnapshotToAiTools}
                  className="w-full rounded-xl border border-slate-200 bg-white py-5 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Send Snapshot To AI Tools
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Shift Governance</p>
            <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">Readiness Checklist</h3>
          </div>
          <Badge className={`${checklistProgress >= 75 ? "bg-emerald-600" : checklistProgress >= 50 ? "bg-amber-500" : "bg-blue-600"} border-none px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white`}>
            {checklistProgress}% Complete
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() => toggleChecklistItem("staffingConfirmed")}
            className={`rounded-2xl border px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${shiftChecklist.staffingConfirmed ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Staffing Confirmed
          </button>
          <button
            onClick={() => toggleChecklistItem("criticalCoverage")}
            className={`rounded-2xl border px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${shiftChecklist.criticalCoverage ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Critical Coverage Set
          </button>
          <button
            onClick={() => toggleChecklistItem("bedHuddle")}
            className={`rounded-2xl border px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${shiftChecklist.bedHuddle ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Bed Huddle Complete
          </button>
          <button
            onClick={() => toggleChecklistItem("escalationReview")}
            className={`rounded-2xl border px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${shiftChecklist.escalationReview ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Escalation Protocol Reviewed
          </button>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={resetChecklist}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Reset Checklist
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">AdvancedMD Style</p>
            <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">Revenue Cycle Command</h3>
          </div>
          <Badge className={`${rcmProgress >= 75 ? "bg-emerald-600" : rcmProgress >= 50 ? "bg-amber-500" : "bg-blue-600"} border-none px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white`}>
            RCM {rcmProgress}%
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Claim Scrub Queue</p>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{rcmMetrics.claimScrubQueue}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Denials At Risk</p>
            <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{rcmMetrics.denialsAtRisk}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Ready To Submit</p>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{rcmMetrics.readyToSubmit}</p>
          </div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
          <p className="text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">Today POS Collections</p>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300">${(rcmMetrics.todayCollectionsCents / 100).toFixed(2)}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() => toggleRcmChecklistItem("eligibilitySweep")}
            className={`rounded-2xl border px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${rcmChecklist.eligibilitySweep ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Eligibility Sweep
          </button>
          <button
            onClick={() => toggleRcmChecklistItem("chargeCaptureReview")}
            className={`rounded-2xl border px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${rcmChecklist.chargeCaptureReview ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Charge Capture Review
          </button>
          <button
            onClick={() => toggleRcmChecklistItem("denialWorkbench")}
            className={`rounded-2xl border px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${rcmChecklist.denialWorkbench ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Denial Workbench Review
          </button>
          <button
            onClick={() => toggleRcmChecklistItem("claimBatchReady")}
            className={`rounded-2xl border px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${rcmChecklist.claimBatchReady ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            Claim Batch Ready
          </button>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            onClick={() => void handleCopyRcmBrief()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-700"
          >
            Copy RCM Brief
          </Button>
          <Button
            onClick={sendRcmToAiTools}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Send RCM To AI Tools
          </Button>
          <Button
            onClick={exportCloseoutCsv}
            className="rounded-xl bg-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-800"
          >
            Export POS Close-Out CSV
          </Button>
          <Button
            onClick={resetRcmChecklist}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Reset RCM Checklist
          </Button>
        </div>
      </section>

      {/* 3. MAIN ANALYTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* REVENUE & PAYER ANALYTICS (2/3) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Revenue Chart */}
          {stats && <UnitRevenueSummary stats={stats} isPresentationMode={isPresentationMode} />}
          
          {/* Payer Mix Visual (Fixed Nesting) */}
          <RevenuePayerMix payerData={payerMix} />

          {/* Executive Workflow View */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className="h-1 w-6 rounded-full bg-orange-500" />
              <h3 className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-400 dark:text-slate-500">
                Executive Workflow View
              </h3>
            </div>
            <VolumeHeatmap />
          </section>
        </div>

        {/* REVENUE CYCLE TASKS (1/3) */}
        <aside className="space-y-6">
          <Card className="overflow-hidden rounded-[2.5rem] border-slate-900 bg-slate-900 text-white shadow-2xl">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Shift Collection Goal</p>
                <h2 className="text-4xl font-black italic">$2,500</h2>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                  <span>Current: ${stats?.dailyRevenue || 0}</span>
                  <span>{stats ? Math.round((stats.dailyRevenue / 2500) * 100) : 0}%</span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                  <div 
                    className="h-full bg-linear-to-r from-blue-500 to-emerald-400 transition-all duration-1000" 
                    style={{ width: `${stats ? Math.min(100, (stats.dailyRevenue / 2500) * 100) : 0}%` }} 
                  />
                </div>
              </div>

              <div className="pt-4 grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700/50">
                  <p className="text-[8px] font-black uppercase text-slate-500">Self-Pay</p>
                  <p className="text-sm font-bold text-slate-200">12 Patients</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700/50">
                  <p className="text-[8px] font-black uppercase text-slate-500">Unverified</p>
                  <p className="text-sm font-bold text-amber-400">{stats?.pendingInsurance || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QUICK ADMIN ACTIONS */}
          <div className="space-y-3">
            <h4 className="px-2 text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-400 dark:text-slate-500">Admin Actions</h4>
            
            {/* SHIFT HANDOFF (Safely rendered) */}
            {stats && <ShiftHandoffModal stats={stats} />}

            <Link href="/dashboard/admin/audit" className="w-full">
              <Button className="group w-full gap-3 rounded-2xl border border-slate-200 bg-white py-7 text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                Identity Audit Log (Full Unit)
              </Button>
            </Link>

            <Link href="/dashboard/admin/documents" className="w-full">
              <Button className="group w-full gap-3 rounded-2xl border border-slate-200 bg-white py-7 text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                <FolderCog className="h-4 w-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                Document Retention Policy
              </Button>
            </Link>

            <Button className="group w-full gap-3 rounded-2xl border border-slate-200 bg-white py-7 text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
              <Activity className="h-4 w-4 text-purple-600 group-hover:animate-pulse" />
              ESI vs. Payer Disparity Analysis
            </Button>
          </div>
        </aside>
      </div>

    </div>
  );
}