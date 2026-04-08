"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, FileCheck2, HandCoins, RefreshCcw } from "lucide-react";

type ClaimStatus = "draft" | "scrub" | "submitted" | "accepted" | "denied" | "paid";

type EligibilityRow = {
  encounterId: Id<"encounters">;
  patientName: string;
  mrn: string;
  payer: string;
  hasInsurance: boolean;
  status: "pending" | "verified" | "denied";
  authStatus: "not_started" | "requested" | "approved";
  authorizationRequired: boolean;
  chiefComplaint: string;
  acuity: number;
};

type ClaimCandidateRow = {
  encounterId: Id<"encounters">;
  patientName: string;
  payer: string;
  totalChargeCents: number;
  openBalanceCents: number;
  hasClaim: boolean;
};

type ClaimQueueRow = {
  claimId: Id<"insuranceClaims">;
  patientName: string;
  payer: string;
  status: ClaimStatus;
  totalChargeCents: number;
  allowedAmountCents?: number;
  denialReason?: string;
  payerControlNumber?: string;
  updatedAt: number;
  denialRisk: number;
};

export default function InsuranceOperationsPage() {
  const { actorName } = useResolvedActor();
  const workbench = useQuery(api.insurance.getPortalWorkbench, {});

  const verifyEncounter = useMutation(api.insurance.verifyInsuranceByEncounter);
  const createInsuranceRecord = useMutation(api.insurance.createInsuranceRecordForEncounter);
  const requestPriorAuth = useMutation(api.insurance.requestPriorAuthorization);
  const createClaimDraft = useMutation(api.insurance.createClaimDraft);
  const submitClaim = useMutation(api.insurance.submitClaim);
  const postClaimResponse = useMutation(api.insurance.postClaimResponse);
  const markClaimPaid = useMutation(api.insurance.markClaimPaid);

  const [submittingClaimId, setSubmittingClaimId] = useState<string | null>(null);
  const [creatingEncounterId, setCreatingEncounterId] = useState<string | null>(null);
  const [creatingCoverageEncounterId, setCreatingCoverageEncounterId] = useState<string | null>(null);

  const eligibilityQueue = (workbench?.eligibilityQueue ?? []) as EligibilityRow[];
  const claimsQueue = (workbench?.claimsQueue ?? []) as ClaimQueueRow[];
  const claimCandidates = workbench?.claimCandidates as ClaimCandidateRow[] | undefined;

  const sortedCandidates = useMemo(() => {
    if (!claimCandidates || claimCandidates.length === 0) return [];
    return [...claimCandidates].sort((a, b) => b.openBalanceCents - a.openBalanceCents);
  }, [claimCandidates]);

  const handleEligibilityVerify = async (encounterId: Id<"encounters">) => {
    try {
      const result = await verifyEncounter({ encounterId });
      if (result === "Verified") {
        toast.success("Eligibility verified");
      } else if (result === "No Insurance Record") {
        toast.info("No insurance record found for this patient");
      } else {
        toast.error("Eligibility denied");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    }
  };

  const handleRequestAuth = async (encounterId: Id<"encounters">) => {
    try {
      await requestPriorAuth({ encounterId });
      toast.success("Prior authorization request queued");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to request prior auth");
    }
  };

  const handleCreateInsuranceRecord = async (encounterId: Id<"encounters">) => {
    setCreatingCoverageEncounterId(encounterId);
    try {
      const result = await createInsuranceRecord({ encounterId });
      if (result.created) {
        toast.success("Insurance profile created");
      } else {
        toast.info("Insurance profile already exists");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create insurance profile");
    } finally {
      setCreatingCoverageEncounterId(null);
    }
  };

  const handleCreateClaim = async (encounterId: Id<"encounters">) => {
    setCreatingEncounterId(encounterId);
    try {
      await createClaimDraft({ encounterId, actor: actorName });
      toast.success("Claim moved into scrub workbench");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create claim draft");
    } finally {
      setCreatingEncounterId(null);
    }
  };

  const handleSubmitClaim = async (claimId: Id<"insuranceClaims">) => {
    setSubmittingClaimId(claimId);
    try {
      await submitClaim({ claimId, actor: actorName });
      toast.success("Claim submitted to clearinghouse");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit claim");
    } finally {
      setSubmittingClaimId(null);
    }
  };

  const handleAcceptClaim = async (claimId: Id<"insuranceClaims">, totalChargeCents: number) => {
    try {
      await postClaimResponse({
        claimId,
        actor: actorName,
        outcome: "accepted",
        allowedAmountCents: Math.round(totalChargeCents * 0.78),
        payerControlNumber: `PCN-${Date.now().toString().slice(-6)}`,
      });
      toast.success("Payer acceptance posted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to post payer response");
    }
  };

  const handleDenyClaim = async (claimId: Id<"insuranceClaims">) => {
    try {
      await postClaimResponse({
        claimId,
        actor: actorName,
        outcome: "denied",
        denialReason: "CO-16: Missing/incomplete claim data",
      });
      toast.success("Claim moved to denial workbench");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to post denial");
    }
  };

  const handleMarkPaid = async (claimId: Id<"insuranceClaims">) => {
    try {
      await markClaimPaid({ claimId, actor: actorName });
      toast.success("Claim marked paid");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to mark claim paid");
    }
  };

  return (
    <div className="space-y-8 text-slate-900 dark:text-slate-100">
      <section className="rounded-[2rem] border border-emerald-200 bg-linear-to-r from-emerald-50 via-white to-cyan-50 p-6 dark:border-emerald-800 dark:from-emerald-950/30 dark:via-slate-900 dark:to-cyan-950/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-300">Insurance Operations Hub</p>
        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-4xl">Availity-Style Eligibility + Claims</h1>
        <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          Run eligibility checks, manage prior auth, scrub claims, and reconcile payer responses in one workflow.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Pending Eligibility" value={String(workbench?.metrics.pendingEligibility ?? 0)} tone="amber" />
        <MetricCard label="Denied Eligibility" value={String(workbench?.metrics.deniedEligibility ?? 0)} tone="red" />
        <MetricCard label="Claims In Scrub" value={String(workbench?.metrics.claimsInScrub ?? 0)} tone="blue" />
        <MetricCard label="Submitted Claims" value={String(workbench?.metrics.submittedClaims ?? 0)} tone="cyan" />
        <MetricCard label="Denied Claims" value={String(workbench?.metrics.deniedClaims ?? 0)} tone="violet" />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card className="rounded-[2rem] border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Eligibility Queue</p>
              <h2 className="text-lg font-black tracking-tight">270/271 Verification Workbench</h2>
            </div>
            <RefreshCcw className="h-4 w-4 text-slate-400" />
          </div>

          <div className="space-y-3">
            {eligibilityQueue.slice(0, 12).map((row) => (
              <div key={row.encounterId} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100">{row.patientName}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      MRN {row.mrn} • {row.payer} • Acuity {row.acuity}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-300">{row.chiefComplaint}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={row.status} />
                    <AuthBadge authStatus={row.authStatus} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() => void handleEligibilityVerify(row.encounterId)}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500"
                  >
                    <ShieldCheck className="mr-1 h-3 w-3" /> Verify
                  </Button>
                  {!row.hasInsurance ? (
                    <Button
                      onClick={() => void handleCreateInsuranceRecord(row.encounterId)}
                      disabled={creatingCoverageEncounterId === row.encounterId}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      {creatingCoverageEncounterId === row.encounterId ? "Creating..." : "Create Insurance Record"}
                    </Button>
                  ) : null}
                  {row.authorizationRequired ? (
                    <Button
                      onClick={() => void handleRequestAuth(row.encounterId)}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      Request Prior Auth
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-[2rem] border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Claim Intake</p>
            <h2 className="text-lg font-black tracking-tight">Create Claims From Charge Queue</h2>
          </div>
          <div className="space-y-3">
            {sortedCandidates.slice(0, 10).map((row) => (
              <div key={row.encounterId} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100">{row.patientName}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      {row.payer} • Open ${(row.openBalanceCents / 100).toFixed(2)}
                    </p>
                  </div>
                  <Badge className="border-none bg-slate-700 text-[10px] font-black uppercase tracking-widest text-white">
                    Total ${(row.totalChargeCents / 100).toFixed(2)}
                  </Badge>
                </div>
                <Button
                  onClick={() => void handleCreateClaim(row.encounterId)}
                  disabled={Boolean(row.hasClaim) || creatingEncounterId === row.encounterId}
                  className="mt-3 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <FileCheck2 className="mr-1 h-3 w-3" />
                  {row.hasClaim ? "Claim Exists" : creatingEncounterId === row.encounterId ? "Creating..." : "Create Claim Draft"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Claims Workbench</p>
          <h2 className="text-2xl font-black tracking-tight">277CA / ERA Response Management</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {claimsQueue.slice(0, 20).map((claim) => (
            <Card key={claim.claimId} className="rounded-2xl border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">{claim.patientName}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {claim.payer} • Updated {new Date(claim.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ClaimStatusBadge status={claim.status} />
                  <Badge className="border-none bg-amber-500 text-[10px] font-black uppercase tracking-widest text-white">
                    Risk {claim.denialRisk}%
                  </Badge>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <p>Total ${(claim.totalChargeCents / 100).toFixed(2)}</p>
                <p>Allowed {claim.allowedAmountCents ? `$${(claim.allowedAmountCents / 100).toFixed(2)}` : "--"}</p>
                <p>PCN {claim.payerControlNumber ?? "--"}</p>
                <p>Reason {claim.denialReason ?? "--"}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => void handleSubmitClaim(claim.claimId)}
                  disabled={submittingClaimId === claim.claimId || claim.status === "submitted" || claim.status === "paid"}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {submittingClaimId === claim.claimId ? "Submitting..." : "Submit Claim"}
                </Button>
                <Button
                  onClick={() => void handleAcceptClaim(claim.claimId, claim.totalChargeCents)}
                  disabled={claim.status === "paid"}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-500"
                >
                  Post Accept
                </Button>
                <Button
                  onClick={() => void handleDenyClaim(claim.claimId)}
                  disabled={claim.status === "paid"}
                  className="rounded-xl bg-rose-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-rose-500"
                >
                  <ShieldAlert className="mr-1 h-3 w-3" /> Post Denial
                </Button>
                <Button
                  onClick={() => void handleMarkPaid(claim.claimId)}
                  disabled={claim.status !== "accepted" && claim.status !== "submitted"}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                >
                  <HandCoins className="mr-1 h-3 w-3" /> Mark Paid
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "amber" | "red" | "blue" | "cyan" | "violet" }) {
  const toneClass: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    red: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
    violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  };

  return (
    <Card className={`rounded-2xl border p-4 ${toneClass[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
    </Card>
  );
}

function StatusBadge({ status }: { status: "pending" | "verified" | "denied" }) {
  if (status === "verified") {
    return <Badge className="border-none bg-emerald-600 text-[10px] font-black uppercase tracking-widest text-white">Verified</Badge>;
  }
  if (status === "denied") {
    return <Badge className="border-none bg-rose-600 text-[10px] font-black uppercase tracking-widest text-white">Denied</Badge>;
  }
  return <Badge className="border-none bg-amber-500 text-[10px] font-black uppercase tracking-widest text-white">Pending</Badge>;
}

function AuthBadge({ authStatus }: { authStatus: "not_started" | "requested" | "approved" }) {
  if (authStatus === "approved") {
    return <Badge className="border-none bg-cyan-600 text-[10px] font-black uppercase tracking-widest text-white">Auth Approved</Badge>;
  }
  if (authStatus === "requested") {
    return <Badge className="border-none bg-indigo-600 text-[10px] font-black uppercase tracking-widest text-white">Auth Requested</Badge>;
  }
  return <Badge className="border-none bg-slate-600 text-[10px] font-black uppercase tracking-widest text-white">No Auth</Badge>;
}

function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const styles: Record<ClaimStatus, string> = {
    draft: "bg-slate-600",
    scrub: "bg-blue-600",
    submitted: "bg-indigo-600",
    accepted: "bg-emerald-600",
    denied: "bg-rose-600",
    paid: "bg-violet-600",
  };

  return (
    <Badge className={`border-none text-[10px] font-black uppercase tracking-widest text-white ${styles[status]}`}>
      {status}
    </Badge>
  );
}
