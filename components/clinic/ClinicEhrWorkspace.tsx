"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import TemplateManager from "./TemplateManager";
import PatientInfoTab from "@/components/patient/PatientInfoTab";
import VitalsTrend from "@/components/VitalsTrend";
import MAR from "@/components/MAR";
import MedicationHistory from "@/components/MedicationHistory";
import OrderEntry from "@/components/clinical/OrderEntry";
import LabResults from "@/components/LabResults";
import ImagingResults from "@/components/ImagingResults";
import ClinicalNotes from "@/components/ClinicalNotes";
import ChartDocumentsPanel from "@/components/clinical/ChartDocumentsPanel";
import BillingDashboard from "@/components/admin/BillingDashboard";
import PortalMessenger from "@/components/admin/PortalMessenger";
import { useStaffSession } from "@/lib/hooks/useStaffSession";
import { normalizeActorRole, type ActorRole } from "@/lib/auth/roles";

type ChartMenuKey =
  | "dashboard"
  | "demographics"
  | "history"
  | "vitals"
  | "allergies"
  | "medications"
  | "problems"
  | "orders"
  | "results"
  | "notes"
  | "documents"
  | "coding"
  | "tasks"
  | "messages";

const EHR_MENU: Array<{ key: ChartMenuKey; label: string }> = [
  { key: "dashboard", label: "Chart Dashboard" },
  { key: "demographics", label: "Patient Demographics" },
  { key: "history", label: "History" },
  { key: "vitals", label: "Vitals" },
  { key: "allergies", label: "Allergies" },
  { key: "medications", label: "Medications" },
  { key: "problems", label: "Problem List" },
  { key: "orders", label: "Orders" },
  { key: "results", label: "Labs / Imaging" },
  { key: "notes", label: "Progress Notes" },
  { key: "documents", label: "Documents" },
  { key: "coding", label: "Coding / Charges" },
  { key: "tasks", label: "Tasks" },
  { key: "messages", label: "Patient Messages" },
];

const TOP_ACTIONS = [
  "Save",
  "Sign",
  "Lock Note",
  "Print",
  "Fax",
  "Send to Portal",
  "Superbill",
  "Follow-up",
];

const DEFAULT_TASKS = [
  { id: "task-1", title: "Review results", done: false },
  { id: "task-2", title: "Finalize chart note", done: false },
  { id: "task-3", title: "Send portal summary", done: false },
];

type ClinicTask = { id: string; title: string; done: boolean };

function ClinicTaskPanel({ storageKey }: { storageKey: string }) {
  const [tasks, setTasks] = useState<ClinicTask[]>(() => {
    if (typeof window === "undefined") return DEFAULT_TASKS;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return DEFAULT_TASKS;
      const parsed = JSON.parse(raw) as ClinicTask[];
      if (!Array.isArray(parsed)) return DEFAULT_TASKS;
      return parsed.filter(
        (task) => task && typeof task.id === "string" && typeof task.title === "string" && typeof task.done === "boolean",
      );
    } catch {
      return DEFAULT_TASKS;
    }
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(tasks));
  }, [storageKey, tasks]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-700">
        {tasks.map((task) => (
          <label key={task.id} className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <input
              type="checkbox"
              checked={task.done}
              onChange={() =>
                setTasks((current) => current.map((row) => (row.id === task.id ? { ...row, done: !row.done } : row)))
              }
            />
            <span className={task.done ? "line-through text-slate-500" : "text-slate-800"}>{task.title}</span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ClinicEhrWorkspace({ storageKeyPrefix }: { storageKeyPrefix: string }) {
  const clinicId = storageKeyPrefix;
  const router = useRouter();
  const { user } = useUser();
  const staffSession = useStaffSession();
  const staffEmail = user?.primaryEmailAddress?.emailAddress;
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<Id<"patients"> | null>(null);
  const [activeMenu, setActiveMenu] = useState<ChartMenuKey>("dashboard");
  const [activeEncounterId, setActiveEncounterId] = useState<Id<"encounters"> | null>(null);

  const searchedPatients = useQuery(api.patients.searchPatients, { query: search.trim() }) ?? [];
  const todaysAppointments = useQuery(api.primaryCare.listAppointments, {
    clinicId,
    startMs: new Date(new Date().setHours(0, 0, 0, 0)).getTime(),
    endMs: new Date(new Date().setHours(23, 59, 59, 999)).getTime(),
  });

  const selectedPatient = useQuery(
    api.patients.getById,
    selectedPatientId ? { patientId: selectedPatientId } : "skip",
  );

  const selectedEncounters = useQuery(
    api.encounters.getByPatientWithInsurance,
    selectedPatientId ? { patientId: selectedPatientId } : "skip",
  );
  const signedInStaff = useQuery(
    api.users.getByEmail,
    staffEmail ? { email: staffEmail } : "skip",
  );

  const patientQueue = useMemo(() => {
    const withPatient = (todaysAppointments ?? []).filter((a) => Boolean(a.patientId));
    const dedup = new Map<string, (typeof withPatient)[number]>();
    for (const appt of withPatient) {
      if (!dedup.has(String(appt.patientId))) dedup.set(String(appt.patientId), appt);
    }
    return Array.from(dedup.values());
  }, [todaysAppointments]);

  const resolvedEncounterId = useMemo(() => {
    if (!selectedEncounters || selectedEncounters.length === 0) return null;
    if (activeEncounterId) {
      const matched = selectedEncounters.find((encounter) => encounter._id === activeEncounterId);
      if (matched) return matched._id;
    }

    return [...selectedEncounters].sort((a, b) => {
      const at = a.flowStageUpdatedAt ?? a._creationTime ?? 0;
      const bt = b.flowStageUpdatedAt ?? b._creationTime ?? 0;
      return bt - at;
    })[0]?._id ?? null;
  }, [activeEncounterId, selectedEncounters]);

  const activeEncounter = useMemo(() => {
    if (!selectedEncounters || selectedEncounters.length === 0 || !resolvedEncounterId) return null;
    return selectedEncounters.find((encounter) => encounter._id === resolvedEncounterId) ?? null;
  }, [resolvedEncounterId, selectedEncounters]);

  const activeEncounterOrders =
    useQuery(api.orders.getByEncounter, resolvedEncounterId ? { encounterId: resolvedEncounterId } : "skip") ?? [];
  const activeEncounterNotes =
    useQuery(api.notes.getByEncounter, resolvedEncounterId ? { encounterId: resolvedEncounterId } : "skip") ?? [];
  const activeEncounterLabs =
    useQuery(api.labs.getByEncounter, resolvedEncounterId ? { encounterId: resolvedEncounterId } : "skip") ?? [];
  const activeEncounterImaging =
    useQuery(api.imaging.getByEncounter, resolvedEncounterId ? { encounterId: resolvedEncounterId } : "skip") ?? [];

  const actorName =
    signedInStaff?.name ||
    staffSession.user?.name ||
    user?.fullName ||
    staffEmail ||
    "Clinical Staff";
  const actorRole: ActorRole = normalizeActorRole(signedInStaff?.role || staffSession.user?.role);

  const openPatientChart = () => {
    if (!selectedPatientId) {
      toast.error("Select a patient chart first");
      return;
    }
    router.push(`/patient/${encodeURIComponent(selectedPatientId)}`);
  };

  const requireEncounterPanel = (title: string) => {
    if (!activeEncounterId || !selectedPatientId) {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <div>No active encounter found for this patient.</div>
            <div>Use Open Full Patient Chart to create or select an encounter, then return here.</div>
            <Button variant="outline" size="sm" onClick={openPatientChart}>Open Full Patient Chart</Button>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  const renderEncounterSwitcher = () => {
    if (!selectedEncounters || selectedEncounters.length === 0) return null;

    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Encounter</div>
        <select
          value={activeEncounterId ?? ""}
          onChange={(event) => setActiveEncounterId((event.target.value || null) as Id<"encounters"> | null)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
        >
          {selectedEncounters.map((encounter) => (
            <option key={encounter._id} value={encounter._id}>
              {encounter.status.toUpperCase()} · {encounter.location || "No room"} · {new Date(encounter._creationTime).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderMenuPanel = () => {
    if (!selectedPatient) {
      return <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">Select a patient to open the clinic chart workspace.</div>;
    }
    const patientId = selectedPatientId;
    if (!patientId) {
      return <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">Select a patient to continue.</div>;
    }

    if (activeMenu === "dashboard") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Chart Summary</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-700">
              <div>Name: {selectedPatient.name ?? "Unknown"}</div>
              <div>MRN: {selectedPatient.mrn ?? "N/A"}</div>
              <div>DOB: {selectedPatient.dob ?? "N/A"}</div>
              <div>Recent Encounter: {activeEncounter ? activeEncounter.status : "None"}</div>
              <div>Pending Orders: {activeEncounterOrders.filter((o) => o.status === "PENDING").length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Clinical Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-700">
              <div>Allergies: {(selectedPatient.allergies ?? []).join(", ") || "None listed"}</div>
              <div>Code Status: {selectedPatient.codeStatus ?? "Not set"}</div>
              <div>Preferred Language: {selectedPatient.preferredLanguage ?? "Not set"}</div>
              <div>Notes in Encounter: {activeEncounterNotes.length}</div>
              <div>Lab/Imaging Results: {activeEncounterLabs.length} / {activeEncounterImaging.length}</div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (activeMenu === "demographics") {
      return (
        <PatientInfoTab patientId={patientId} patient={selectedPatient} />
      );
    }

    if (activeMenu === "history") {
      return (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">History</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <div><strong>Medical:</strong> {(selectedPatient.medicalHistory ?? []).join(", ") || "No entries"}</div>
            <div><strong>Social:</strong> {selectedPatient.socialHistory ?? "No entries"}</div>
            <div><strong>Family:</strong> {selectedPatient.familyHistory ?? "No entries"}</div>
          </CardContent>
        </Card>
      );
    }

    if (activeMenu === "vitals") {
      const fallback = requireEncounterPanel("Vitals");
      if (fallback) return fallback;
      if (!resolvedEncounterId) return requireEncounterPanel("Vitals");
      return <VitalsTrend encounterId={resolvedEncounterId} actorName={actorName} actorRole={actorRole} />;
    }

    if (activeMenu === "allergies") {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Allergies and Safety</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            {(selectedPatient.allergies ?? []).length > 0 ? (
              (selectedPatient.allergies ?? []).map((allergy: string, index: number) => (
                <div key={`${allergy}-${index}`} className="rounded border border-rose-200 bg-rose-50 px-3 py-2">
                  {allergy}
                </div>
              ))
            ) : (
              <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2">No known allergies documented.</div>
            )}
            <div className="text-xs text-slate-500">Medication administration checks in the Medications menu use this allergy profile for conflict detection.</div>
          </CardContent>
        </Card>
      );
    }

    if (activeMenu === "medications") {
      const fallback = requireEncounterPanel("Medications");
      if (fallback) return fallback;
      return (
        <div className="space-y-3">
          <MAR encounterId={resolvedEncounterId} patientAllergies={selectedPatient.allergies ?? []} />
          <MedicationHistory encounterId={resolvedEncounterId} />
        </div>
      );
    }

    if (activeMenu === "problems") {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Problem List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">Chief Complaint: {activeEncounter?.chiefComplaint ?? "Not documented"}</div>
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">Disposition Plan: {activeEncounter?.dispositionPlan ?? "Undecided"}</div>
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">Delay Reason: {activeEncounter?.delayReason ?? "None"}</div>
            <div className="text-xs text-slate-500">For full longitudinal diagnosis/problem management, use Open Full Patient Chart.</div>
          </CardContent>
        </Card>
      );
    }

    if (activeMenu === "orders") {
      const fallback = requireEncounterPanel("Orders");
      if (fallback) return fallback;
      if (!resolvedEncounterId) return fallback;
      return <OrderEntry patientId={patientId} encounterId={resolvedEncounterId} />;
    }

    if (activeMenu === "results") {
      const fallback = requireEncounterPanel("Labs / Imaging");
      if (fallback) return fallback;
      if (!resolvedEncounterId) return fallback;
      return (
        <div className="space-y-3">
          <LabResults encounterId={resolvedEncounterId} />
          <ImagingResults encounterId={resolvedEncounterId} />
        </div>
      );
    }

    if (activeMenu === "notes") {
      const fallback = requireEncounterPanel("Progress Notes");
      if (fallback) return fallback;
      if (!resolvedEncounterId) return fallback;
      return <ClinicalNotes encounterId={resolvedEncounterId} />;
    }

    if (activeMenu === "documents") {
      const fallback = requireEncounterPanel("Documents");
      if (fallback) return fallback;
      if (!resolvedEncounterId) return fallback;
      return (
        <ChartDocumentsPanel
          encounterId={resolvedEncounterId}
            patientId={patientId}
          uploadedBy={actorName}
          actorRole={actorRole}
        />
      );
    }

    if (activeMenu === "coding") {
      const fallback = requireEncounterPanel("Coding / Charges");
      if (fallback) return fallback;
      if (!resolvedEncounterId) return fallback;
      return <BillingDashboard encounterId={String(resolvedEncounterId)} patientId={String(patientId)} />;
    }

    if (activeMenu === "tasks") {
      const fallback = requireEncounterPanel("Tasks");
      if (fallback) return fallback;
      if (!selectedPatientId) return fallback;
      return <ClinicTaskPanel key={`${clinicId}:${selectedPatientId}`} storageKey={`clinic:tasks:${clinicId}:${selectedPatientId}`} />;
    }

    if (activeMenu === "messages") {
      const fallback = requireEncounterPanel("Patient Messages");
      if (fallback) return fallback;
      if (!resolvedEncounterId) return fallback;
      return <PortalMessenger encounterId={String(resolvedEncounterId)} patientId={String(patientId)} />;
    }

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{EHR_MENU.find((x) => x.key === activeMenu)?.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <div>This section is available in the clinic chart workspace.</div>
          <div>Use Open Full Patient Chart for full workflows, documentation, orders, and clinical operations.</div>
          <Button variant="outline" size="sm" onClick={openPatientChart}>Open Full Patient Chart</Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Clinic EHR Chart Workspace</CardTitle>
          <div className="text-xs text-slate-600">AdvancedMD-style charting workspace for clinic visits and chart review.</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 p-2">
            {TOP_ACTIONS.map((action) => (
              <Button
                key={action}
                variant={action === "Save" || action === "Sign" ? "default" : "outline"}
                size="sm"
                onClick={() => toast.success(`${action} action is ready in clinic chart workspace`) }
              >
                {action}
              </Button>
            ))}
            <Button variant="secondary" size="sm" onClick={openPatientChart}>Open Full Patient Chart</Button>
          </div>

          <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="space-y-3 rounded-lg border bg-white p-3">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Patient Lookup</div>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search patient by name or MRN"
                />
                <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                  {searchedPatients.slice(0, 8).map((patient) => (
                    <button
                      key={patient._id}
                      type="button"
                      onClick={() => setSelectedPatientId(patient._id)}
                      className={`w-full rounded-md border px-2 py-1 text-left text-xs ${selectedPatientId === patient._id ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:bg-slate-50"}`}
                    >
                      <div className="font-semibold text-slate-800">{patient.name ?? "Unnamed"}</div>
                      <div className="text-slate-500">MRN {patient.mrn ?? "N/A"}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Today Queue</div>
                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {patientQueue.slice(0, 10).map((appt) => (
                    <button
                      key={appt._id}
                      type="button"
                      onClick={() => {
                        if (appt.patientId) setSelectedPatientId(appt.patientId);
                      }}
                      className={`w-full rounded-md border px-2 py-1 text-left text-xs ${selectedPatientId === appt.patientId ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}
                    >
                      <div className="font-semibold text-slate-800">{appt.patientName ?? "Unknown"}</div>
                      <div className="text-slate-500">{new Date(appt.startMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Chart Menu</div>
                <div className="space-y-1">
                  {EHR_MENU.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveMenu(item.key)}
                      className={`w-full rounded-md border px-2 py-1.5 text-left text-xs font-medium ${activeMenu === item.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Chart: {selectedPatient?.name ?? "Not selected"}</Badge>
                {activeEncounter ? <Badge variant="outline">Encounter: {activeEncounter.status}</Badge> : null}
                <Badge variant="outline">Module: {EHR_MENU.find((x) => x.key === activeMenu)?.label}</Badge>
              </div>
              {renderEncounterSwitcher()}
              {renderMenuPanel()}
            </section>
          </div>
        </CardContent>
      </Card>

      <TemplateManager storageKeyPrefix={storageKeyPrefix} />
    </div>
  );
}
