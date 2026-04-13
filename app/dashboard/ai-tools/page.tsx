"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpenCheck, BrainCircuit, ClipboardCheck, Copy, ShieldAlert, Sparkles, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  buildDenialRiskDraft,
  buildDifferentialDraft,
  buildHandoffCompression,
  buildOrderSetSuggestions,
  buildPatientEducationDraft,
  clearAIToolsPrefill,
  readAIToolsPrefill,
} from "@/lib/helpers/aiTools";
import { toast } from "sonner";

export default function AIToolsPage() {
  const searchParams = useSearchParams();
  const [prefill] = useState(() => readAIToolsPrefill());

  const [chiefComplaint, setChiefComplaint] = useState(prefill?.chiefComplaint ?? "");
  const [vitalsSummary, setVitalsSummary] = useState(prefill?.vitalsSummary ?? "");
  const [clinicalContext, setClinicalContext] = useState(prefill?.clinicalContext ?? "");

  const [handoffSource, setHandoffSource] = useState(prefill?.handoffSource ?? "");

  const [codingSummary, setCodingSummary] = useState(prefill?.codingSummary ?? "");
  const [documentationSummary, setDocumentationSummary] = useState(prefill?.documentationSummary ?? "");
  const [orderComplaint, setOrderComplaint] = useState("");
  const [orderAcuity, setOrderAcuity] = useState("ESI 3");
  const [orderRisks, setOrderRisks] = useState("");
  const [educationDx, setEducationDx] = useState("");
  const [educationPlan, setEducationPlan] = useState("");
  const [literacyLevel, setLiteracyLevel] = useState<"standard" | "simple">("standard");

  useEffect(() => {
    clearAIToolsPrefill();
  }, []);

  useEffect(() => {
    const requestedTool = searchParams.get("tool");
    if (!requestedTool) return;
    const element = document.getElementById(`ai-tool-${requestedTool}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [searchParams]);

  const differentialDraft = useMemo(
    () =>
      buildDifferentialDraft({
        chiefComplaint,
        vitalsSummary,
        context: clinicalContext,
      }),
    [chiefComplaint, vitalsSummary, clinicalContext]
  );

  const handoffDraft = useMemo(() => buildHandoffCompression(handoffSource), [handoffSource]);

  const denialRisk = useMemo(
    () =>
      buildDenialRiskDraft({
        codingSummary,
        documentationSummary,
      }),
    [codingSummary, documentationSummary]
  );

  const orderSetDraft = useMemo(
    () =>
      buildOrderSetSuggestions({
        chiefComplaint: orderComplaint,
        acuityLabel: orderAcuity,
        knownRisks: orderRisks,
      }),
    [orderAcuity, orderComplaint, orderRisks]
  );

  const educationDraft = useMemo(
    () =>
      buildPatientEducationDraft({
        diagnosis: educationDx,
        treatmentPlan: educationPlan,
        literacyLevel,
      }),
    [educationDx, educationPlan, literacyLevel]
  );

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl space-y-6 p-4 text-slate-900 md:p-8 dark:text-slate-100">
      <header className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Intelligence Layer</p>
        <h1 className="text-4xl font-black italic tracking-tight">AI <span className="text-blue-600">Tools Hub</span></h1>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Differential support, handoff compression, and denial risk pre-check in one workspace.
        </p>
        <div>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/dashboard/productivity">Open Clinical Productivity Suite</Link>
          </Button>
        </div>
        {prefill ? (
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
            Prefill loaded from cross-dashboard handoff.
          </p>
        ) : null}
      </header>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card id="ai-tool-differential" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-black uppercase tracking-widest">Differential Builder</h2>
          </div>
          <input
            value={chiefComplaint}
            onChange={(event) => setChiefComplaint(event.target.value.slice(0, 120))}
            placeholder="Chief complaint"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            value={vitalsSummary}
            onChange={(event) => setVitalsSummary(event.target.value.slice(0, 180))}
            placeholder="Vitals summary"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <textarea
            value={clinicalContext}
            onChange={(event) => setClinicalContext(event.target.value.slice(0, 600))}
            rows={4}
            placeholder="Additional context"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] font-semibold text-slate-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-slate-200">
            {differentialDraft}
          </pre>
          <Button onClick={() => void copyText(differentialDraft, "Differential draft")} className="w-full bg-blue-600 text-white hover:bg-blue-500">
            <Copy className="mr-1 h-4 w-4" /> Copy Differential
          </Button>
        </Card>

        <Card id="ai-tool-handoff" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-black uppercase tracking-widest">Handoff Compressor</h2>
          </div>
          <textarea
            value={handoffSource}
            onChange={(event) => setHandoffSource(event.target.value.slice(0, 2000))}
            rows={9}
            placeholder="Paste raw sign-out notes or timeline text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] font-semibold text-slate-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-slate-200">
            {handoffDraft}
          </pre>
          <Button onClick={() => void copyText(handoffDraft, "Handoff summary")} className="w-full bg-blue-600 text-white hover:bg-blue-500">
            <ClipboardCheck className="mr-1 h-4 w-4" /> Copy Handoff
          </Button>
        </Card>

        <Card id="ai-tool-denial" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-black uppercase tracking-widest">Denial Risk Copilot</h2>
          </div>
          <textarea
            value={codingSummary}
            onChange={(event) => setCodingSummary(event.target.value.slice(0, 1000))}
            rows={4}
            placeholder="Coding summary or claim notes"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <textarea
            value={documentationSummary}
            onChange={(event) => setDocumentationSummary(event.target.value.slice(0, 1000))}
            rows={4}
            placeholder="Documentation summary"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">Risk Score</p>
            <p className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-100">{denialRisk.score}%</p>
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">{denialRisk.band} Risk</p>
            <div className="mt-2 space-y-1">
              {denialRisk.risks.map((risk) => (
                <p key={risk} className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">- {risk}</p>
              ))}
            </div>
            <div className="mt-2 space-y-1">
              {denialRisk.actions.map((action) => (
                <p key={action} className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">- {action}</p>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card id="ai-tool-orders" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-black uppercase tracking-widest">Order Set Copilot</h2>
          </div>
          <input
            value={orderComplaint}
            onChange={(event) => setOrderComplaint(event.target.value.slice(0, 120))}
            placeholder="Chief complaint"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            value={orderAcuity}
            onChange={(event) => setOrderAcuity(event.target.value.slice(0, 40))}
            placeholder="Acuity label"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <textarea
            value={orderRisks}
            onChange={(event) => setOrderRisks(event.target.value.slice(0, 400))}
            rows={3}
            placeholder="Known risks or contraindication context"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] font-semibold text-slate-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-slate-200">
            {orderSetDraft}
          </pre>
          <Button onClick={() => void copyText(orderSetDraft, "Order set draft")} className="w-full bg-blue-600 text-white hover:bg-blue-500">
            <Copy className="mr-1 h-4 w-4" /> Copy Order Set Draft
          </Button>
        </Card>

        <Card id="ai-tool-education" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-black uppercase tracking-widest">Patient Education Generator</h2>
          </div>
          <input
            value={educationDx}
            onChange={(event) => setEducationDx(event.target.value.slice(0, 120))}
            placeholder="Diagnosis"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <textarea
            value={educationPlan}
            onChange={(event) => setEducationPlan(event.target.value.slice(0, 500))}
            rows={3}
            placeholder="Treatment plan"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLiteracyLevel("standard")}
              className={`rounded-lg border px-2 py-2 text-[10px] font-black uppercase tracking-widest ${
                literacyLevel === "standard"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setLiteracyLevel("simple")}
              className={`rounded-lg border px-2 py-2 text-[10px] font-black uppercase tracking-widest ${
                literacyLevel === "simple"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              }`}
            >
              Plain Language
            </button>
          </div>
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] font-semibold text-slate-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-slate-200">
            {educationDraft}
          </pre>
          <Button onClick={() => void copyText(educationDraft, "Education draft")} className="w-full bg-blue-600 text-white hover:bg-blue-500">
            <Copy className="mr-1 h-4 w-4" /> Copy Education Draft
          </Button>
        </Card>
      </section>
    </main>
  );
}
