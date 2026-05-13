"use client"
import React, { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function ApptTypeManager({ storageKeyPrefix = "clinic" }: { storageKeyPrefix?: string }) {
  const clinicId = storageKeyPrefix
  const types = useQuery(api.primaryCare.listApptTypes, { clinicId }) ?? []
  const createType = useMutation(api.primaryCare.createApptType)
  const removeTypeMut = useMutation(api.primaryCare.removeApptType)
  const [name, setName] = useState("")

  async function addType() {
    if (!name.trim()) return
    await toast.promise(createType({ clinicId, name: name.trim() }), {
      loading: "Adding appointment type...",
      success: "Appointment type added",
      error: (error: any) => error?.message ?? "Failed to add appointment type",
    })
    setName("")
  }

  async function removeType(id: string) {
    await toast.promise(removeTypeMut({ typeId: id as any }), {
      loading: "Removing appointment type...",
      success: "Appointment type removed",
      error: (error: any) => error?.message ?? "Failed to remove appointment type",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appointment Types</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New appt type (e.g. Follow-up)" />
          <Button onClick={addType}>Add</Button>
        </div>
        <div className="space-y-2">
          {types.map((t: any) => (
            <div key={t._id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <div className="flex-1">{t.name}</div>
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => removeType(String(t._id))}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
