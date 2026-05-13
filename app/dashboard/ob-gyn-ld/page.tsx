"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import { normalizeActorRole } from "@/lib/auth/roles";
import { toast } from "sonner";
import jsPDF from "jspdf";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Baby,
  HeartPulse,
  ShieldAlert,
  Clock3,
  Activity,
  Stethoscope,
  Syringe,
  ClipboardCheck,
  AlertTriangle,
  Loader2,
  FileDown,
  ShieldPlus,
  Plus,
} from "lucide-react";

type StaffRole =
  | "ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "CCMA"
  | "SURGEON"
  | "ANESTHESIOLOGIST"
  | "PHARMACIST"
  | "RESPIRATORY_THERAPIST"
  | "RAD_TECH"
  | "SCRUB_TECH"
  | "UNIT_COORDINATOR"
  | "UNKNOWN";

type LaborStage = "Latent" | "Active" | "Transition" | "Second" | "Recovery";
type FetalCategory = "I" | "II" | "III";

type DashboardData = {
  laborBoard: Array<{
    encounterId: Id<"encounters">;
    patientId: Id<"patients">;
    patientName: string;
    location: string;
    status: string;
    chiefComplaint: string;
    snapshot: {
      gaWeeks: number;
      parity: string;
      stage: LaborStage;
      dilationCm: number;
      effacementPct: number;
      station: string;
      membranes: "Intact" | "ROM" | "AROM";
      contractionPattern: string;
      fetalCategory: FetalCategory;
      hemorrhageRisk: "LOW" | "MED" | "HIGH";
      gbs: "NEG" | "POS" | "UNKNOWN";
      pitocin: string;
      analgesia: string;
      etaMinutes: number;
      updatedAt: number;
      updatedBy: string;
      updatedByRole: StaffRole;
    } | null;
    postpartumTasks: Array<{
      _id: Id<"checklists">;
      item: string;
      completed: boolean;
      completedAt?: number;
      completedBy?: string;
    }>;
    triageWaitMinutes: number;
  }>;
  triageQueue: Array<{
    encounterId: Id<"encounters">;
    patientId: Id<"patients">;
    patientName: string;
    location: string;
    status: string;
    chiefComplaint: string;
    snapshot: {
      fetalCategory: FetalCategory;
    } | null;
    triageWaitMinutes: number;
  }>;
  postpartumTemplateTasks: string[];
  fetchedAt: number;
};

type SnapshotForm = {
  gaWeeks: number;
  parity: string;
  stage: LaborStage;
  dilationCm: number;
  effacementPct: number;
  station: string;
  membranes: "Intact" | "ROM" | "AROM";
  contractionPattern: string;
  fetalCategory: FetalCategory;
  hemorrhageRisk: "LOW" | "MED" | "HIGH";
  gbs: "NEG" | "POS" | "UNKNOWN";
  pitocin: string;
  analgesia: string;
  etaMinutes: number;
};

const DEFAULT_FORM: SnapshotForm = {
  gaWeeks: 39,
  parity: "G1P0",
  stage: "Latent",
  dilationCm: 2,
  effacementPct: 50,
  station: "-2",
  membranes: "Intact",
  contractionPattern: "q4-5 min",
  fetalCategory: "I",
  hemorrhageRisk: "LOW",
  gbs: "UNKNOWN",
  pitocin: "Off",
  analgesia: "None",
  etaMinutes: 240,
};

function fetalBadgeClass(category: FetalCategory) {
  if (category === "III") return "bg-red-100 text-red-700";
  if (category === "II") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function hemorrhageClass(risk: "LOW" | "MED" | "HIGH") {
  if (risk === "HIGH") return "bg-red-100 text-red-700";
  if (risk === "MED") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function inferMaternalStatus(complaint: string) {
  const normalized = complaint.toLowerCase();
  if (normalized.includes("bleeding") || normalized.includes("severe") || normalized.includes("syncope")) {
    return "Unstable" as const;
  }
  if (normalized.includes("headache") || normalized.includes("decreased fetal movement") || normalized.includes("pain")) {
    return "Watch" as const;
  }
  return "Stable" as const;
}

function inferFetalStatus(category: FetalCategory | undefined) {
  if (category === "III") return "Urgent" as const;
  if (category === "II") return "Needs Review" as const;
  return "Reassuring" as const;
}

function canEditLabor(actorRole: StaffRole) {
  const normalized = normalizeActorRole(actorRole) as StaffRole;
  // Allow known roles or UNKNOWN (backend will gate real access)
  return ["ADMIN", "NURSE", "DOCTOR", "SURGEON", "UNIT_COORDINATOR", "UNKNOWN"].includes(
    normalized
  );
}

function canEscalate(actorRole: StaffRole) {
  const normalized = normalizeActorRole(actorRole) as StaffRole;
  // Allow known roles or UNKNOWN (backend will gate real access)
  return ["ADMIN", "NURSE", "DOCTOR", "UNIT_COORDINATOR", "UNKNOWN"].includes(
    normalized
  );
}

function canManagePostpartum(actorRole: StaffRole) {
  const normalized = normalizeActorRole(actorRole) as StaffRole;
  // Allow known roles or UNKNOWN (backend will gate real access)
  return ["ADMIN", "NURSE", "DOCTOR", "CCMA", "UNIT_COORDINATOR", "UNKNOWN"].includes(
    normalized
  );
}

function buildDeliverySummaryPdf(row: DashboardData["laborBoard"][number]) {
  const doc = new jsPDF();
  const snapshot = row.snapshot;
  doc.setFontSize(16);
  doc.text("Labor and Delivery Summary", 14, 18);
  doc.setFontSize(11);
  doc.text(`Patient: ${row.patientName}`, 14, 30);
  doc.text(`Location: ${row.location}`, 14, 38);
  doc.text(`Encounter: ${String(row.encounterId)}`, 14, 46);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 54);

  if (snapshot) {
    doc.text(`Gestation: ${snapshot.gaWeeks}w | Parity: ${snapshot.parity}`, 14, 66);
    doc.text(`Stage: ${snapshot.stage} | Dilation: ${snapshot.dilationCm} cm`, 14, 74);
    doc.text(`Effacement: ${snapshot.effacementPct}% | Station: ${snapshot.station}`, 14, 82);
    doc.text(`FHR Category: ${snapshot.fetalCategory} | PPH Risk: ${snapshot.hemorrhageRisk}`, 14, 90);
    doc.text(`Membranes: ${snapshot.membranes} | GBS: ${snapshot.gbs}`, 14, 98);
    doc.text(`Contractions: ${snapshot.contractionPattern}`, 14, 106);
    doc.text(`Pitocin: ${snapshot.pitocin} | Analgesia: ${snapshot.analgesia}`, 14, 114);
    doc.text(`Delivery ETA: ${snapshot.etaMinutes === 0 ? "Delivered" : `${snapshot.etaMinutes} min`}`, 14, 122);
    doc.text(`Updated by ${snapshot.updatedBy} (${snapshot.updatedByRole})`, 14, 130);
  } else {
    doc.text("No labor snapshot documented yet.", 14, 66);
  }

  return doc;
}

function buildDischargePacketPdf(row: DashboardData["laborBoard"][number]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Mother-Baby Discharge Packet", 14, 18);
  doc.setFontSize(11);
  doc.text(`Patient: ${row.patientName}`, 14, 30);
  doc.text(`Location: ${row.location}`, 14, 38);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 46);

  const lines = [
    "1. Seek urgent care for heavy bleeding, fever, chest pain, severe headache, or dyspnea.",
    "2. Monitor blood pressure symptoms and postpartum warning signs.",
    "3. Follow newborn feeding plan and call lactation support as needed.",
    "4. Keep postpartum and pediatric follow-up appointments.",
    "5. Review contraception plan and mental health support resources.",
  ];

  lines.forEach((line, idx) => {
    doc.text(line, 14, 60 + idx * 12);
  });

  if (row.postpartumTasks.length > 0) {
    doc.text("Checklist Status:", 14, 130);
    row.postpartumTasks.forEach((task, idx) => {
      const state = task.completed ? "Complete" : "Pending";
      doc.text(`- ${task.item}: ${state}`, 16, 140 + idx * 8);
    });
  }

  return doc;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ObGynLaborDeliveryPage() {
  const { actorName, actorRole } = useResolvedActor();
  const dashboard = useQuery((api as any).obgyn.getDashboardData, {}) as DashboardData | undefined;
  const upsertLaborSnapshot = useMutation((api as any).obgyn.upsertLaborSnapshot);
  const ensurePostpartumChecklist = useMutation((api as any).obgyn.ensurePostpartumChecklist);
  const togglePostpartumTask = useMutation((api as any).obgyn.togglePostpartumTask);
  const triggerSafetyEscalation = useMutation((api as any).obgyn.triggerSafetyEscalation);
  const addPatientToLaborBoard = useMutation((api as any).obgyn.addPatientToLaborBoard);

  const generateUploadUrl = useMutation(api.chartDocuments.generateUploadUrl);
  const saveUploadedDocument = useMutation(api.chartDocuments.saveUploadedDocument);

  const [activeTab, setActiveTab] = useState("labor-board");
  const [selectedEncounterId, setSelectedEncounterId] = useState<Id<"encounters"> | "">("");
  const [form, setForm] = useState<SnapshotForm>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pendingBoard, setPendingBoard] = useState<Record<string, boolean>>({});

  const rows = dashboard?.laborBoard ?? [];
  const selectedRow = useMemo(
    () => rows.find((row) => row.encounterId === selectedEncounterId) ?? rows[0] ?? null,
    [rows, selectedEncounterId]
  );

  useEffect(() => {
    if (!selectedEncounterId && rows[0]) {
      setSelectedEncounterId(rows[0].encounterId);
    }
  }, [rows, selectedEncounterId]);

  useEffect(() => {
    if (!selectedRow?.snapshot) {
      setForm(DEFAULT_FORM);
      return;
    }

    setForm({
      gaWeeks: selectedRow.snapshot.gaWeeks,
      parity: selectedRow.snapshot.parity,
      stage: selectedRow.snapshot.stage,
      dilationCm: selectedRow.snapshot.dilationCm,
      effacementPct: selectedRow.snapshot.effacementPct,
      station: selectedRow.snapshot.station,
      membranes: selectedRow.snapshot.membranes,
      contractionPattern: selectedRow.snapshot.contractionPattern,
      fetalCategory: selectedRow.snapshot.fetalCategory,
      hemorrhageRisk: selectedRow.snapshot.hemorrhageRisk,
      gbs: selectedRow.snapshot.gbs,
      pitocin: selectedRow.snapshot.pitocin,
      analgesia: selectedRow.snapshot.analgesia,
      etaMinutes: selectedRow.snapshot.etaMinutes,
    });
  }, [selectedRow?.snapshot]);

  const stats = useMemo(() => {
    const fetalWatch = rows.filter((row) => row.snapshot?.fetalCategory !== "I").length;
    const hemorrhageHigh = rows.filter((row) => row.snapshot?.hemorrhageRisk === "HIGH").length;
    const triageUrgent = (dashboard?.triageQueue ?? []).filter((item) => {
      const maternal = inferMaternalStatus(item.chiefComplaint);
      const fetal = inferFetalStatus(item.snapshot?.fetalCategory);
      return maternal === "Unstable" || fetal === "Urgent";
    }).length;

    return {
      activeLabor: rows.length,
      fetalWatch,
      hemorrhageHigh,
      triageUrgent,
    };
  }, [dashboard?.triageQueue, rows]);

  const canEdit = canEditLabor(actorRole as StaffRole);
  const canEscalation = canEscalate(actorRole as StaffRole);
  const canPostpartum = canManagePostpartum(actorRole as StaffRole);

  const handleSaveSnapshot = async () => {
    if (!selectedRow) return;
    if (!canEdit) {
      toast.error("Your role cannot update labor tracking.");
      return;
    }

    setIsSaving(true);
    try {
      await upsertLaborSnapshot({
        encounterId: selectedRow.encounterId,
        ...form,
        actorName,
        actorRole,
      });
      toast.success("Labor board snapshot updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update labor snapshot.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnsurePostpartum = async () => {
    if (!selectedRow) return;
    if (!canPostpartum) {
      toast.error("Your role cannot create postpartum tasks.");
      return;
    }

    try {
      const result = await ensurePostpartumChecklist({
        encounterId: selectedRow.encounterId,
        actorName,
        actorRole,
      });
      if (result.created > 0) {
        toast.success(`Added ${result.created} postpartum checklist items.`);
      } else {
        toast.success("Postpartum checklist already seeded.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to seed postpartum checklist.";
      toast.error(message);
    }
  };

  const handleToggleTask = async (checklistId: Id<"checklists">, completed: boolean) => {
    if (!canPostpartum) {
      toast.error("Your role cannot update postpartum tasks.");
      return;
    }

    try {
      await togglePostpartumTask({ checklistId, completed, actorName, actorRole });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update task status.";
      toast.error(message);
    }
  };

  const handleEscalate = async (title: string, message: string, targetRole: "NURSE" | "DOCTOR" | "UNIT_COORDINATOR") => {
    if (!selectedRow) return;
    if (!canEscalation) {
      toast.error("Your role cannot trigger OB safety escalations.");
      return;
    }

    setIsEscalating(true);
    try {
      await triggerSafetyEscalation({
        encounterId: selectedRow.encounterId,
        actorName,
        actorRole,
        title,
        message,
        targetRole,
      });
      toast.success(`Escalation routed to ${targetRole}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to route escalation.";
      toast.error(message);
    } finally {
      setIsEscalating(false);
    }
  };

  const uploadPdfToChart = async (blob: Blob, row: DashboardData["laborBoard"][number], fileName: string, title: string, notes: string) => {
    const uploadUrl = await generateUploadUrl({});
    const uploadResult = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: blob,
    });

    if (!uploadResult.ok) throw new Error("Upload URL post failed");
    const json = (await uploadResult.json()) as { storageId?: Id<"_storage"> };
    if (!json.storageId) throw new Error("Storage id missing from upload response");

    await saveUploadedDocument({
      encounterId: row.encounterId,
      patientId: row.patientId,
      storageId: json.storageId,
      category: "LETTER",
      fileName,
      title,
      notes,
      contentType: "application/pdf",
      sizeBytes: blob.size,
      uploadedBy: actorName,
      uploadedByRole: actorRole,
    });
  };

  const handleAddToBoard = async (row: DashboardData["triageQueue"][number]) => {
    if (!canEdit) {
      toast.error("Your role cannot add patients to the labor board.");
      return;
    }

    const boardKey = String(row.encounterId);
    setPendingBoard((prev) => ({ ...prev, [boardKey]: true }));

    try {
      await addPatientToLaborBoard({
        encounterId: row.encounterId,
        ...DEFAULT_FORM,
        actorName,
        actorRole,
      });

      setSelectedEncounterId(row.encounterId);
      setActiveTab("labor-board");
      toast.success(`${row.patientName} added to the OB/L&D board.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to add patient to the labor board.";
      toast.error(message);
    } finally {
      setPendingBoard((prev) => ({ ...prev, [boardKey]: false }));
    }
  };

  const handleExport = async (kind: "delivery-summary" | "mother-baby-discharge") => {
    if (!selectedRow) return;
    setIsExporting(true);

    try {
      const nowLabel = new Date().toISOString().replace(/[:.]/g, "-");
      if (kind === "delivery-summary") {
        const pdf = buildDeliverySummaryPdf(selectedRow);
        const blob = pdf.output("blob");
        downloadBlob(blob, `delivery-summary-${nowLabel}.pdf`);
        await uploadPdfToChart(
          blob,
          selectedRow,
          `delivery-summary-${nowLabel}.pdf`,
          "Labor and Delivery Summary",
          "Auto-generated from OB/L&D dashboard"
        );
      } else {
        const pdf = buildDischargePacketPdf(selectedRow);
        const blob = pdf.output("blob");
        downloadBlob(blob, `mother-baby-discharge-${nowLabel}.pdf`);
        await uploadPdfToChart(
          blob,
          selectedRow,
          `mother-baby-discharge-${nowLabel}.pdf`,
          "Mother-Baby Discharge Packet",
          "Auto-generated postpartum discharge packet"
        );
      }
      toast.success("PDF downloaded and saved to chart documents.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export packet.";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  if (!dashboard) {
    return (
      <main className="min-h-screen px-6 py-24">
        <div className="mx-auto flex max-w-6xl items-center justify-center">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading OB/GYN Dashboard
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_40%),linear-gradient(to_bottom,rgba(248,250,252,0.98),rgba(241,245,249,0.94))] px-4 pb-12 pt-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="aurora-panel glass-panel rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-slate-400 dark:text-slate-500">
                Specialty Service Workspace
              </p>
              <h1 className="text-3xl font-black uppercase italic tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl lg:text-5xl">
                OB/GYN and Labor and Delivery EHR
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                Live Convex-backed workflows for OB triage, labor progression, maternal-fetal safety escalation,
                and postpartum discharge operations.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi title="Active Labor" value={String(stats.activeLabor)} icon={Baby} tone="rose" />
              <Kpi title="Fetal Watch" value={String(stats.fetalWatch)} icon={HeartPulse} tone="amber" />
              <Kpi title="High PPH Risk" value={String(stats.hemorrhageHigh)} icon={ShieldAlert} tone="red" />
              <Kpi title="Urgent Triage" value={String(stats.triageUrgent)} icon={Clock3} tone="sky" />
            </div>
          </div>
        </section>

        <Card className="rounded-2xl border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="space-y-4">
            <CardTitle className="text-base font-black uppercase tracking-[0.2em]">Active Encounter Context</CardTitle>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em]">Encounter</Label>
                <Select
                  value={selectedEncounterId ? String(selectedEncounterId) : ""}
                  onValueChange={(value) => setSelectedEncounterId(value as Id<"encounters">)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select active OB encounter" />
                  </SelectTrigger>
                  <SelectContent>
                    {rows.map((row) => (
                      <SelectItem key={String(row.encounterId)} value={String(row.encounterId)}>
                        {row.patientName} - {row.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-xs font-black uppercase tracking-[0.18em]"
                onClick={handleEnsurePostpartum}
                disabled={!selectedRow || !canPostpartum}
              >
                Seed Postpartum Tasks
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-xs font-black uppercase tracking-[0.18em]"
                onClick={() => handleExport("delivery-summary")}
                disabled={!selectedRow || isExporting}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Delivery Summary
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-xs font-black uppercase tracking-[0.18em]"
                onClick={() => handleExport("mother-baby-discharge")}
                disabled={!selectedRow || isExporting}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Mother-Baby Packet
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl bg-transparent p-0 md:grid-cols-4">
            <TabsTrigger value="labor-board" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] data-[state=active]:border-rose-300 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700 dark:border-slate-700 dark:bg-slate-900 dark:data-[state=active]:border-rose-700 dark:data-[state=active]:bg-rose-950/40">
              Labor Board
            </TabsTrigger>
            <TabsTrigger value="ob-triage" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] data-[state=active]:border-sky-300 data-[state=active]:bg-sky-50 data-[state=active]:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:data-[state=active]:border-sky-700 dark:data-[state=active]:bg-sky-950/40">
              OB Triage
            </TabsTrigger>
            <TabsTrigger value="safety-orders" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] data-[state=active]:border-amber-300 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 dark:border-slate-700 dark:bg-slate-900 dark:data-[state=active]:border-amber-700 dark:data-[state=active]:bg-amber-950/40">
              Safety and Orders
            </TabsTrigger>
            <TabsTrigger value="postpartum" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] data-[state=active]:border-emerald-300 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:data-[state=active]:border-emerald-700 dark:data-[state=active]:bg-emerald-950/40">
              Postpartum
            </TabsTrigger>
          </TabsList>

          <TabsContent value="labor-board" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              {rows.length === 0 ? (
                <Card className="rounded-2xl border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
                  <CardContent className="py-10 text-center text-sm text-slate-500">
                    No active OB/L&D encounters matched current triage flow.
                  </CardContent>
                </Card>
              ) : null}

              {rows.map((row) => (
                <Card key={String(row.encounterId)} className="rounded-2xl border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900">
                  <CardHeader className="space-y-3 pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{row.location}</p>
                        <CardTitle className="text-xl font-black uppercase tracking-tight">{row.patientName}</CardTitle>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{row.chiefComplaint}</p>
                      </div>
                      {row.snapshot ? (
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={fetalBadgeClass(row.snapshot.fetalCategory)}>FHR Cat {row.snapshot.fetalCategory}</Badge>
                          <Badge className={hemorrhageClass(row.snapshot.hemorrhageRisk)}>PPH {row.snapshot.hemorrhageRisk}</Badge>
                        </div>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700">No snapshot</Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 text-sm">
                    {row.snapshot ? (
                      <>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <StatChip label="Stage" value={row.snapshot.stage} />
                          <StatChip label="Cx" value={`${row.snapshot.dilationCm} cm`} />
                          <StatChip label="Eff" value={`${row.snapshot.effacementPct}%`} />
                          <StatChip label="Station" value={row.snapshot.station} />
                        </div>

                        <div className="grid gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <InfoRow icon={Activity} label="Contractions" value={row.snapshot.contractionPattern} />
                          <InfoRow icon={Stethoscope} label="Membranes" value={row.snapshot.membranes} />
                          <InfoRow icon={Syringe} label="Pitocin" value={row.snapshot.pitocin} />
                          <InfoRow icon={HeartPulse} label="Analgesia" value={row.snapshot.analgesia} />
                          <InfoRow icon={ClipboardCheck} label="GBS" value={row.snapshot.gbs} />
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                          Delivery ETA: {row.snapshot.etaMinutes === 0 ? "Delivered" : `~${row.snapshot.etaMinutes} min`}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                        Snapshot not documented yet. Select this encounter and save labor tracking data below.
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="rounded-2xl border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-lg font-black uppercase tracking-tight">Labor Snapshot Editor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Gestation (weeks)">
                    <Input type="number" value={form.gaWeeks} onChange={(e) => setForm((p) => ({ ...p, gaWeeks: Number(e.target.value) }))} />
                  </Field>
                  <Field label="Parity">
                    <Input value={form.parity} onChange={(e) => setForm((p) => ({ ...p, parity: e.target.value }))} />
                  </Field>
                  <Field label="Labor stage">
                    <Select value={form.stage} onValueChange={(value) => setForm((p) => ({ ...p, stage: value as LaborStage }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Latent">Latent</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Transition">Transition</SelectItem>
                        <SelectItem value="Second">Second</SelectItem>
                        <SelectItem value="Recovery">Recovery</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Dilation (cm)">
                    <Input type="number" value={form.dilationCm} onChange={(e) => setForm((p) => ({ ...p, dilationCm: Number(e.target.value) }))} />
                  </Field>
                  <Field label="Effacement (%)">
                    <Input type="number" value={form.effacementPct} onChange={(e) => setForm((p) => ({ ...p, effacementPct: Number(e.target.value) }))} />
                  </Field>
                  <Field label="Station">
                    <Input value={form.station} onChange={(e) => setForm((p) => ({ ...p, station: e.target.value }))} />
                  </Field>
                  <Field label="Membranes">
                    <Select value={form.membranes} onValueChange={(value) => setForm((p) => ({ ...p, membranes: value as "Intact" | "ROM" | "AROM" }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Intact">Intact</SelectItem>
                        <SelectItem value="ROM">ROM</SelectItem>
                        <SelectItem value="AROM">AROM</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Fetal category">
                    <Select value={form.fetalCategory} onValueChange={(value) => setForm((p) => ({ ...p, fetalCategory: value as FetalCategory }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="I">I</SelectItem>
                        <SelectItem value="II">II</SelectItem>
                        <SelectItem value="III">III</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="PPH risk">
                    <Select value={form.hemorrhageRisk} onValueChange={(value) => setForm((p) => ({ ...p, hemorrhageRisk: value as "LOW" | "MED" | "HIGH" }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">LOW</SelectItem>
                        <SelectItem value="MED">MED</SelectItem>
                        <SelectItem value="HIGH">HIGH</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="GBS">
                    <Select value={form.gbs} onValueChange={(value) => setForm((p) => ({ ...p, gbs: value as "NEG" | "POS" | "UNKNOWN" }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NEG">NEG</SelectItem>
                        <SelectItem value="POS">POS</SelectItem>
                        <SelectItem value="UNKNOWN">UNKNOWN</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="ETA (minutes)">
                    <Input type="number" value={form.etaMinutes} onChange={(e) => setForm((p) => ({ ...p, etaMinutes: Number(e.target.value) }))} />
                  </Field>
                  <Field label="Pitocin">
                    <Input value={form.pitocin} onChange={(e) => setForm((p) => ({ ...p, pitocin: e.target.value }))} />
                  </Field>
                  <Field label="Analgesia">
                    <Input value={form.analgesia} onChange={(e) => setForm((p) => ({ ...p, analgesia: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Contraction pattern">
                  <Input value={form.contractionPattern} onChange={(e) => setForm((p) => ({ ...p, contractionPattern: e.target.value }))} />
                </Field>
                <Button
                  type="button"
                  onClick={handleSaveSnapshot}
                  disabled={!selectedRow || !canEdit || isSaving}
                  className="rounded-xl bg-rose-600 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-rose-700"
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Labor Snapshot
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ob-triage" className="space-y-4">
            <Card className="rounded-2xl border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-xl font-black uppercase tracking-tight">OB Triage Queue</CardTitle>
              </CardHeader>
              <CardContent>
                {(dashboard.triageQueue ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-950">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      No OB/L&D patients in triage queue.
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Create a new patient encounter with a chief complaint containing: pregnancy, labor, contractions, delivery, vaginal bleeding, rupture of membranes, preeclampsia, etc.
                    </p>
                    <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Role: {actorRole} | canEdit: {canEdit ? "✓" : "✗"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-215 text-left text-sm">
                      <thead className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="px-3 py-2">Patient</th>
                          <th className="px-3 py-2">Complaint</th>
                          <th className="px-3 py-2">Maternal</th>
                          <th className="px-3 py-2">Fetal</th>
                          <th className="px-3 py-2">Wait</th>
                          <th className="px-3 py-2">Unit</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(dashboard.triageQueue ?? []).map((item) => {
                        const maternal = inferMaternalStatus(item.chiefComplaint);
                        const fetal = inferFetalStatus(item.snapshot?.fetalCategory);
                        const maternalClass =
                          maternal === "Unstable"
                            ? "bg-red-100 text-red-700"
                            : maternal === "Watch"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700";
                        const fetalClass =
                          fetal === "Urgent"
                            ? "bg-red-100 text-red-700"
                            : fetal === "Needs Review"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700";

                        return (
                          <tr key={String(item.encounterId)} className="border-b border-slate-100 dark:border-slate-800/70">
                            <td className="px-3 py-3 font-bold text-slate-900 dark:text-slate-100">{item.patientName}</td>
                            <td className="max-w-60 px-3 py-3">{item.chiefComplaint}</td>
                            <td className="px-3 py-3"><Badge className={maternalClass}>{maternal}</Badge></td>
                            <td className="px-3 py-3"><Badge className={fetalClass}>{fetal}</Badge></td>
                            <td className="px-3 py-3 font-semibold">{item.triageWaitMinutes} min</td>
                            <td className="px-3 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">{item.location}</td>
                            <td className="px-3 py-3">
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 rounded-lg bg-rose-600 text-[10px] font-black uppercase tracking-[0.18em] text-white hover:bg-rose-700"
                                disabled={!canEdit || pendingBoard[String(item.encounterId)]}
                                onClick={() => void handleAddToBoard(item)}
                              >
                                {pendingBoard[String(item.encounterId)] ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                {pendingBoard[String(item.encounterId)] ? "Adding" : "Add to Board"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="safety-orders" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="rounded-2xl border-slate-200 bg-white/95 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-xl font-black uppercase tracking-tight">Rapid Safety Actions (Role-Gated)</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Button
                    type="button"
                    className="justify-start rounded-xl bg-red-600 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-red-700"
                    disabled={!selectedRow || !canEscalation || isEscalating}
                    onClick={() =>
                      handleEscalate(
                        "Category III fetal tracing escalation",
                        "Immediate bedside provider and charge RN response required.",
                        "DOCTOR"
                      )
                    }
                  >
                    <ShieldPlus className="mr-2 h-4 w-4" /> Trigger Category III Response
                  </Button>

                  <Button
                    type="button"
                    className="justify-start rounded-xl bg-amber-600 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-amber-700"
                    disabled={!selectedRow || !canEscalation || isEscalating}
                    onClick={() =>
                      handleEscalate(
                        "Postpartum hemorrhage pathway activation",
                        "PPH medication cart and transfusion prep initiated.",
                        "NURSE"
                      )
                    }
                  >
                    <ShieldPlus className="mr-2 h-4 w-4" /> Activate PPH Bundle
                  </Button>

                  <Button
                    type="button"
                    className="justify-start rounded-xl bg-sky-600 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-sky-700"
                    disabled={!selectedRow || !canEscalation || isEscalating}
                    onClick={() =>
                      handleEscalate(
                        "Shoulder dystocia emergency huddle",
                        "Call unit coordinator and bedside support for timed shoulder dystocia protocol.",
                        "UNIT_COORDINATOR"
                      )
                    }
                  >
                    <ShieldPlus className="mr-2 h-4 w-4" /> Shoulder Dystocia Huddle
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="h-5 w-5" />
                    Audit and Routing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="rounded-xl border border-rose-200 bg-white/70 p-3 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                    Every escalation writes routing records and intervention audit events in Convex.
                  </p>
                  <p className="rounded-xl border border-rose-200 bg-white/70 p-3 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                    Role access: {actorRole}. Escalation buttons only execute for approved clinical roles.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="postpartum" className="space-y-4">
            <Card className="rounded-2xl border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-black uppercase tracking-tight">Postpartum Readiness Checklist</CardTitle>
                <Badge className="bg-emerald-100 text-emerald-700">
                  {(selectedRow?.postpartumTasks ?? []).filter((task) => task.completed).length}/
                  {(selectedRow?.postpartumTasks ?? []).length} complete
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {(selectedRow?.postpartumTasks ?? []).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    No postpartum tasks for this encounter yet. Use "Seed Postpartum Tasks" above.
                  </p>
                ) : null}

                {(selectedRow?.postpartumTasks ?? []).map((task) => {
                  const complete = Boolean(task.completed);
                  return (
                    <button
                      key={String(task._id)}
                      type="button"
                      onClick={() => handleToggleTask(task._id, !complete)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                        complete
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                      }`}
                      disabled={!canPostpartum}
                    >
                      <span className="text-sm font-semibold">{task.item}</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                        {complete ? "Done" : "Pending"}
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function Kpi({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: typeof Baby;
  tone: "rose" | "amber" | "red" | "sky";
}) {
  const toneClasses: Record<typeof tone, string> = {
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
  };

  return (
    <div className={`rounded-2xl border p-3 ${toneClasses[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">{title}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      <span className="inline-flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4 text-slate-400" />
        {label}
      </span>
      <span className="font-bold text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  );
}
