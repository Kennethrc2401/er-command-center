"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { DialogTitle } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { 
  Search, Activity, Beaker, BrainCircuit, LayoutDashboard,
  FileText, Home, Info, ShieldCheck, FolderOpen, ClipboardList, Sparkles, BookOpen
} from "lucide-react";

type CommandBarProps = {
  setTab?: (tab: string) => void;
  onPatientAiToolSelect?: (tool: "differential" | "handoff" | "denial") => void;
};

export default function CommandBar({ setTab = () => {}, onPatientAiToolSelect }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Mac: Cmd+K  |  Windows/Linux: Ctrl+/  (Ctrl+K is owned by Chrome's address bar)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const triggered = isMac
        ? e.key === "k" && e.metaKey
        : e.key === "/" && e.ctrlKey;
      if (triggered) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    command();
    setOpen(false);
  };

  const openPatientAiTool = (tool: "differential" | "handoff" | "denial") => {
    if (onPatientAiToolSelect) {
      onPatientAiToolSelect(tool);
      return;
    }
    router.push(`/dashboard/ai-tools?tool=${tool}`);
  };

  return (
    <Command.Dialog 
      open={open} 
      onOpenChange={setOpen} 
      label="Global Command Menu"
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-100 max-w-[90vw] bg-white rounded-[2rem] border shadow-2xl z-50 overflow-hidden animate-in zoom-in-95"
    >
      <VisuallyHidden.Root>
        <DialogTitle>Global Command Menu</DialogTitle>
      </VisuallyHidden.Root>
      <div className="flex items-center border-b p-4">
        <Search className="mr-2 h-4 w-4 text-slate-400" />
        <Command.Input 
          placeholder="Search clinical actions..." 
          className="flex-1 outline-none text-sm font-bold uppercase tracking-widest"
        />
        <span className="ml-2 hidden sm:flex items-center gap-0.5 text-[9px] font-black text-slate-300 uppercase">
          <kbd className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-400">Ctrl</kbd>
          <span>+</span>
          <kbd className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-400">/</kbd>
        </span>
      </div>

      <Command.List className="p-2 max-h-75 overflow-y-auto">
        <Command.Empty className="p-4 text-center text-[10px] font-black uppercase text-slate-400">
          No clinical actions found.
        </Command.Empty>

        <Command.Group heading="Go To" className="px-2 py-2 text-[9px] font-black uppercase text-slate-400 tracking-widest">
          <Command.Item onSelect={() => runCommand(() => router.push("/dashboard/triage"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <LayoutDashboard className="h-4 w-4 text-blue-500" /> Triage Board
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/dashboard/faxes"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <FileText className="h-4 w-4 text-slate-500" /> Fax Center
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/dashboard/or-scheduler"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <ClipboardList className="h-4 w-4 text-indigo-500" /> OR Scheduler
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/dashboard/ai-tools"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <BrainCircuit className="h-4 w-4 text-cyan-600" /> AI Tools Hub
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/dashboard/admin"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Admin Suite
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/dashboard/admin/insurance"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <FileText className="h-4 w-4 text-emerald-600" /> Insurance Ops Hub
          </Command.Item>
          <Command.Item
            onSelect={() =>
              runCommand(() => window.dispatchEvent(new CustomEvent("open-global-scribe")))
            }
            className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700"
          >
            <Sparkles className="h-4 w-4 text-blue-500" /> Global AI Scribe
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/dashboard/study-notes"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <BookOpen className="h-4 w-4 text-purple-500" /> Study Notes
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Patient View" className="px-2 py-2 text-[9px] font-black uppercase text-slate-400 tracking-widest">
          <Command.Item onSelect={() => runCommand(() => setTab("info"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <Info className="h-4 w-4 text-cyan-600" /> Open Patient Info
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => setTab("vitals"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <Activity className="h-4 w-4 text-emerald-500" /> Go to Vitals Trend
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => setTab("labs"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <Beaker className="h-4 w-4 text-blue-500" /> View Lab Results
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => setTab("documents"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <FolderOpen className="h-4 w-4 text-indigo-500" /> Open Documents Hub
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => setTab("discharge"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <Home className="h-4 w-4 text-emerald-600" /> Prepare Discharge
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => openPatientAiTool("differential"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <BrainCircuit className="h-4 w-4 text-cyan-600" /> AI Differential Copilot
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => openPatientAiTool("handoff"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <Sparkles className="h-4 w-4 text-blue-500" /> AI Handoff Compressor
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => openPatientAiTool("denial"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <ShieldCheck className="h-4 w-4 text-amber-500" /> AI Denial Risk Copilot
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}