"use client"

import React, { useMemo, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type Appointment = {
  _id: string
  patientName: string
  providerId?: string
  roomId?: string
  typeId?: string
  startMs: number
  endMs?: number
  notes?: string
}

type EditForm = {
  patientName: string
  providerId: string
  roomId: string
  typeId: string
  start: string
  end: string
  notes: string
}

function toDateTimeLocal(value: number) {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, "0")
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function parseDateTimeLocal(value: string) {
  return value ? new Date(value).getTime() : undefined
}

export default function Scheduler({ storageKeyPrefix = "clinic" }: { storageKeyPrefix?: string }) {
  const clinicId = storageKeyPrefix
  const apptTypes = useQuery(api.primaryCare.listApptTypes, { clinicId }) ?? []
  const appointments = useQuery(api.primaryCare.listAppointments, { clinicId }) ?? []
  const providers = useQuery(api.users.getActiveRoster, {}) ?? []
  const rooms = useQuery(api.primaryCare.listRooms, { clinicId }) ?? []

  const createAppointment = useMutation(api.primaryCare.createAppointment)
  const deleteAppointment = useMutation(api.primaryCare.deleteAppointment)
  const updateAppointment = useMutation(api.primaryCare.updateAppointment)
  const moveAppointmentMut = useMutation(api.primaryCare.moveAppointment)
  const createApptType = useMutation(api.primaryCare.createApptType)
  const removeApptType = useMutation(api.primaryCare.removeApptType)
  const createRoom = useMutation(api.primaryCare.createRoom)
  const removeRoom = useMutation(api.primaryCare.removeRoom)

  const [patientName, setPatientName] = useState("")
  const [providerId, setProviderId] = useState("")
  const [typeId, setTypeId] = useState("")
  const [roomId, setRoomId] = useState("")
  const [start, setStart] = useState("")
  const [notes, setNotes] = useState("")

  const [newTypeName, setNewTypeName] = useState("")
  const [newRoomName, setNewRoomName] = useState("")

  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    patientName: "",
    providerId: "",
    roomId: "",
    typeId: "",
    start: "",
    end: "",
    notes: "",
  })

  const apptsByDate = useMemo(() => (appointments as Appointment[]).slice().sort((a, b) => a.startMs - b.startMs), [appointments])

  function typeName(id?: string) {
    const t = (apptTypes as any[]).find((x) => String(x._id) === String(id))
    return t ? t.name : "Unknown"
  }

  function providerName(id?: string) {
    const p = (providers as any[]).find((x) => String(x._id) === String(id))
    return p ? p.name : "—"
  }

  function roomName(id?: string) {
    const r = (rooms as any[]).find((x) => String(x._id) === String(id))
    return r ? r.name : "—"
  }

  function resetCreateForm() {
    setPatientName("")
    setProviderId("")
    setTypeId("")
    setRoomId("")
    setStart("")
    setNotes("")
  }

  function openEdit(appt: Appointment) {
    setEditingId(appt._id)
    setEditForm({
      patientName: appt.patientName ?? "",
      providerId: appt.providerId ? String(appt.providerId) : "",
      roomId: appt.roomId ? String(appt.roomId) : "",
      typeId: appt.typeId ? String(appt.typeId) : "",
      start: toDateTimeLocal(appt.startMs),
      end: appt.endMs ? toDateTimeLocal(appt.endMs) : "",
      notes: appt.notes ?? "",
    })
    setEditOpen(true)
  }

  async function addAppointment() {
    if (!patientName.trim() || !typeId || !start) return
    const startMs = parseDateTimeLocal(start)
    if (startMs === undefined) return
    const promise = createAppointment({
      clinicId,
      patientName: patientName.trim(),
      providerId: providerId || undefined,
      roomId: roomId || undefined,
      typeId,
      startMs,
      notes: notes || undefined,
    })
    await toast.promise(promise, {
      loading: "Creating appointment...",
      success: "Appointment created",
      error: (error: any) => error?.message ?? "Failed to create appointment",
    })
    resetCreateForm()
  }

  async function saveEdit() {
    if (!editingId || !editForm.patientName.trim() || !editForm.typeId || !editForm.start) return
    const startMs = parseDateTimeLocal(editForm.start)
    const endMs = editForm.end ? parseDateTimeLocal(editForm.end) : undefined
    if (startMs === undefined) return
    const promise = updateAppointment({
      apptId: editingId as any,
      patientName: editForm.patientName.trim(),
      providerId: editForm.providerId || undefined,
      roomId: editForm.roomId || undefined,
      typeId: editForm.typeId as any,
      startMs,
      endMs,
      notes: editForm.notes || undefined,
    })
    await toast.promise(promise, {
      loading: "Saving changes...",
      success: "Appointment updated",
      error: (error: any) => error?.message ?? "Failed to update appointment",
    })
    setEditOpen(false)
    setEditingId(null)
  }

  async function removeAppointment(id: string) {
    await toast.promise(deleteAppointment({ apptId: id as any }), {
      loading: "Deleting appointment...",
      success: "Appointment deleted",
      error: (error: any) => error?.message ?? "Delete failed",
    })
  }

  async function moveAppointment(id: string, days: number) {
    await toast.promise(moveAppointmentMut({ apptId: id as any, deltaMs: days * 24 * 60 * 60 * 1000 }), {
      loading: "Moving appointment...",
      success: "Appointment moved",
      error: (error: any) => error?.message ?? "Move failed",
    })
  }

  async function addApptType() {
    if (!newTypeName.trim()) return
    await toast.promise(createApptType({ clinicId, name: newTypeName.trim() }), {
      loading: "Creating type...",
      success: "Appointment type added",
      error: (error: any) => error?.message ?? "Failed to add type",
    })
    setNewTypeName("")
  }

  async function removeType(id: string) {
    await toast.promise(removeApptType({ typeId: id as any }), {
      loading: "Removing type...",
      success: "Appointment type removed",
      error: (error: any) => error?.message ?? "Failed to remove type",
    })
  }

  async function addRoom() {
    if (!newRoomName.trim()) return
    await toast.promise(createRoom({ clinicId, name: newRoomName.trim(), capacity: 1 }), {
      loading: "Creating room...",
      success: "Room added",
      error: (error: any) => error?.message ?? "Failed to add room",
    })
    setNewRoomName("")
  }

  async function removeRoomById(id: string) {
    await toast.promise(removeRoom({ roomId: id as any }), {
      loading: "Removing room...",
      success: "Room removed",
      error: (error: any) => error?.message ?? "Failed to remove room",
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Create Appointment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input placeholder="Patient name" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="h-10 rounded-md border px-3 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              <option value="">-- Select type --</option>
              {(apptTypes as any[]).map((t) => (
                <option key={t._id} value={String(t._id)}>{t.name}</option>
              ))}
            </select>
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="h-10 rounded-md border px-3 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              <option value="">-- Provider (optional) --</option>
              {(providers as any[]).map((p: any) => (
                <option key={p._id} value={String(p._id)}>{p.name} ({p.role})</option>
              ))}
            </select>
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="h-10 rounded-md border px-3 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              <option value="">-- Room (optional) --</option>
              {(rooms as any[]).map((r: any) => (
                <option key={r._id} value={String(r._id)}>{r.name}</option>
              ))}
            </select>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              className="min-h-24 rounded-md border px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={addAppointment}>Add</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appointments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {apptsByDate.length === 0 && <p className="text-sm text-muted-foreground">No appointments yet.</p>}
            {apptsByDate.map((a) => (
              <div key={String(a._id)} className="rounded-lg border bg-background p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {a.patientName} <span className="text-xs text-muted-foreground">— {typeName(a.typeId)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {providerName(a.providerId)} {a.roomId ? `· ${roomName(a.roomId)}` : ""}
                    </div>
                    <div className="text-sm text-muted-foreground">{new Date(a.startMs).toLocaleString()}</div>
                    {a.notes && <div className="whitespace-pre-wrap text-sm">{a.notes}</div>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(a)}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => removeAppointment(String(a._id))}>Delete</Button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => moveAppointment(String(a._id), -1)}>◀</Button>
                      <Button variant="outline" size="sm" onClick={() => moveAppointment(String(a._id), 1)}>▶</Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Appointment Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="Add type" />
              <Button onClick={addApptType}>Add</Button>
            </div>
            <div className="space-y-2">
              {(apptTypes as any[]).map((t) => (
                <div key={String(t._id)} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{t.name}</span>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => removeType(String(t._id))}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rooms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Add room" />
              <Button onClick={addRoom}>Add</Button>
            </div>
            <div className="space-y-2">
              {(rooms as any[]).map((room) => (
                <div key={String(room._id)} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{room.name}</span>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => removeRoomById(String(room._id))}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </aside>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Appointment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Input placeholder="Patient name" value={editForm.patientName} onChange={(e) => setEditForm((prev) => ({ ...prev, patientName: e.target.value }))} />
            <select value={editForm.typeId} onChange={(e) => setEditForm((prev) => ({ ...prev, typeId: e.target.value }))} className="h-10 rounded-md border px-3 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              <option value="">-- Select type --</option>
              {(apptTypes as any[]).map((t) => (
                <option key={t._id} value={String(t._id)}>{t.name}</option>
              ))}
            </select>
            <select value={editForm.providerId} onChange={(e) => setEditForm((prev) => ({ ...prev, providerId: e.target.value }))} className="h-10 rounded-md border px-3 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              <option value="">-- Provider (optional) --</option>
              {(providers as any[]).map((p: any) => (
                <option key={p._id} value={String(p._id)}>{p.name} ({p.role})</option>
              ))}
            </select>
            <select value={editForm.roomId} onChange={(e) => setEditForm((prev) => ({ ...prev, roomId: e.target.value }))} className="h-10 rounded-md border px-3 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              <option value="">-- Room (optional) --</option>
              {(rooms as any[]).map((r: any) => (
                <option key={r._id} value={String(r._id)}>{r.name}</option>
              ))}
            </select>
            <Input type="datetime-local" value={editForm.start} onChange={(e) => setEditForm((prev) => ({ ...prev, start: e.target.value }))} />
            <Input type="datetime-local" value={editForm.end} onChange={(e) => setEditForm((prev) => ({ ...prev, end: e.target.value }))} />
            <textarea value={editForm.notes} onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))} className="min-h-24 rounded-md border px-3 py-2 text-sm" placeholder="Notes" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
