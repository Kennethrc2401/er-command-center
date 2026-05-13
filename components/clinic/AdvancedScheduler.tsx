"use client"

import React, { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type PatientSearchResult = {
  _id: string;
  name?: string;
  dob?: string;
  mrn?: string;
};

type PmStatus = "scheduled" | "arrived" | "checked_in" | "seen" | "completed" | "no_show" | "cancelled" | "blocked";

const PM_STATUS_TAG = "PM_STATUS";

const statusLabel: Record<PmStatus, string> = {
  scheduled: "Scheduled",
  arrived: "Arrived",
  checked_in: "Checked-In",
  seen: "Seen",
  completed: "Completed",
  no_show: "No-Show",
  cancelled: "Cancelled",
  blocked: "Blocked",
};

const statusClass: Record<PmStatus, string> = {
  scheduled: "#e0f2fe",
  arrived: "#dbeafe",
  checked_in: "#bfdbfe",
  seen: "#c7d2fe",
  completed: "#dcfce7",
  no_show: "#fee2e2",
  cancelled: "#ffe4e6",
  blocked: "#e2e8f0",
};

const toLocalDateTimeValue = (value: number) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const fromLocalDateTimeValue = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
};

export default function AdvancedScheduler({ storageKeyPrefix }: { storageKeyPrefix: string }) {
  const clinicId = storageKeyPrefix;
  const appts = useQuery(api.primaryCare.listAppointments, { clinicId }) ?? [];
  const providers = useQuery(api.users.listClinicProviders, { clinicId }) ?? [];
  const types = useQuery(api.primaryCare.listApptTypes, { clinicId }) ?? [];
  const rooms = useQuery(api.primaryCare.listRooms, { clinicId }) ?? [];
  const createAppt = useMutation(api.primaryCare.createAppointment);
  const updateAppt = useMutation(api.primaryCare.updateAppointment);
  const removeAppt = useMutation(api.primaryCare.deleteAppointment);
  const createPatient = useMutation(api.patients.createPatient);
  const updatePatientDemographics = useMutation(api.patients.updateDemographics);
  const upsertCoverageByPatient = useMutation(api.insurance.upsertCoverageByPatient);
  const router = useRouter();

  const getPmStatus = (appointment: any): PmStatus => {
    if (String(appointment?.patientName ?? "").includes("[BLOCKED]")) return "blocked";
    const notes = String(appointment?.notes ?? "");
    const match = notes.match(new RegExp(`\\[${PM_STATUS_TAG}:([A-Z_]+)\\]`));
    if (!match?.[1]) return "scheduled";
    const raw = match[1].toLowerCase() as PmStatus;
    return raw in statusLabel ? raw : "scheduled";
  };

  const setPmStatusTag = (notes: string | undefined, status: PmStatus, reason?: string) => {
    const base = String(notes ?? "")
      .replace(new RegExp(`\\[${PM_STATUS_TAG}:[A-Z_]+\\]`, "g"), "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const reasonPart = reason ? ` [PM_REASON:${reason.trim()}]` : "";
    return `${base}${base ? " " : ""}[${PM_STATUS_TAG}:${status.toUpperCase()}]${reasonPart}`.trim();
  };

  const resources = useMemo(() => {
    return providers.map((p: any) => ({ id: p._id ?? p.id, title: p.name || p.title || p._id || p.id }));
  }, [providers]);

  const [pmStatusFilter, setPmStatusFilter] = useState<"all" | PmStatus>("all");

  const filteredAppointments = useMemo(() => {
    if (pmStatusFilter === "all") return appts;
    return appts.filter((a: any) => getPmStatus(a) === pmStatusFilter);
  }, [appts, pmStatusFilter]);

  const events = useMemo(() => {
    return filteredAppointments.map((a: any) => ({
      id: a._id,
      resourceId: a.providerId,
      title: a.patientName || a.notes || "Appt",
      start: new Date(a.startMs).toISOString(),
      end: new Date(a.endMs).toISOString(),
      extendedProps: { roomId: a.roomId, typeId: a.typeId, notes: a.notes, pmStatus: getPmStatus(a) },
      backgroundColor: (() => {
        const pm = getPmStatus(a);
        if (pm && statusClass[pm]) return statusClass[pm];
        if (a.typeId) {
          const t = types.find((x: any) => x._id === a.typeId);
          if (t && (t.color || t.meta?.color)) return t.color ?? t.meta.color;
        }
        return a.color || undefined;
      })(),
    }));
  }, [filteredAppointments, types, pmStatusFilter]);

  const calendarRef = useRef<FullCalendar | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [patientMode, setPatientMode] = useState<"existing" | "new">("existing");
  const [coverageDraft, setCoverageDraft] = useState({
    provider: "",
    policyNumber: "",
    groupNumber: "",
    planType: "",
    coPayAmount: "",
    authorizationRequired: false,
  });
  const patients = useQuery(api.patients.searchPatients, { query: patientSearchTerm }) ?? [];
  const coverage = useQuery(
    api.insurance.getCoverageByPatient,
    selectedPatient?._id ? ({ patientId: selectedPatient._id } as any) : ("skip" as any),
  );
  const [draft, setDraft] = useState({
    patientName: "",
    patientDob: "",
    patientId: "",
    providerId: "",
    apptTypeId: "",
    comment: "",
    startAt: "",
    endAt: "",
  });
  const [contextOpen, setContextOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [contextDraft, setContextDraft] = useState({ apptId: "", title: "", providerId: "" });
  const [slotMenuOpen, setSlotMenuOpen] = useState(false);
  const [slotMenuPos, setSlotMenuPos] = useState({ x: 0, y: 0 });
  const [slotDraft, setSlotDraft] = useState({ startMs: 0, endMs: 0, providerId: "" });
  const [selectedView, setSelectedView] = useState<"resourceTimeGridDay" | "resourceTimeGridWeek">("resourceTimeGridDay");
  const [themePreset, setThemePreset] = useState<"modern" | "classic">("modern");

  useEffect(() => {
    const key = `clinic:advanced:preset:${storageKeyPrefix}`;
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (saved === "classic" || saved === "modern") {
      setThemePreset(saved);
    }
  }, [storageKeyPrefix]);

  useEffect(() => {
    const key = `clinic:advanced:preset:${storageKeyPrefix}`;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, themePreset);
    }
  }, [themePreset, storageKeyPrefix]);

  useEffect(() => {
    if (coverage) {
      setCoverageDraft({
        provider: coverage.provider ?? "",
        policyNumber: coverage.policyNumber ?? "",
        groupNumber: coverage.groupNumber ?? "",
        planType: coverage.planType ?? "",
        coPayAmount: typeof coverage.coPayAmount === "number" ? String(coverage.coPayAmount) : "",
        authorizationRequired: Boolean(coverage.authorizationRequired),
      });
    }
  }, [coverage]);

  useEffect(() => {
    if (!resources.length && providers.length > 0) return;
  }, [resources, providers]);

  const openCreateDialogFromSlot = (startMs: number, endMs: number, providerId: string) => {
    setSelectedPatient(null);
    setPatientSearchTerm("");
    setPatientMode("existing");
    setCoverageDraft({ provider: "", policyNumber: "", groupNumber: "", planType: "", coPayAmount: "", authorizationRequired: false });
    const resolvedProvider = providerId || providers?.[0]?._id || "";
    setDraft({
      patientName: "",
      patientDob: "",
      patientId: "",
      providerId: resolvedProvider,
      apptTypeId: types[0]?._id ?? "",
      comment: "",
      startAt: toLocalDateTimeValue(startMs),
      endAt: toLocalDateTimeValue(endMs),
    });
    setSelectOpen(true);
  };

  const handleDateSelect = async (selectInfo: any) => {
    const startMs = new Date(selectInfo.start).getTime();
    const endMs = new Date(selectInfo.end).getTime();
    const providerId = selectInfo.resource?.id ?? providers?.[0]?._id ?? "";
    if (themePreset === "modern") {
      openCreateDialogFromSlot(startMs, endMs, providerId);
      return;
    }
    setSlotDraft({ startMs, endMs, providerId });
    setSlotMenuPos({
      x: selectInfo.jsEvent?.clientX ?? window.innerWidth / 2,
      y: selectInfo.jsEvent?.clientY ?? window.innerHeight / 2,
    });
    setSlotMenuOpen(true);
  };

  const openEventContext = (event: any, clickEvent: MouseEvent) => {
    const resourcesForEvent = typeof event.getResources === "function" ? event.getResources() : [];
    setContextMenuPos({ x: clickEvent.clientX, y: clickEvent.clientY });
    setContextDraft({ apptId: event.id, title: event.title, providerId: resourcesForEvent[0]?.id ?? event.extendedProps?.resourceLabel ?? "" });
    setContextOpen(true);
  };

  const handleEventRightClick = (clickInfo: any) => {
    clickInfo.jsEvent.preventDefault();
    openEventContext(clickInfo.event, clickInfo.jsEvent);
  };

  const handleEventDrop = async (dropInfo: any) => {
    const ev = dropInfo.event;
    const id = ev.id;
    const startMs = new Date(ev.start).getTime();
    const endMs = new Date(ev.end).getTime();
    const resourcesForEvent = typeof ev.getResources === "function" ? ev.getResources() : [];
    const providerId = resourcesForEvent[0]?.id ?? ev.extendedProps?.resourceLabel;
    await updateAppt({ apptId: id, startMs, endMs, providerId });
  };

  const handleEventResize = async (resizeInfo: any) => {
    const ev = resizeInfo.event;
    const id = ev.id;
    const startMs = new Date(ev.start).getTime();
    const endMs = new Date(ev.end).getTime();
    await updateAppt({ apptId: id, startMs, endMs });
  };

  const handleEventClick = async (clickInfo: any) => {
    clickInfo.jsEvent.preventDefault();
    openEventContext(clickInfo.event, clickInfo.jsEvent);
  };

  const submitCreate = async () => {
    try {
      let patientId = draft.patientId;
      let patientName = draft.patientName.trim();

      if (patientMode === "existing") {
        if (!selectedPatient) {
          throw new Error("Select a saved patient or switch to New Patient.");
        }
        patientId = selectedPatient._id;
        patientName = selectedPatient.name?.trim() || patientName || patientSearchTerm.trim();
      } else if (!patientId) {
        const targetName = (patientName || patientSearchTerm).trim();
        if (!targetName) {
          throw new Error("Patient name is required.");
        }

        if (selectedPatient && selectedPatient.name?.trim() === targetName) {
          patientId = selectedPatient._id;
        } else {
          patientId = await createPatient({ name: targetName });
        }
      }

      const selectedStartMs = fromLocalDateTimeValue(draft.startAt);
      const selectedEndMs = fromLocalDateTimeValue(draft.endAt);
      if (selectedEndMs <= selectedStartMs) {
        throw new Error("End time must be after start time.");
      }

      if (draft.patientDob.trim()) {
        await updatePatientDemographics({ patientId: patientId as any, dob: draft.patientDob.trim(), name: patientName || undefined });
      }

      const insuranceProvided =
        coverageDraft.provider.trim().length > 0 ||
        coverageDraft.policyNumber.trim().length > 0 ||
        coverageDraft.groupNumber.trim().length > 0 ||
        coverageDraft.planType.trim().length > 0 ||
        coverageDraft.coPayAmount.trim().length > 0 ||
        coverageDraft.authorizationRequired;

      if (insuranceProvided) {
        const coPayAmount = coverageDraft.coPayAmount.trim() ? Number(coverageDraft.coPayAmount) : 0;
        await upsertCoverageByPatient({
          patientId: patientId as any,
          provider: coverageDraft.provider || "Self-Pay",
          policyNumber: coverageDraft.policyNumber || `TEMP-${String(Date.now()).slice(-6)}`,
          groupNumber: coverageDraft.groupNumber || undefined,
          planType: coverageDraft.planType || undefined,
          coPayAmount: Number.isFinite(coPayAmount) ? coPayAmount : 0,
          authorizationRequired: coverageDraft.authorizationRequired,
        });
      }

      await createAppt({
        clinicId,
        patientId: patientId as any,
        patientName: patientName || patientSearchTerm.trim() || "New Patient",
        providerId: draft.providerId || undefined,
        roomId: undefined,
        typeId: draft.apptTypeId ? (draft.apptTypeId as any) : undefined,
        startMs: selectedStartMs,
        endMs: selectedEndMs,
        notes: setPmStatusTag(draft.comment.trim(), "scheduled"),
      });

      setSelectOpen(false);
      toast.success("Appointment created");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create appointment";
      toast.error(message);
    }
  };

  const submitContextUpdate = async () => {
    try {
      await updateAppt({ apptId: contextDraft.apptId, patientName: contextDraft.title, providerId: contextDraft.providerId });
      setContextOpen(false);
      toast.success("Appointment updated");
    } catch (e) {
      toast.error("Failed to update appointment");
    }
  };

  const duplicateAppt = async () => {
    try {
      const original = appts.find((a: any) => a._id === contextDraft.apptId);
      if (!original) throw new Error("Original not found");
      const duration = original.endMs - original.startMs;
      const startMs = original.endMs + 60_000; // after original
      const endMs = startMs + duration;
      await createAppt({
        clinicId,
        patientName: original.patientName,
        providerId: original.providerId,
        roomId: original.roomId,
        typeId: original.typeId,
        startMs,
        endMs,
        notes: original.notes,
      });
      setContextOpen(false);
      toast.success("Appointment duplicated");
    } catch (e) {
      toast.error("Failed to duplicate appointment");
    }
  };

  const copyApptToNextDay = async () => {
    try {
      const original = appts.find((a: any) => a._id === contextDraft.apptId);
      if (!original) throw new Error("Original not found");
      const duration = original.endMs - original.startMs;
      const startMs = new Date(original.startMs).getTime() + 86400000; // Add 1 day
      const endMs = startMs + duration;
      await createAppt({
        clinicId,
        patientName: original.patientName,
        providerId: original.providerId,
        roomId: original.roomId,
        typeId: original.typeId,
        startMs,
        endMs,
        notes: original.notes,
      });
      setContextOpen(false);
      toast.success("Appointment copied to next day");
    } catch (e) {
      toast.error("Failed to copy appointment");
    }
  };

  const createBlockedTime = async () => {
    try {
      const original = appts.find((a: any) => a._id === contextDraft.apptId);
      if (!original) throw new Error("Original not found");
      await updateAppt({
        apptId: contextDraft.apptId,
        patientName: "[BLOCKED]",
        notes: setPmStatusTag(original.notes, "blocked"),
      });
      setContextOpen(false);
      toast.success("Time blocked");
    } catch (e) {
      toast.error("Failed to block time");
    }
  };

  const createBlockFromSlot = async () => {
    try {
      await createAppt({
        clinicId,
        patientName: "[BLOCKED]",
        providerId: slotDraft.providerId || undefined,
        roomId: undefined,
        typeId: undefined,
        startMs: slotDraft.startMs,
        endMs: slotDraft.endMs,
        notes: `[${PM_STATUS_TAG}:BLOCKED] Blocked schedule time`,
      });
      setSlotMenuOpen(false);
      toast.success("Blocked time created");
    } catch {
      toast.error("Failed to create blocked time");
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "n" && slotMenuOpen) {
        event.preventDefault();
        openCreateDialogFromSlot(slotDraft.startMs, slotDraft.endMs, slotDraft.providerId);
        setSlotMenuOpen(false);
      }
      if (event.key.toLowerCase() === "b" && slotMenuOpen) {
        event.preventDefault();
        void createBlockFromSlot();
      }
      if (event.key.toLowerCase() === "escape") {
        setContextOpen(false);
        setSlotMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slotMenuOpen, slotDraft]);

  const deleteCurrentAppointment = async () => {
    try {
      await removeAppt({ apptId: contextDraft.apptId as any });
      setContextOpen(false);
      toast.success("Appointment deleted");
    } catch {
      toast.error("Failed to delete appointment");
    }
  };

  const updatePmStatusForAppointment = async (apptId: string, status: PmStatus, reason?: string, closeMenu = false) => {
    const current = appts.find((a: any) => a._id === apptId);
    if (!current) throw new Error("Appointment not found");
    const nextNotes = setPmStatusTag(current.notes, status, reason);
    await updateAppt({ apptId: apptId as any, notes: nextNotes });
    if (closeMenu) {
      setContextOpen(false);
    }
  };

  const updateCurrentPmStatus = async (status: PmStatus, reason?: string) => {
    try {
      await updatePmStatusForAppointment(contextDraft.apptId, status, reason, true);
      toast.success(`Status updated to ${statusLabel[status]}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const runQueueStatusAction = async (apptId: string, status: PmStatus) => {
    try {
      await updatePmStatusForAppointment(apptId, status);
      toast.success(`Status updated to ${statusLabel[status]}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const moveToRoom = async (roomId: string) => {
    try {
      await updateAppt({ apptId: contextDraft.apptId, roomId });
      setContextOpen(false);
      toast.success("Moved appointment to room");
    } catch (e) {
      toast.error("Failed to move appointment");
    }
  };

  const openPatientChart = (apptId: string) => {
    const appt = appts.find((a: any) => a._id === apptId);
    if (!appt || !appt.patientId) {
      toast.error("No patient linked to this appointment");
      return;
    }
    router.push(`/patient/${encodeURIComponent(appt.patientId)}`);
  };

  const getEventResourceLabel = (event: any) => {
    const resourcesForEvent = typeof event.getResources === "function" ? event.getResources() : [];
    if (resourcesForEvent.length > 0) {
      return resourcesForEvent[0]?.title ?? resourcesForEvent[0]?.id ?? "";
    }
    return event.extendedProps?.providerName ?? event.extendedProps?.resourceLabel ?? "";
  };

  const matchingPatients = useMemo(() => {
    return (patients as PatientSearchResult[]).slice(0, 8);
  }, [patientSearchTerm, patients]);

  const schedulerStats = useMemo(() => {
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const todayAppts = appts.filter((a: any) => a.startMs >= dayStart && a.startMs < dayEnd);
    const blocked = appts.filter((a: any) => getPmStatus(a) === "blocked").length;
    const arrived = appts.filter((a: any) => getPmStatus(a) === "arrived").length;
    const checkedIn = appts.filter((a: any) => getPmStatus(a) === "checked_in").length;
    const noShow = appts.filter((a: any) => getPmStatus(a) === "no_show").length;
    return {
      todayCount: todayAppts.length,
      blockedCount: blocked,
      arrivedCount: arrived,
      checkedInCount: checkedIn,
      noShowCount: noShow,
      providerCount: resources.length,
    };
  }, [appts, resources]);

  const pmQueue = useMemo(() => {
    const now = Date.now();
    return appts
      .filter((a: any) => {
        const status = getPmStatus(a);
        return status === "arrived" || status === "checked_in";
      })
      .sort((a: any, b: any) => a.startMs - b.startMs)
      .map((a: any) => {
        const status = getPmStatus(a);
        const provider = providers.find((p: any) => (p._id ?? p.id) === a.providerId);
        return {
          id: a._id,
          patientName: a.patientName || "Unnamed",
          patientId: a.patientId,
          status,
          providerName: provider?.name || provider?.title || "Unassigned",
          waitMinutes: Math.max(0, Math.floor((now - a.startMs) / 60000)),
          startLabel: new Date(a.startMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
      });
  }, [appts, providers]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold tracking-wide text-sky-900">Advanced Scheduler</CardTitle>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <div className="inline-flex items-center rounded-full border border-slate-300 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setThemePreset("classic")}
                className={`rounded-full px-2 py-1 text-[11px] font-semibold transition ${themePreset === "classic" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Classic
              </button>
              <button
                type="button"
                onClick={() => setThemePreset("modern")}
                className={`rounded-full px-2 py-1 text-[11px] font-semibold transition ${themePreset === "modern" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Modern
              </button>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 font-medium text-indigo-700">{selectedView === "resourceTimeGridWeek" ? "Week View" : "Day View"}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-1">N: New Appointment</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1">B: New Block</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">Esc: Close Menu</span>
            <select
              value={pmStatusFilter}
              onChange={(e) => setPmStatusFilter(e.target.value as any)}
              className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="arrived">Arrived</option>
              <option value="checked_in">Checked-In</option>
              <option value="seen">Seen</option>
              <option value="completed">Completed</option>
              <option value="no_show">No-Show</option>
              <option value="cancelled">Cancelled</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_280px]">
          <aside className="hidden xl:flex xl:flex-col rounded-lg border border-sky-100 bg-sky-50/50 p-3 text-xs text-slate-700">
            <div className="mb-2 font-semibold uppercase tracking-wide text-sky-700">Status Rail</div>
            <div className="space-y-2">
              <div className="rounded-md border border-sky-200 bg-white px-2 py-1.5">
                <div className="text-[10px] uppercase text-slate-500">Today Appointments</div>
                <div className="text-sm font-semibold text-sky-800">{schedulerStats.todayCount}</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                <div className="text-[10px] uppercase text-slate-500">Providers</div>
                <div className="text-sm font-semibold text-slate-800">{schedulerStats.providerCount}</div>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5">
                <div className="text-[10px] uppercase text-red-600">Blocks</div>
                <div className="text-sm font-semibold text-red-700">{schedulerStats.blockedCount}</div>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5">
                <div className="text-[10px] uppercase text-blue-600">Arrived / Checked-In</div>
                <div className="text-sm font-semibold text-blue-700">{schedulerStats.arrivedCount} / {schedulerStats.checkedInCount}</div>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
                <div className="text-[10px] uppercase text-amber-600">No-Shows</div>
                <div className="text-sm font-semibold text-amber-700">{schedulerStats.noShowCount}</div>
              </div>
            </div>
            <div className="mt-4 border-t border-sky-100 pt-3 text-[11px] leading-5 text-slate-600">
              <div className="font-medium text-slate-700">Quick Actions</div>
              <div>Click empty slot to open menu.</div>
              <div>Click appointment to open actions.</div>
              <div>Use N/B hotkeys in slot menu.</div>
            </div>
          </aside>

          <div className={`advancedmd-calendar advancedmd-${themePreset} h-180 rounded-lg border border-sky-100 bg-white`}>
          <FullCalendar
            plugins={[timeGridPlugin, interactionPlugin, resourceTimeGridPlugin]}
            initialView="resourceTimeGridDay"
            views={{
              resourceTimeGridDay: {
                dayHeaderFormat: { weekday: "short", month: "numeric", day: "numeric" },
              },
              resourceTimeGridWeek: {
                dayHeaderFormat: { weekday: "short", month: "numeric", day: "numeric" },
              },
            }}
            headerToolbar={{ left: "prev,next today", center: "title", right: "resourceTimeGridDay,resourceTimeGridWeek" }}
            resources={resources}
            events={events}
            selectable={true}
            selectMirror={true}
            select={handleDateSelect}
            editable={true}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventClick={handleEventClick}
            eventDidMount={(info:any) => {
              const el = info.el as HTMLElement;
              el.style.fontSize = themePreset === "classic" ? "11px" : "12px";
              el.style.padding = "4px 6px";
              el.style.borderRadius = "6px";
              el.style.lineHeight = "1.1";
              const provider = getEventResourceLabel(info.event);
              const room = info.event.extendedProps?.roomId;
              const meta = document.createElement("div");
              meta.className = "text-[10px] mt-1";
              meta.innerText = `${provider ?? ""}${room ? ` • ${room}` : ""}`;

              // Ensure readable colors in both light and dark mode
              const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
              if (isDark) {
                el.style.color = "#e6eef8";
                meta.style.color = "#cbd5e1";
                el.style.backgroundColor = el.style.backgroundColor || "#0f172a";
              } else {
                el.style.color = "#0f172a";
                meta.style.color = "#334155";
              }

              el.appendChild(meta);

              const handler = (e: MouseEvent) => {
                e.preventDefault();
                const resourcesForEvent = typeof info.event.getResources === "function" ? info.event.getResources() : [];
                setContextDraft({
                  apptId: info.event.id,
                  title: info.event.title,
                  providerId: resourcesForEvent[0]?.id ?? info.event.extendedProps?.resourceLabel ?? "",
                });
                setContextOpen(true);
              };
              el.addEventListener("contextmenu", handler);
            }}
            eventContent={(arg:any) => {
              const providerLabel = getEventResourceLabel(arg.event);
              const pmStatus = arg.event.extendedProps?.pmStatus as PmStatus | undefined;
              const pmLabel = pmStatus ? statusLabel[pmStatus] : "Scheduled";
              return {
                html: `<div class=\\"fc-advanced-event\\" style=\\"display:flex;flex-direction:column;gap:2px;\\"><div style=\\"display:flex;align-items:center;gap:6px;\\"><div style=\\"font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;\\">${arg.event.title}</div><span style=\\"font-size:10px;padding:1px 5px;border-radius:9999px;background:rgba(15,23,42,0.08);\\">${pmLabel}</span></div><div style=\\"font-size:11px;opacity:0.85;\\">${providerLabel}</div></div>`
              };
            }}
            
            slotDuration="00:15:00"
            slotLabelInterval="00:30:00"
            eventMinHeight={themePreset === "classic" ? 16 : 20}
            eventShortHeight={themePreset === "classic" ? 14 : 18}
            nowIndicator={true}
            slotMinTime="06:00:00"
            slotMaxTime="20:00:00"
            stickyHeaderDates={true}
            datesSet={(info: any) => setSelectedView(info.view.type)}
            ref={calendarRef}
            allDaySlot={false}
            height="100%"
          />
        </div>

          <aside className="hidden xl:flex xl:flex-col rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 text-xs text-slate-700">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-semibold uppercase tracking-wide text-indigo-700">PM Queue</div>
              <span className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{pmQueue.length} waiting</span>
            </div>
            <div className="space-y-2 overflow-y-auto">
              {pmQueue.length === 0 ? (
                <div className="rounded-md border border-dashed border-indigo-200 bg-white px-3 py-4 text-center text-[11px] text-slate-500">
                  No arrived/check-in patients in queue.
                </div>
              ) : (
                pmQueue.map((item) => (
                  <div key={item.id} className="rounded-md border border-indigo-200 bg-white p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-[12px] font-semibold text-slate-800">{item.patientName}</div>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{statusLabel[item.status]}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600">{item.startLabel} • {item.providerName}</div>
                    <div className="text-[11px] text-amber-700">Wait: {item.waitMinutes}m</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => void runQueueStatusAction(item.id, "seen")}
                        className="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700"
                      >
                        Seen
                      </button>
                      <button
                        type="button"
                        onClick={() => void runQueueStatusAction(item.id, "completed")}
                        className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        onClick={() => openPatientChart(item.id)}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700"
                      >
                        Chart
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>

        <Dialog open={selectOpen} onOpenChange={setSelectOpen}>
          <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Create Appointment</DialogTitle>
            </DialogHeader>
            <div className="max-h-[calc(90vh-8rem)] space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/40">
                <label className="space-y-1">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Selected start</span>
                  <Input type="datetime-local" value={draft.startAt} onChange={(e:any)=>setDraft({...draft, startAt: e.target.value})} className="dark:bg-slate-800 dark:text-slate-100" />
                </label>
                <label className="space-y-1">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Selected end</span>
                  <Input type="datetime-local" value={draft.endAt} onChange={(e:any)=>setDraft({...draft, endAt: e.target.value})} className="dark:bg-slate-800 dark:text-slate-100" />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Find saved patient</span>
                  <Input
                    value={patientSearchTerm}
                    onChange={(e:any) => setPatientSearchTerm(e.target.value)}
                    placeholder="Search saved patients by name or MRN"
                    className="dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>

                <div className="md:col-span-2 flex gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setPatientMode("existing")}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${patientMode === "existing" ? "bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}`}
                  >
                    Use saved patient
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPatientMode("new");
                      setSelectedPatient(null);
                      setDraft((current) => ({ ...current, patientId: "" }));
                        setCoverageDraft({ provider: "", policyNumber: "", groupNumber: "", planType: "", coPayAmount: "", authorizationRequired: false });
                    }}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${patientMode === "new" ? "bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}`}
                  >
                    Create new patient
                  </button>
                </div>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Patient name</span>
                  <Input
                    value={draft.patientName}
                    onChange={(e:any)=>{
                      setDraft({...draft, patientName: e.target.value});
                      setPatientMode("new");
                      setSelectedPatient(null);
                    }}
                    placeholder="Enter patient name"
                    className="dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Patient DOB</span>
                  <Input
                    type="date"
                    value={draft.patientDob}
                    onChange={(e:any)=>setDraft({...draft, patientDob: e.target.value})}
                    className="dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Appointment type</span>
                  <select
                    value={draft.apptTypeId}
                    onChange={(e)=>setDraft({...draft, apptTypeId: e.target.value})}
                    className="w-full rounded-md border p-2 bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">Select type...</option>
                    {types.map((type:any)=>(<option key={type._id} value={type._id}>{type.name}</option>))}
                  </select>
                </label>

                <label className="space-y-1 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Comment</span>
                  <Input
                    value={draft.comment}
                    onChange={(e:any)=>setDraft({...draft, comment: e.target.value})}
                    placeholder="Add a note or reason for visit"
                    className="dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Provider</span>
                  <select value={draft.providerId} onChange={(e)=>setDraft({...draft, providerId: e.target.value})} className="w-full rounded-md border p-2 bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    <option value="">Select provider...</option>
                    {providers.map((p:any)=>(<option key={p._id} value={p._id}>{p.name||p._id}</option>))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 rounded-lg border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">Insurance</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Optional, but ready for saved patient lookups and new registration.</div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{selectedPatient ? `Patient: ${selectedPatient.name ?? selectedPatient._id}` : patientMode === "new" ? "New patient" : "No patient selected"}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Payer</span>
                    <Input value={coverageDraft.provider} onChange={(e:any)=>setCoverageDraft({...coverageDraft, provider: e.target.value})} placeholder="Insurance provider" className="dark:bg-slate-800 dark:text-slate-100" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Policy number</span>
                    <Input value={coverageDraft.policyNumber} onChange={(e:any)=>setCoverageDraft({...coverageDraft, policyNumber: e.target.value})} placeholder="Policy / member ID" className="dark:bg-slate-800 dark:text-slate-100" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Group number</span>
                    <Input value={coverageDraft.groupNumber} onChange={(e:any)=>setCoverageDraft({...coverageDraft, groupNumber: e.target.value})} placeholder="Group number" className="dark:bg-slate-800 dark:text-slate-100" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Plan type</span>
                    <Input value={coverageDraft.planType} onChange={(e:any)=>setCoverageDraft({...coverageDraft, planType: e.target.value})} placeholder="PPO, HMO, Medicare..." className="dark:bg-slate-800 dark:text-slate-100" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Copay</span>
                    <Input type="number" min="0" step="0.01" value={coverageDraft.coPayAmount} onChange={(e:any)=>setCoverageDraft({...coverageDraft, coPayAmount: e.target.value})} placeholder="0.00" className="dark:bg-slate-800 dark:text-slate-100" />
                  </label>
                  <label className="flex items-center gap-2 self-end rounded-md border px-3 py-2 text-sm dark:border-slate-700">
                    <input type="checkbox" checked={coverageDraft.authorizationRequired} onChange={(e)=>setCoverageDraft({...coverageDraft, authorizationRequired: e.target.checked})} />
                    <span className="text-slate-700 dark:text-slate-200">Authorization required</span>
                  </label>
                </div>
              </div>

              <div className="rounded-lg border bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Saved patients</div>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {matchingPatients.length > 0 ? matchingPatients.map((patient) => (
                    <button
                      key={patient._id}
                      type="button"
                      onClick={() => {
                        setPatientMode("existing");
                        setCoverageDraft({ provider: "", policyNumber: "", groupNumber: "", planType: "", coPayAmount: "", authorizationRequired: false });
                        setSelectedPatient(patient);
                        setDraft((current) => ({
                          ...current,
                          patientId: patient._id,
                          patientName: patient.name ?? current.patientName,
                          patientDob: patient.dob ?? current.patientDob,
                        }));
                        setPatientSearchTerm(patient.name ?? "");
                      }}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${selectedPatient?._id === patient._id ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40" : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900"}`}
                    >
                      <span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{patient.name ?? "Unnamed"}</span>
                        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{patient.mrn ?? ""}</span>
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{patient.dob ?? "No DOB"}</span>
                    </button>
                  )) : (
                    <div className="rounded-md border border-dashed px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No saved patients matched. Enter a new patient name to create one.
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={()=>setSelectOpen(false)} variant="outline">Cancel</Button>
              <Button onClick={submitCreate}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* AdvancedMD-style context menu */}
        {contextOpen && (
          <div
            className="fixed z-50 min-w-52 rounded-lg border border-sky-200 bg-white/98 shadow-xl ring-1 ring-sky-100"
            style={{
              left: `${contextMenuPos.x}px`,
              top: `${contextMenuPos.y}px`,
              transform: "translate(-8px, -8px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1 p-2">
              <button
                onClick={() => {
                  setContextOpen(false);
                  const original = appts.find((a: any) => a._id === contextDraft.apptId);
                  if (original) {
                    openCreateDialogFromSlot(original.endMs, original.endMs + 60 * 60 * 1000, original.providerId || "");
                  }
                }}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-sky-100 dark:text-slate-200 dark:hover:bg-sky-950/40 transition"
              >
                + New Appointment
              </button>
              <button
                onClick={copyApptToNextDay}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-sky-100 dark:text-slate-200 dark:hover:bg-sky-950/40 transition"
              >
                📋 Copy to Next Day
              </button>
              <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
              <button onClick={() => updateCurrentPmStatus("arrived")} className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-blue-100 transition">Mark Arrived</button>
              <button onClick={() => updateCurrentPmStatus("checked_in")} className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-indigo-100 transition">Check-In</button>
              <button onClick={() => updateCurrentPmStatus("seen")} className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-violet-100 transition">Mark Seen</button>
              <button onClick={() => updateCurrentPmStatus("completed")} className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-emerald-100 transition">Complete</button>
              <button onClick={() => updateCurrentPmStatus("no_show")} className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-amber-100 transition">No-Show</button>
              <button
                onClick={() => {
                  const reason = window.prompt("Cancellation reason", "Patient cancelled") ?? "";
                  void updateCurrentPmStatus("cancelled", reason);
                }}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-rose-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={createBlockedTime}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-red-100 dark:text-slate-200 dark:hover:bg-red-950/40 transition"
              >
                New Block
              </button>
              <button
                onClick={deleteCurrentAppointment}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-100 transition"
              >
                Delete Appointment
              </button>
              <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
              <button
                onClick={() => setContextOpen(false)}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* AdvancedMD-style slot action menu */}
        {slotMenuOpen && (
          <div
            className="fixed z-50 min-w-52 rounded-lg border border-sky-200 bg-white/98 shadow-xl ring-1 ring-sky-100"
            style={{
              left: `${slotMenuPos.x}px`,
              top: `${slotMenuPos.y}px`,
              transform: "translate(-8px, -8px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1 p-2">
              <button
                onClick={() => {
                  openCreateDialogFromSlot(slotDraft.startMs, slotDraft.endMs, slotDraft.providerId);
                  setSlotMenuOpen(false);
                }}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-sky-100 transition"
              >
                New Appointment <span className="ml-1 text-[11px] text-slate-400">N</span>
              </button>
              <button
                onClick={createBlockFromSlot}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-red-100 transition"
              >
                New Block <span className="ml-1 text-[11px] text-slate-400">B</span>
              </button>
              <button
                onClick={() => {
                  openCreateDialogFromSlot(slotDraft.startMs + 7 * 24 * 60 * 60 * 1000, slotDraft.endMs + 7 * 24 * 60 * 60 * 1000, slotDraft.providerId);
                  setSlotMenuOpen(false);
                }}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-sky-100 transition"
              >
                Recurring Appointment
              </button>
            </div>
          </div>
        )}

        {/* Dismiss context menu on outside click */}
        {(contextOpen || slotMenuOpen) && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setContextOpen(false);
              setSlotMenuOpen(false);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
