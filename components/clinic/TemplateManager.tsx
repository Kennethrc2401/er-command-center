"use client"
import React, { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function TemplateManager({ storageKeyPrefix = "clinic" }: { storageKeyPrefix?: string }) {
  const clinicId = storageKeyPrefix
  const templates = useQuery(api.primaryCare.listTemplates, { clinicId }) ?? []
  const createTemplate = useMutation(api.primaryCare.createTemplate)
  const updateTemplate = useMutation(api.primaryCare.updateTemplate)
  const deleteTemplate = useMutation(api.primaryCare.deleteTemplate)

  const [name, setName] = useState("")
  const [content, setContent] = useState("")
  const [drafts, setDrafts] = useState<Record<string, { name: string; content: string }>>({})

  async function add() {
    if (!name.trim()) return
    await toast.promise(createTemplate({ clinicId, name: name.trim(), content }), {
      loading: "Creating template...",
      success: "Template created",
      error: (error: any) => error?.message ?? "Failed to create template",
    })
    setName("")
    setContent("")
  }

  async function remove(id: string) {
    await toast.promise(deleteTemplate({ templateId: id as any }), {
      loading: "Deleting template...",
      success: "Template deleted",
      error: (error: any) => error?.message ?? "Failed to delete template",
    })
  }

  async function doUpdate(id: string, partial: { name?: string; content?: string }) {
    await toast.promise(updateTemplate({ templateId: id as any, ...partial }), {
      loading: "Updating template...",
      success: "Template updated",
      error: (error: any) => error?.message ?? "Failed to update template",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Note Templates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" />
          <Button onClick={add}>Create</Button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Template content"
          rows={4}
          className="min-h-28 w-full rounded-md border px-3 py-2 text-sm"
        />
        <div className="space-y-3">
          {templates.map((t: any) => (
            <div key={t._id} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <strong>Template</strong>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const draft = drafts[String(t._id)] ?? { name: t.name, content: t.content }
                      void doUpdate(String(t._id), { name: draft.name, content: draft.content })
                    }}
                  >
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => remove(String(t._id))}>
                    Delete
                  </Button>
                </div>
              </div>
              <Input
                value={drafts[String(t._id)]?.name ?? t.name}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [String(t._id)]: {
                      name: e.target.value,
                      content: prev[String(t._id)]?.content ?? t.content,
                    },
                  }))
                }
                placeholder="Template name"
              />
              <textarea
                value={drafts[String(t._id)]?.content ?? t.content}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [String(t._id)]: {
                      name: prev[String(t._id)]?.name ?? t.name,
                      content: e.target.value,
                    },
                  }))
                }
                rows={5}
                className="min-h-32 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Template content"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
