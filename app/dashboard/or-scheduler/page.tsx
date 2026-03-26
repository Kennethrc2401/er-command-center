"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ClipboardList,
  Filter,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type CasePriority = "ELECTIVE" | "URGENT" | "EMERGENT";
type CaseStatus = "SCHEDULED" | "IN_ROOM" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

type OrCase = Doc<"orCases">;

function isActiveCaseStatus(status: CaseStatus) {
  return status === "SCHEDULED" || status === "IN_ROOM" || status === "IN_PROGRESS";
}

function statusClass(status: CaseStatus) {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-700 border-none";
  if (status === "IN_PROGRESS") return "bg-blue-100 text-blue-700 border-none";
  if (status === "IN_ROOM") return "bg-amber-100 text-amber-700 border-none";
  if (status === "CANCELLED") return "bg-slate-200 text-slate-700 border-none";
  return "bg-violet-100 text-violet-700 border-none";
}

function priorityClass(priority: CasePriority) {
  if (priority === "EMERGENT") return "bg-red-100 text-red-700 border-none";
  if (priority === "URGENT") return "bg-amber-100 text-amber-700 border-none";
  return "bg-slate-100 text-slate-700 border-none";
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dateInputValue(ts: number) {
  const date = new Date(ts);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function OrSchedulerPage() {
  const { actorName } = useResolvedActor();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [roomFilter, setRoomFilter] = useState("ALL");
  const [surgeonFilter, setSurgeonFilter] = useState("ALL");

  const [patientName, setPatientName] = useState("");
  const [procedure, setProcedure] = useState("");
  const [surgeon, setSurgeon] = useState("");
  const [anesthesia, setAnesthesia] = useState("General");
  const [room, setRoom] = useState("OR-1");
  const [priority, setPriority] = useState<CasePriority>("ELECTIVE");
  const [notes, setNotes] = useState("");
  const [startAt, setStartAt] = useState(() => dateInputValue(Date.now() + 30 * 60_000));
  const [endAt, setEndAt] = useState(() => dateInputValue(Date.now() + 90 * 60_000));
  const [editingCaseId, setEditingCaseId] = useState<OrCase["_id"] | null>(null);
  const [editPatientName, setEditPatientName] = useState("");
  const [editProcedure, setEditProcedure] = useState("");
  const [editSurgeon, setEditSurgeon] = useState("");
  const [editAnesthesia, setEditAnesthesia] = useState("General");
  const [editRoom, setEditRoom] = useState("OR-1");
  const [editPriority, setEditPriority] = useState<CasePriority>("ELECTIVE");
  const [editStartAt, setEditStartAt] = useState(() => dateInputValue(Date.now() + 30 * 60_000));
  const [editEndAt, setEditEndAt] = useState(() => dateInputValue(Date.now() + 90 * 60_000));
  const [editNotes, setEditNotes] = useState("");

  const createCase = useMutation(api.orScheduler.createCase);
  const updateCaseDetails = useMutation(api.orScheduler.updateCaseDetails);
  const updateStatus = useMutation(api.orScheduler.updateStatus);
  const removeCaseMutation = useMutation(api.orScheduler.removeCase);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const dayStart = useMemo(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);
    return date.getTime();
  }, [selectedDate]);

  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const dayCases = useQuery(api.orScheduler.getByWindow, {
    startMs: dayStart,
    endMs: dayEnd,
  });

  const sortedDayCases = useMemo(
    () => (dayCases ?? []).slice().sort((a, b) => a.scheduledStart - b.scheduledStart),
    [dayCases]
  );

  const roomOptions = useMemo(
    () => Array.from(new Set(sortedDayCases.map((entry) => entry.room))).sort((a, b) => a.localeCompare(b)),
    [sortedDayCases]
  );
  const surgeonOptions = useMemo(
    () => Array.from(new Set(sortedDayCases.map((entry) => entry.surgeon))).sort((a, b) => a.localeCompare(b)),
    [sortedDayCases]
  );

  const filteredDayCases = useMemo(
    () =>
      sortedDayCases.filter((entry) => {
        const matchesRoom = roomFilter === "ALL" || entry.room === roomFilter;
        const matchesSurgeon = surgeonFilter === "ALL" || entry.surgeon === surgeonFilter;
        return matchesRoom && matchesSurgeon;
      }),
    [roomFilter, sortedDayCases, surgeonFilter]
  );

  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();
  const roomConflictPreview = useMemo(() => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
    return sortedDayCases.find(
      (entry) =>
        ["SCHEDULED", "IN_ROOM", "IN_PROGRESS"].includes(entry.status) &&
        entry.room.trim().toLowerCase() === room.trim().toLowerCase() &&
        startMs < entry.scheduledEnd && endMs > entry.scheduledStart
    );
  }, [endMs, room, sortedDayCases, startMs]);
  const surgeonConflictPreview = useMemo(() => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
    return sortedDayCases.find(
      (entry) =>
        isActiveCaseStatus(entry.status) &&
        entry.surgeon.trim().toLowerCase() === surgeon.trim().toLowerCase() &&
        startMs < entry.scheduledEnd && endMs > entry.scheduledStart
    );
  }, [endMs, sortedDayCases, startMs, surgeon]);

  const editStartMs = useMemo(() => new Date(editStartAt).getTime(), [editStartAt]);
  const editEndMs = useMemo(() => new Date(editEndAt).getTime(), [editEndAt]);
  const editRoomConflictPreview = useMemo(() => {
    if (!editingCaseId) return null;
    if (!Number.isFinite(editStartMs) || !Number.isFinite(editEndMs) || editEndMs <= editStartMs) return null;
    return sortedDayCases.find(
      (entry) =>
        entry._id !== editingCaseId &&
        isActiveCaseStatus(entry.status) &&
        entry.room.trim().toLowerCase() === editRoom.trim().toLowerCase() &&
        editStartMs < entry.scheduledEnd && editEndMs > entry.scheduledStart
    );
  }, [editEndMs, editRoom, editStartMs, editingCaseId, sortedDayCases]);
  const editSurgeonConflictPreview = useMemo(() => {
    if (!editingCaseId) return null;
    if (!Number.isFinite(editStartMs) || !Number.isFinite(editEndMs) || editEndMs <= editStartMs) return null;
    return sortedDayCases.find(
      (entry) =>
        entry._id !== editingCaseId &&
        isActiveCaseStatus(entry.status) &&
        entry.surgeon.trim().toLowerCase() === editSurgeon.trim().toLowerCase() &&
        editStartMs < entry.scheduledEnd && editEndMs > entry.scheduledStart
    );
  }, [editEndMs, editingCaseId, editStartMs, editSurgeon, sortedDayCases]);
  const hasEditConflict = Boolean(editRoomConflictPreview || editSurgeonConflictPreview);

  const timelineRooms = useMemo(
    () =>
      Array.from(new Set(filteredDayCases.map((entry) => entry.room)))
        .sort((a, b) => a.localeCompare(b))
        .map((roomName) => ({
          roomName,
          entries: filteredDayCases
            .filter((entry) => entry.room === roomName)
            .sort((a, b) => a.scheduledStart - b.scheduledStart),
        })),
    [filteredDayCases]
  );

  const stats = useMemo(() => {
    const completed = filteredDayCases.filter((entry) => entry.status === "COMPLETED").length;
    const active = filteredDayCases.filter(
      (entry) => entry.status === "IN_ROOM" || entry.status === "IN_PROGRESS"
    ).length;
    const emergent = filteredDayCases.filter((entry) => entry.priority === "EMERGENT").length;
    return { total: filteredDayCases.length, completed, active, emergent };
  }, [filteredDayCases]);

  const addCase = async () => {
    if (!patientName.trim() || !procedure.trim() || !surgeon.trim()) {
      toast.error("Patient, procedure, and surgeon are required.");
      return;
    }

    const start = new Date(startAt).getTime();
    const end = new Date(endAt).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      toast.error("Please provide valid start and end times.");
      return;
    }

    if (end <= start) {
      toast.error("End time must be after start time.");
      return;
    }

    try {
      await createCase({
        patientName: patientName.trim(),
        procedure: procedure.trim(),
        surgeon: surgeon.trim(),
        anesthesia: anesthesia.trim() || "General",
        room: room.trim() || "OR-1",
        scheduledStart: start,
        scheduledEnd: end,
        priority,
        notes: notes.trim() || undefined,
        createdBy: actorName,
      });

      setPatientName("");
      setProcedure("");
      setSurgeon("");
      setAnesthesia("General");
      setRoom("OR-1");
      setPriority("ELECTIVE");
      setNotes("");
      setStartAt(dateInputValue(Date.now() + 30 * 60_000));
      setEndAt(dateInputValue(Date.now() + 90 * 60_000));
      setSelectedDate(new Date(start).toISOString().slice(0, 10));
      toast.success("Surgical case scheduled.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to schedule case right now.";
      toast.error(message);
    }
  };

  const openCaseEditor = (entry: OrCase) => {
    setEditingCaseId(entry._id);
    setEditPatientName(entry.patientName);
    setEditProcedure(entry.procedure);
    setEditSurgeon(entry.surgeon);
    setEditAnesthesia(entry.anesthesia);
    setEditRoom(entry.room);
    setEditPriority(entry.priority);
    setEditStartAt(dateInputValue(entry.scheduledStart));
    setEditEndAt(dateInputValue(entry.scheduledEnd));
    setEditNotes(entry.notes ?? "");
  };

  const saveCaseEdits = async () => {
    if (!editingCaseId) return;
    const editStartMs = new Date(editStartAt).getTime();
    const editEndMs = new Date(editEndAt).getTime();
    if (!Number.isFinite(editStartMs) || !Number.isFinite(editEndMs) || editEndMs <= editStartMs) {
      toast.error("Please use a valid start/end range.");
      return;
    }

    try {
      await updateCaseDetails({
        caseId: editingCaseId,
        patientName: editPatientName,
        procedure: editProcedure,
        surgeon: editSurgeon,
        anesthesia: editAnesthesia,
        room: editRoom,
        scheduledStart: editStartMs,
        scheduledEnd: editEndMs,
        priority: editPriority,
        notes: editNotes.trim() || undefined,
      });
      setEditingCaseId(null);
      toast.success("Case details updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update case details.";
      toast.error(message);
    }
  };

  const updateCaseStatus = async (caseId: OrCase["_id"], status: CaseStatus) => {
    try {
      await updateStatus({ caseId, status, actorName });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update case status.";
      toast.error(message);
    }
  };

  const removeCase = async (caseId: OrCase["_id"]) => {
    try {
      await removeCaseMutation({ caseId });
      toast.success("Case removed from OR schedule.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to remove case.";
      toast.error(message);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 pt-24 text-slate-900 dark:bg-slate-950/30 dark:text-slate-100 md:p-10 md:pt-28">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 border-b border-slate-200/70 pb-6 dark:border-slate-800/80 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Procedural Throughput
            </p>
            <h1 className="text-4xl font-black italic tracking-tight text-slate-900 dark:text-slate-100">
              OR <span className="text-blue-600">Scheduler</span>
            </h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Centralized board for surgery timing, room allocation, and status flow.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <Clock className="h-4 w-4 text-blue-600" />
            <Label htmlFor="schedule-date" className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              View Date
            </Label>
            <Input
              id="schedule-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-8 w-38 text-[11px] font-bold"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Cases</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-black text-slate-900 dark:text-slate-100">{stats.total}</CardContent>
          </Card>
          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-wider text-slate-500">Active In OR</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-black text-blue-600">{stats.active}</CardContent>
          </Card>
          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-wider text-slate-500">Completed</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-black text-emerald-600">{stats.completed}</CardContent>
          </Card>
          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-wider text-slate-500">Emergent</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-black text-red-600">{stats.emergent}</CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wider">
                <Plus className="h-4 w-4 text-blue-600" /> Schedule New Case
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Patient Name</Label>
                <Input value={patientName} onChange={(event) => setPatientName(event.target.value)} placeholder="e.g., Maria Santos" />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Procedure</Label>
                <Input value={procedure} onChange={(event) => setProcedure(event.target.value)} placeholder="e.g., Laparoscopic Appendectomy" />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Surgeon</Label>
                <Input value={surgeon} onChange={(event) => setSurgeon(event.target.value)} placeholder="e.g., Dr. Priya Menon" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">OR Room</Label>
                  <Input value={room} onChange={(event) => setRoom(event.target.value)} placeholder="OR-1" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Anesthesia</Label>
                  <Input value={anesthesia} onChange={(event) => setAnesthesia(event.target.value)} placeholder="General" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Start</Label>
                  <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">End</Label>
                  <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Priority</Label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as CasePriority)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="ELECTIVE">Elective</option>
                  <option value="URGENT">Urgent</option>
                  <option value="EMERGENT">Emergent</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Equipment notes, team assignment, blood products, special prep..."
                  className="min-h-24"
                />
              </div>

              <Button onClick={addCase} className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" /> Add To OR Board
              </Button>

              {(roomConflictPreview || surgeonConflictPreview) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-700">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wider">Potential conflict</p>
                  {roomConflictPreview && (
                    <p>Room overlap: {roomConflictPreview.room} is booked for {roomConflictPreview.patientName} ({formatTime(roomConflictPreview.scheduledStart)}-{formatTime(roomConflictPreview.scheduledEnd)}).</p>
                  )}
                  {surgeonConflictPreview && (
                    <p>Surgeon overlap: {surgeonConflictPreview.surgeon} is assigned to {surgeonConflictPreview.patientName} ({formatTime(surgeonConflictPreview.scheduledStart)}-{formatTime(surgeonConflictPreview.scheduledEnd)}).</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wider">
                <Filter className="h-4 w-4 text-blue-600" /> OR Board Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Room</Label>
                <select
                  value={roomFilter}
                  onChange={(event) => setRoomFilter(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="ALL">All rooms</option>
                  {roomOptions.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Surgeon</Label>
                <select
                  value={surgeonFilter}
                  onChange={(event) => setSurgeonFilter(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="ALL">All surgeons</option>
                  {surgeonOptions.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wider">
                <Clock className="h-4 w-4 text-blue-600" /> Room Timeline Lanes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dayCases === undefined ? (
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">Loading lanes...</div>
              ) : timelineRooms.length === 0 ? (
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">No cases for current filters.</div>
              ) : (
                <div className="space-y-4">
                  {timelineRooms.map((lane) => (
                    <div key={lane.roomName} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">{lane.roomName}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lane.entries.length} case(s)</p>
                      </div>
                      <div className="space-y-2">
                        {lane.entries.map((entry) => {
                          const startPct = Math.max(0, ((entry.scheduledStart - dayStart) / (dayEnd - dayStart)) * 100);
                          const widthPct = Math.max(6, ((entry.scheduledEnd - entry.scheduledStart) / (dayEnd - dayStart)) * 100);
                          return (
                            <div key={entry._id} className="space-y-1">
                              <div className="relative h-8 rounded-md bg-slate-100 dark:bg-slate-950/60">
                                <div
                                  className="absolute top-1 h-6 rounded-md bg-blue-500/85 px-2 text-[9px] font-black uppercase tracking-wide text-white"
                                  style={{ left: `${startPct}%`, width: `${Math.min(widthPct, 100 - startPct)}%` }}
                                  title={`${entry.patientName} | ${formatTime(entry.scheduledStart)}-${formatTime(entry.scheduledEnd)}`}
                                  onClick={() => openCaseEditor(entry)}
                                >
                                  <span className="block truncate leading-6">{entry.patientName}</span>
                                </div>
                              </div>
                              <p className="text-[10px] font-semibold text-slate-500">
                                {formatTime(entry.scheduledStart)} - {formatTime(entry.scheduledEnd)} | {entry.procedure} | {entry.surgeon}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wider">
                <ClipboardList className="h-4 w-4 text-blue-600" /> Daily OR Board
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dayCases === undefined ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center dark:border-slate-700 dark:bg-slate-950/60">
                  <Activity className="mb-3 h-7 w-7 animate-pulse text-slate-300" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading OR board...</p>
                </div>
              ) : filteredDayCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center dark:border-slate-700 dark:bg-slate-950/60">
                  <Activity className="mb-3 h-7 w-7 text-slate-300" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">No cases scheduled for this date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDayCases.map((entry) => {
                    const isLate =
                      entry.status !== "COMPLETED" &&
                      entry.status !== "CANCELLED" &&
                      nowTs > entry.scheduledEnd;
                    return (
                      <div key={entry._id} className="rounded-2xl border border-slate-200 p-4 transition-colors hover:border-blue-300 dark:border-slate-800" onClick={() => openCaseEditor(entry)}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">{entry.patientName}</p>
                              <Badge className={priorityClass(entry.priority)}>{entry.priority}</Badge>
                              {isLate && (
                                <Badge className="bg-red-100 text-red-700 border-none">
                                  <AlertTriangle className="mr-1 h-3 w-3" /> Delayed
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{entry.procedure}</p>
                            <p className="text-[11px] font-semibold text-slate-500">{entry.surgeon} | {entry.anesthesia} | {entry.room}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge className={statusClass(entry.status)}>{entry.status.replace("_", " ")}</Badge>
                            <select
                              value={entry.status}
                              onChange={(event) => void updateCaseStatus(entry._id, event.target.value as CaseStatus)}
                              onClick={(event) => event.stopPropagation()}
                              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            >
                              <option value="SCHEDULED">Scheduled</option>
                              <option value="IN_ROOM">In Room</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              onClick={(event) => {
                                event.stopPropagation();
                                void removeCase(entry._id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-3 text-[11px] font-semibold text-slate-500 dark:border-slate-800">
                          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatTime(entry.scheduledStart)} - {formatTime(entry.scheduledEnd)}</span>
                          {entry.status === "COMPLETED" && (
                            <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Case complete</span>
                          )}
                          {entry.statusUpdatedAt && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Last status update {formatTime(entry.statusUpdatedAt)}{entry.statusUpdatedBy ? ` by ${entry.statusUpdatedBy}` : ""}
                            </span>
                          )}
                        </div>

                        {entry.notes && (
                          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
                            {entry.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Shared scheduler: cases persist in Convex and are visible across authorized staff sessions.
        </p>
      </div>

      <Dialog open={Boolean(editingCaseId)} onOpenChange={(open) => !open && setEditingCaseId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-wider">Edit OR Case</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Patient Name</Label>
              <Input value={editPatientName} onChange={(event) => setEditPatientName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Procedure</Label>
              <Input value={editProcedure} onChange={(event) => setEditProcedure(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Surgeon</Label>
              <Input value={editSurgeon} onChange={(event) => setEditSurgeon(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Anesthesia</Label>
              <Input value={editAnesthesia} onChange={(event) => setEditAnesthesia(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Room</Label>
              <Input value={editRoom} onChange={(event) => setEditRoom(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Priority</Label>
              <select
                value={editPriority}
                onChange={(event) => setEditPriority(event.target.value as CasePriority)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="ELECTIVE">Elective</option>
                <option value="URGENT">Urgent</option>
                <option value="EMERGENT">Emergent</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Start</Label>
              <Input type="datetime-local" value={editStartAt} onChange={(event) => setEditStartAt(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">End</Label>
              <Input type="datetime-local" value={editEndAt} onChange={(event) => setEditEndAt(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Notes</Label>
            <Textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} className="min-h-24" />
          </div>

          {hasEditConflict && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-700">
              <p className="mb-1 text-[10px] font-black uppercase tracking-wider">Potential conflict</p>
              {editRoomConflictPreview && (
                <p>
                  Room overlap: {editRoomConflictPreview.room} is booked for {editRoomConflictPreview.patientName} ({formatTime(editRoomConflictPreview.scheduledStart)}-{formatTime(editRoomConflictPreview.scheduledEnd)}).
                </p>
              )}
              {editSurgeonConflictPreview && (
                <p>
                  Surgeon overlap: {editSurgeonConflictPreview.surgeon} is assigned to {editSurgeonConflictPreview.patientName} ({formatTime(editSurgeonConflictPreview.scheduledStart)}-{formatTime(editSurgeonConflictPreview.scheduledEnd)}).
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingCaseId(null)}>Cancel</Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => void saveCaseEdits()} disabled={hasEditConflict}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
