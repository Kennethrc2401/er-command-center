"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { 
  Search, Activity, Beaker, Scan, 
  FileText, Home, ClipboardCheck 
} from "lucide-react";

export default function CommandBar({ setTab }: { setTab: (tab: string) => void }) {
  const [open, setOpen] = useState(false);

  // Toggle the menu when Cmd+K or Ctrl+K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
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

  return (
    <Command.Dialog 
      open={open} 
      onOpenChange={setOpen} 
      label="Global Command Menu"
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-w-[90vw] bg-white rounded-[2rem] border shadow-2xl z-50 overflow-hidden animate-in zoom-in-95"
    >
      <div className="flex items-center border-b p-4">
        <Search className="mr-2 h-4 w-4 text-slate-400" />
        <Command.Input 
          placeholder="Search clinical actions..." 
          className="flex-1 outline-none text-sm font-bold uppercase tracking-widest"
        />
      </div>

      <Command.List className="p-2 max-h-[300px] overflow-y-auto">
        <Command.Empty className="p-4 text-center text-[10px] font-black uppercase text-slate-400">
          No clinical actions found.
        </Command.Empty>

        <Command.Group heading="Navigation" className="px-2 py-2 text-[9px] font-black uppercase text-slate-400 tracking-widest">
          <Command.Item onSelect={() => runCommand(() => setTab("vitals"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <Activity className="h-4 w-4 text-emerald-500" /> Go to Vitals Trend
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => setTab("labs"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <Beaker className="h-4 w-4 text-blue-500" /> View Lab Results
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => setTab("discharge"))} className="flex items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer gap-3 text-xs font-bold text-slate-700">
            <Home className="h-4 w-4 text-emerald-600" /> Prepare Discharge
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}