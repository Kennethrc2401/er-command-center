"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Home, Cigarette, Wine, ClipboardCheck, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";

export default function PatientCareSidebar({ 
  patientId, 
  encounterId,
  onOpenPatientInfo,
}: { 
  patientId: Id<"patients">; 
  encounterId: Id<"encounters">; 
  onOpenPatientInfo?: () => void;
}) {
  const { actorName, actorRole } = useResolvedActor();
  const social = useQuery(api.socialHistory.getByPatient, { patientId });
  const tasks = useQuery(api.checklists.getByEncounter, { encounterId });
  const toggleTask = useMutation(api.checklists.toggle);
  const createTask = useMutation(api.checklists.create);
  const removeTask = useMutation(api.checklists.remove);
  const clearCompleted = useMutation(api.checklists.clearCompleted);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");

  const checklistSummary = useMemo(() => {
    const total = tasks?.length ?? 0;
    const completed = tasks?.filter((task) => task.completed).length ?? 0;
    const pending = Math.max(0, total - completed);
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, pending, percent };
  }, [tasks]);

  const handleToggle = async (taskId: Id<"checklists">) => {
    try {
      await toggleTask({
        taskId,
        completedBy: actorName,
        completedByRole: actorRole,
      });
      toast.success("Care task updated");
    } catch {
      toast.error("Failed to update task");
    }
  };

  const handleCreateTask = async () => {
    const taskText = newTaskText.trim();
    if (taskText.length < 3) {
      toast.error("Checklist item must be at least 3 characters.");
      return;
    }

    try {
      await createTask({ encounterId, item: taskText });
      setNewTaskText("");
      setAddingTask(false);
      toast.success("Checklist item added.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to add checklist item.";
      toast.error(message);
    }
  };

  const handleRemoveTask = async (taskId: Id<"checklists">) => {
    try {
      await removeTask({ taskId });
      toast.success("Checklist item removed.");
    } catch {
      toast.error("Unable to remove checklist item.");
    }
  };

  const handleClearCompleted = async () => {
    if (checklistSummary.completed === 0) {
      toast.error("No completed tasks to clear.");
      return;
    }

    try {
      const result = await clearCompleted({ encounterId });
      toast.success(`Removed ${result.removedCount} completed task${result.removedCount === 1 ? "" : "s"}.`);
    } catch {
      toast.error("Unable to clear completed tasks.");
    }
  };

  return (
    <div className="space-y-6">
      {/* SOCIAL HISTORY SECTION */}
      <Card className="border-slate-200 shadow-sm bg-white overflow-visible dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="bg-slate-50/50 border-b py-3 flex flex-row flex-wrap items-center justify-between gap-2 dark:bg-slate-900 dark:border-slate-800">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
            Social Determinants
          </CardTitle>
          {onOpenPatientInfo && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenPatientInfo}
              className="h-7 shrink-0 border-slate-300 bg-white px-2.5 text-[9px] font-black uppercase tracking-wide text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-4 space-y-4 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <Home className="h-4 w-4 text-slate-400 mt-0.5 dark:text-slate-500" />
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500">Living Situation</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-100">{social?.livingSituation || "Not Documented"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Cigarette className="h-4 w-4 text-slate-400 mt-0.5 dark:text-slate-500" />
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500">Tobacco Use</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-100">{social?.smokingStatus || "Unknown"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Wine className="h-4 w-4 text-slate-400 mt-0.5 dark:text-slate-500" />
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500">Alcohol Use</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-100">{social?.alcoholUse || "Unknown"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CARE CHECKLIST SECTION */}
      <Card className="border-emerald-100 shadow-md bg-white overflow-visible dark:border-emerald-800/50 dark:bg-slate-900">
        <CardHeader className="bg-emerald-50/50 border-b py-3 flex flex-row flex-wrap items-center justify-between gap-2 dark:bg-emerald-500/10 dark:border-emerald-800/40">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 flex items-center gap-2 dark:text-emerald-300">
            <ClipboardCheck className="h-4 w-4" /> Care Checklist
          </CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearCompleted}
              disabled={checklistSummary.completed === 0}
              className="h-7 border-emerald-200 bg-white text-[9px] font-black uppercase tracking-wide text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Clear Done
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddingTask((prev) => !prev)}
              className="h-7 border-emerald-200 bg-white text-[9px] font-black uppercase tracking-wide text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4 dark:bg-slate-900">
          <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 dark:border-emerald-800/40 dark:bg-emerald-500/10">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Checklist Progress
              </p>
              <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                {checklistSummary.completed}/{checklistSummary.total}
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${checklistSummary.percent}%` }} />
            </div>
            <p className="text-[10px] font-semibold text-emerald-700/80 dark:text-emerald-300/80">
              {checklistSummary.pending} pending task{checklistSummary.pending === 1 ? "" : "s"}
            </p>
          </div>

          {addingTask && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <Input
                value={newTaskText}
                onChange={(event) => setNewTaskText(event.target.value)}
                placeholder="Add a custom care task"
                className="text-xs"
                maxLength={140}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleCreateTask();
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAddingTask(false);
                    setNewTaskText("");
                  }}
                  className="h-7 text-[10px] font-black uppercase"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleCreateTask()}
                  className="h-7 bg-emerald-600 text-[10px] font-black uppercase hover:bg-emerald-700"
                >
                  Add Task
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {tasks?.map((task) => (
              <div key={task._id} className="flex items-center justify-between gap-2 group rounded-lg border border-transparent px-1 py-1 hover:border-slate-200 dark:hover:border-slate-700">
                <div className="flex items-start space-x-3 min-w-0">
                  <Checkbox
                    id={task._id}
                    checked={task.completed}
                  onCheckedChange={() => handleToggle(task._id)}
                  className="border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
                  <div className="min-w-0 space-y-1">
                    <label
                      htmlFor={task._id}
                      className={`text-xs font-bold leading-none transition-colors cursor-pointer truncate block ${
                        task.completed ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-700 dark:text-slate-100"
                      }`}
                    >
                      {task.item}
                    </label>
                    {task.completed && task.completedBy && (
                      <p className="text-[9px] font-semibold text-emerald-700/80 dark:text-emerald-300/80 truncate">
                        Completed by {task.completedBy}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRemoveTask(task._id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400"
                  aria-label="Remove checklist item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {(!tasks || tasks.length === 0) && (
              <p className="text-[10px] text-slate-400 italic text-center py-4 dark:text-slate-500">No tasks assigned for this encounter.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}