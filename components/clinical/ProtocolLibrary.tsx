"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { PROTOCOL_LIBRARY, Protocol } from "@/lib/hooks/protocols";
import { BookOpen, Bolt, ChevronRight, Pin, Search } from "lucide-react";
import { toast } from "sonner";

interface ProtocolLibraryProps {
  encounterId?: Id<"encounters">;
  patientId?: Id<"patients">;
  activatedBy?: string;
  source?: "patient_chart" | "training";
}

export default function ProtocolLibrary({ encounterId, patientId, activatedBy, source = "patient_chart" }: ProtocolLibraryProps) {
  const [search, setSearch] = useState("");
  const [activeProtocol, setActiveProtocol] = useState<Protocol | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<"All" | Protocol["category"]>("All");
  const [selectedTag, setSelectedTag] = useState<"All" | Protocol["tags"][number]>("All");
  const activateProtocolBundle = useMutation(api.workflow.activateProtocolBundle);
  const activations = useQuery(api.workflow.getProtocolActivationsByEncounter, encounterId ? { encounterId } : "skip");

  const categoryOptions = useMemo(
    () => ["All", ...Array.from(new Set(PROTOCOL_LIBRARY.map((protocol) => protocol.category)))],
    []
  );
  const tagOptions = useMemo(
    () => ["All", ...Array.from(new Set(PROTOCOL_LIBRARY.flatMap((protocol) => protocol.tags))).sort()],
    []
  );

  const filteredProtocols = useMemo(() => {
    const query = search.trim().toLowerCase();
    return PROTOCOL_LIBRARY.filter((protocol) => {
      const categoryMatch = selectedCategory === "All" || protocol.category === selectedCategory;
      const tagMatch = selectedTag === "All" || protocol.tags.includes(selectedTag);
      const searchMatch =
        query.length === 0 ||
        protocol.title.toLowerCase().includes(query) ||
        protocol.steps.some((step) => step.toLowerCase().includes(query)) ||
        protocol.tags.some((tag) => tag.toLowerCase().includes(query));

      return categoryMatch && tagMatch && searchMatch;
    });
  }, [search, selectedCategory, selectedTag]);

  const visibleActiveProtocol = useMemo(() => {
    if (!activeProtocol) return null;
    return filteredProtocols.some((protocol) => protocol.id === activeProtocol.id) ? activeProtocol : null;
  }, [activeProtocol, filteredProtocols]);

  const activeProtocolIds = new Set((activations ?? []).filter((item) => item.status === "active").map((item) => item.protocolId));
  const canActivate = Boolean(encounterId && patientId && activatedBy);

  const handleActivate = async (protocol: Protocol) => {
    if (!encounterId || !patientId || !activatedBy) {
      toast.error("Protocol activation is only available from a live encounter.");
      return;
    }

    try {
      await activateProtocolBundle({
        encounterId,
        patientId,
        protocolId: protocol.id,
        protocolTitle: protocol.title,
        activatedBy,
        source,
      });
      toast.success(`${protocol.title} activated`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to activate protocol.";
      toast.error(message);
    }
  };

  return (
    <div className="flex h-full min-h-96 flex-col rounded-[2.5rem] border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="mb-6 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Standard Protocols</span>
        </div>
        {canActivate && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            Live Activation Enabled
          </span>
        )}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 dark:text-slate-600" />
        <input
          placeholder="Search protocols, tags, or steps..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-3 pl-10 text-xs font-bold outline-none transition-all focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2 px-1">
        {categoryOptions.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category as "All" | Protocol["category"])}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition-all ${
              selectedCategory === category
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-slate-50 text-slate-500 hover:border-blue-200 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2 px-1">
        {tagOptions.map((tag) => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag as "All" | Protocol["tags"][number])}
            className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide transition-all ${
              selectedTag === tag
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-slate-200 bg-white text-slate-400 hover:border-amber-200 hover:text-amber-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 pr-1 sm:pr-2">
        {!visibleActiveProtocol ? (
          <>
            {filteredProtocols.length === 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">No protocols found</p>
                <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">Try clearing filters or searching a different term.</p>
              </div>
            )}
            {filteredProtocols.map((protocol) => (
              <button
                key={protocol.id}
                onClick={() => setActiveProtocol(protocol)}
                className="group flex w-full items-center justify-between rounded-2xl border border-transparent p-4 text-left transition-all hover:border-slate-100 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-950/60"
              >
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-black uppercase tracking-wide text-blue-500">{protocol.category}</p>
                    {activeProtocolIds.has(protocol.id) && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white">Active</span>
                    )}
                  </div>
                  <p className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">{protocol.title}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {protocol.tags.map((tag) => (
                      <span
                        key={`${protocol.id}-${tag}`}
                        className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
              </button>
            ))}
          </>
        ) : (
          <div className="animate-in slide-in-from-right-2 space-y-4">
            <button
              onClick={() => setActiveProtocol(null)}
              className="text-[9px] font-black uppercase text-slate-400 transition-all hover:text-blue-600"
            >
              Back to library
            </button>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-900/40 dark:bg-blue-950/20">
              <h4 className="mb-4 flex items-center gap-2 text-xs font-black uppercase text-blue-900 dark:text-blue-200">
                <Pin className="h-3 w-3" /> {visibleActiveProtocol.title}
              </h4>
              <div className="mb-4 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white">
                  {visibleActiveProtocol.category}
                </span>
                {visibleActiveProtocol.tags.map((tag) => (
                  <span
                    key={`${visibleActiveProtocol.id}-${tag}`}
                    className="rounded-full border border-blue-200 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-blue-700 dark:border-blue-800 dark:text-blue-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <ul className="space-y-3">
                {visibleActiveProtocol.steps.map((step, index) => (
                  <li key={index} className="flex gap-3 text-[10px] font-medium leading-relaxed text-blue-800/80 dark:text-blue-100/80">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[8px] font-black text-white">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
              {canActivate && (
                <button
                  type="button"
                  onClick={() => void handleActivate(visibleActiveProtocol)}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-emerald-500"
                >
                  <Bolt className="h-3.5 w-3.5" /> Activate Bundle
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
