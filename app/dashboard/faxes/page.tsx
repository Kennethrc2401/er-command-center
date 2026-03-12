"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { 
  FileText, 
  Download, 
  Trash2, 
  Share2, 
  Send, 
  Inbox, 
  CheckCircle,
  Search,
  Clock,
  Archive
} from "lucide-react";
import { toast } from "sonner";
import FaxLinkerModal from "@/components/faxes/faxLinker";

export default function FaxCenter() {
  const [activeTab, setActiveTab] = useState("received");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFax, setSelectedFax] = useState<Doc<"faxes"> | null>(null);

  // 🛰️ Real-time Convex Queries
  const activeFaxes = useQuery(api.faxes.getInbox, { status: activeTab });
  const updateStatus = useMutation(api.faxes.updateStatus);
  const simulateNewFax = useMutation(api.faxes.simulateIncoming);

  // 🛠️ Action Handlers
  const handleUpdateStatus = async (id: Id<"faxes">, newStatus: string) => {
    try {
      await updateStatus({ id, status: newStatus });
      toast.success(`Document moved to ${newStatus}`);
    } catch {
      toast.error("Failed to update document status");
    }
  };

  const handleSimulate = async () => {
    await simulateNewFax({
      from: "Teaneck Radiology",
      subject: `STAT X-Ray: ${Math.floor(Math.random() * 1000)}`,
      pages: Math.floor(Math.random() * 3) + 1
    });
    toast.info("Incoming Fax Detected", { 
      description: "Source: Teaneck Radiology (201-555-0199)",
      icon: <FileText className="h-4 w-4 text-blue-500" />
    });
  };

  const filteredFaxes = activeFaxes?.filter(f => 
    f.from.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* 📁 COMMAND HEADER */}
      <header className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 text-white shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,rgba(59,130,246,0.2),transparent_45%)]" />
        <div className="pointer-events-none absolute -right-6 -top-8 opacity-10 sm:-right-2 sm:-top-6">
          <FileText className="h-24 w-24 sm:h-28 sm:w-28 lg:h-32 lg:w-32" />
        </div>

        <div className="relative z-10 px-7 py-8 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400">Interoperability Active</span>
          </div>

          <h1 className="mt-4 text-[1.9rem] font-black uppercase italic leading-[1.02] tracking-tight sm:text-4xl lg:text-5xl">
            Nexus <span className="text-blue-500">Fax Center</span>
          </h1>

          <p className="mt-4 max-w-2xl text-xs font-bold leading-relaxed text-slate-300 sm:text-[13px]">
            AdvancedMD Simulation: Digital document management and HIPAA-compliant routing for Hackensack Meridian interoperability.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:flex lg:justify-end lg:gap-4">
            <button 
              onClick={handleSimulate}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-black uppercase text-[10px] tracking-widest transition-all hover:bg-white/10"
            >
              Simulate Incoming
            </button>
            <button 
              onClick={() => toast.info("Outbound composer opening...")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-900 transition-all hover:bg-blue-500"
            >
              <Send className="h-4 w-4" /> Compose Outbound
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* 📑 NAVIGATION */}
        <div className="space-y-2">
          <FaxNavItem icon={Inbox} label="Inbox" active={activeTab === "received"} onClick={() => setActiveTab("received")} />
          <FaxNavItem icon={CheckCircle} label="Processed" active={activeTab === "processed"} onClick={() => setActiveTab("processed")} />
          <FaxNavItem icon={Archive} label="Archived" active={activeTab === "archived"} onClick={() => setActiveTab("archived")} />
          <FaxNavItem icon={Trash2} label="Trash" active={activeTab === "trash"} onClick={() => setActiveTab("trash")} />
        </div>

        {/* 📨 DOCUMENT FEED */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search faxes by sender or subject..." 
              className="w-full bg-white border-2 border-slate-100 p-5 pl-14 rounded-[2rem] font-bold text-slate-900 focus:border-blue-500 outline-none transition-all shadow-sm"
            />
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            {!filteredFaxes || filteredFaxes.length === 0 ? (
              <div className="p-20 text-center space-y-4">
                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <Inbox className="h-8 w-8 text-slate-200" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Queue is empty</p>
              </div>
            ) : (
              filteredFaxes.map((fax) => (
                <div key={fax._id} className="group flex items-center justify-between p-8 border-b border-slate-50 hover:bg-slate-50/80 transition-all">
                  <div className="flex items-center gap-6">
                    <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:bg-blue-600 transition-all">
                      <FileText className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 uppercase text-sm tracking-tight">{fax.from}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs font-bold text-slate-500">{fax.subject}</p>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{fax.pages} Pages</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-300 mr-6 uppercase tracking-widest">
                      <Clock className="h-3 w-3" />
                      {new Date(fax.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    
                    <FaxActionBtn 
                      icon={Download} 
                      tooltip="Download PDF" 
                      onClick={() => toast.success("Downloading clinical document...")} 
                    />
                    
                    {activeTab === "received" && (
                      <FaxActionBtn 
                        icon={Share2} 
                        tooltip="Link to Chart" 
                        onClick={() => setSelectedFax(fax)} 
                      />
                    )}

                    <FaxActionBtn 
                      icon={activeTab === "trash" ? CheckCircle : Trash2} 
                      variant={activeTab === "trash" ? "success" : "danger"} 
                      tooltip={activeTab === "trash" ? "Restore" : "Move to Trash"}
                      onClick={() => handleUpdateStatus(fax._id, activeTab === "trash" ? "received" : "trash")} 
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 🔗 MODAL OVERLAYS */}
      {selectedFax && (
        <FaxLinkerModal 
          fax={selectedFax} 
          onClose={() => setSelectedFax(null)} 
        />
      )}
    </div>
  );
}

// --- Sub-Components ---

interface FaxNavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}

function FaxNavItem({ icon: Icon, label, active, onClick }: FaxNavItemProps) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all border-2 ${
        active 
          ? "bg-white text-blue-600 border-blue-100 shadow-sm" 
          : "text-slate-500 hover:bg-slate-50 border-transparent"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "text-blue-600" : "text-slate-400"}`} />
      <span className="font-black uppercase text-[10px] tracking-[0.2em]">{label}</span>
    </button>
  );
}

interface FaxActionBtnProps {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "default" | "danger" | "success";
  tooltip?: string;
}

function FaxActionBtn({ icon: Icon, onClick, variant = "default", tooltip }: FaxActionBtnProps) {
  const styles = {
    danger: "border-red-50 hover:bg-red-50 text-red-400 hover:text-red-600",
    success: "border-emerald-50 hover:bg-emerald-50 text-emerald-400 hover:text-emerald-600",
    default: "border-slate-50 hover:bg-white text-slate-400 hover:text-blue-600 hover:shadow-md"
  };

  return (
    <div className="relative group/btn">
      <button 
        onClick={onClick}
        className={`p-3.5 rounded-xl transition-all border ${styles[variant as keyof typeof styles]}`}
      >
        <Icon className="h-4 w-4" />
      </button>
      {tooltip && (
        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-black uppercase py-1 px-2 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none whitespace-nowrap tracking-widest z-50">
          {tooltip}
        </span>
      )}
    </div>
  );
}