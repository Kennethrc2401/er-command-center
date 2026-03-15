"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Archive, CheckCircle, Clock, Download, FileText, Inbox, Search, Send, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import FaxLinkerModal from "@/components/faxes/faxLinker";
import OutboundFaxComposer from "@/components/faxes/OutboundFaxComposer";

export default function FaxCenter() {
  const [activeTab, setActiveTab] = useState("received");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFax, setSelectedFax] = useState<Doc<"faxes"> | null>(null);

  const activeFaxes = useQuery(api.faxes.getInbox, { status: activeTab });
  const updateStatus = useMutation(api.faxes.updateStatus);
  const simulateNewFax = useMutation(api.faxes.simulateIncoming);

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
      pages: Math.floor(Math.random() * 3) + 1,
    });
    toast.info("Incoming Fax Detected", {
      description: "Source: Teaneck Radiology (201-555-0199)",
      icon: <FileText className="h-4 w-4 text-blue-500" />,
    });
  };

  const filteredFaxes = activeFaxes?.filter((fax) =>
    [fax.from ?? "", fax.subject ?? "", fax.recipientName ?? "", fax.toFaxNumber ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <header className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 text-white shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,rgba(59,130,246,0.2),transparent_45%)]" />
        <div className="pointer-events-none absolute -right-6 -top-8 opacity-10 sm:-right-2 sm:-top-6">
          <FileText className="h-24 w-24 sm:h-28 sm:w-28 lg:h-32 lg:w-32" />
        </div>

        <div className="relative z-10 px-7 py-8 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400">Interoperability Active</span>
          </div>

          <h1 className="mt-4 text-[1.9rem] font-black uppercase italic leading-[1.02] tracking-tight sm:text-4xl lg:text-5xl">
            Nexus <span className="text-blue-500">Fax Center</span>
          </h1>

          <p className="mt-4 max-w-2xl text-xs font-bold leading-relaxed text-slate-300 sm:text-[13px]">
            AdvancedMD simulation for inbound records, outbound discharge packets, consult routing, and document intake across the ER workflow.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:flex lg:justify-end lg:gap-4">
            <button
              onClick={handleSimulate}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-black uppercase text-[10px] tracking-widest transition-all hover:bg-white/10 lg:w-auto lg:flex-none"
            >
              Simulate Incoming
            </button>
            <OutboundFaxComposer triggerLabel="Compose Outbound" buttonClassName="w-full rounded-2xl bg-blue-600 px-6 py-3 font-black uppercase text-[10px] tracking-widest text-white shadow-lg shadow-blue-900 transition-all hover:bg-blue-500 lg:w-auto lg:flex-none" />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <div className="space-y-2">
          <FaxNavItem icon={Inbox} label="Inbox" active={activeTab === "received"} onClick={() => setActiveTab("received")} />
          <FaxNavItem icon={CheckCircle} label="Processed" active={activeTab === "processed"} onClick={() => setActiveTab("processed")} />
          <FaxNavItem icon={Send} label="Sent" active={activeTab === "sent"} onClick={() => setActiveTab("sent")} />
          <FaxNavItem icon={Archive} label="Archived" active={activeTab === "archived"} onClick={() => setActiveTab("archived")} />
          <FaxNavItem icon={Trash2} label="Trash" active={activeTab === "trash"} onClick={() => setActiveTab("trash")} />
        </div>

        <div className="space-y-4 lg:col-span-3">
          <div className="group relative">
            <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search faxes by sender, recipient, subject, or number..."
              className="w-full rounded-[2rem] border-2 border-slate-100 bg-white p-5 pl-14 font-bold text-slate-900 outline-none transition-all shadow-sm focus:border-blue-500"
            />
          </div>

          <div className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-sm">
            {!filteredFaxes || filteredFaxes.length === 0 ? (
              <div className="space-y-4 p-20 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
                  <Inbox className="h-8 w-8 text-slate-200" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Queue is empty</p>
              </div>
            ) : (
              filteredFaxes.map((fax) => {
                const isOutbound = fax.direction === "outbound";
                return (
                  <div key={fax._id} className="group flex items-center justify-between border-b border-slate-50 p-8 transition-all hover:bg-slate-50/80">
                    <div className="flex items-center gap-6">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg transition-all group-hover:bg-blue-600">
                        <FileText className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">
                          {isOutbound ? fax.recipientName ?? fax.toFaxNumber ?? "Outbound Recipient" : fax.from ?? "Unknown Sender"}
                        </h3>
                        <div className="mt-1 flex items-center gap-3">
                          <p className="text-xs font-bold text-slate-500">{fax.subject ?? "Untitled Document"}</p>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">{fax.pages ?? 0} Pages</p>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {isOutbound ? fax.toFaxNumber ?? "Outbound" : fax.from ?? "Inbound"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="mr-6 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                        <Clock className="h-3 w-3" />
                        {new Date(fax.timestamp ?? fax._creationTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>

                      <FaxActionBtn icon={Download} tooltip="Download PDF" onClick={() => toast.success("Downloading clinical document...")} />

                      {!isOutbound && activeTab === "received" && (
                        <FaxActionBtn icon={Share2} tooltip="Link to Chart" onClick={() => setSelectedFax(fax)} />
                      )}

                      {activeTab !== "sent" && (
                        <FaxActionBtn
                          icon={activeTab === "trash" ? CheckCircle : Trash2}
                          variant={activeTab === "trash" ? "success" : "danger"}
                          tooltip={activeTab === "trash" ? "Restore" : "Move to Trash"}
                          onClick={() => handleUpdateStatus(fax._id, activeTab === "trash" ? "received" : "trash")}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {selectedFax && (
        <FaxLinkerModal
          fax={{
            _id: selectedFax._id,
            subject: selectedFax.subject ?? "Untitled Document",
          }}
          onClose={() => setSelectedFax(null)}
        />
      )}
    </div>
  );
}

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
      className={`flex w-full items-center gap-4 rounded-2xl border-2 p-5 transition-all ${
        active ? "border-blue-100 bg-white text-blue-600 shadow-sm" : "border-transparent text-slate-500 hover:bg-slate-50"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "text-blue-600" : "text-slate-400"}`} />
      <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
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
    danger: "border-red-50 text-red-400 hover:bg-red-50 hover:text-red-600",
    success: "border-emerald-50 text-emerald-400 hover:bg-emerald-50 hover:text-emerald-600",
    default: "border-slate-50 text-slate-400 hover:bg-white hover:text-blue-600 hover:shadow-md",
  };

  return (
    <div className="group/btn relative">
      <button onClick={onClick} className={`rounded-xl border p-3.5 transition-all ${styles[variant]}`}>
        <Icon className="h-4 w-4" />
      </button>
      {tooltip && (
        <span className="pointer-events-none absolute -top-10 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-white opacity-0 transition-opacity group-hover/btn:opacity-100">
          {tooltip}
        </span>
      )}
    </div>
  );
}
