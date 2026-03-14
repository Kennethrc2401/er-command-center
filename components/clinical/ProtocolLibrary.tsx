"use client";

import { useMemo, useState } from "react";
import { BookOpen, Search, Pin, ChevronRight } from "lucide-react";
import { PROTOCOL_LIBRARY, Protocol } from "@/lib/hooks/protocols";

export default function ProtocolLibrary() {
  const [search, setSearch] = useState("");
  const [activeProtocol, setActiveProtocol] = useState<Protocol | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<"All" | Protocol["category"]>("All");
  const [selectedTag, setSelectedTag] = useState<"All" | Protocol["tags"][number]>("All");

  const categoryOptions = useMemo(() => {
    return ["All", ...Array.from(new Set(PROTOCOL_LIBRARY.map((p) => p.category)))];
  }, []);

  const tagOptions = useMemo(() => {
    return ["All", ...Array.from(new Set(PROTOCOL_LIBRARY.flatMap((p) => p.tags))).sort()];
  }, []);

  const filteredProtocols = useMemo(() => {
    const query = search.trim().toLowerCase();
    return PROTOCOL_LIBRARY.filter((p) => {
      const categoryMatch = selectedCategory === "All" || p.category === selectedCategory;
      const tagMatch = selectedTag === "All" || p.tags.includes(selectedTag);
      const searchMatch =
        query.length === 0 ||
        p.title.toLowerCase().includes(query) ||
        p.steps.some((step) => step.toLowerCase().includes(query)) ||
        p.tags.some((tag) => tag.toLowerCase().includes(query));
      return categoryMatch && tagMatch && searchMatch;
    });
  }, [search, selectedCategory, selectedTag]);

  const visibleActiveProtocol = useMemo(() => {
    if (!activeProtocol) return null;
    return filteredProtocols.some((p) => p.id === activeProtocol.id)
      ? activeProtocol
      : null;
  }, [activeProtocol, filteredProtocols]);

  return (
    <div className="flex h-full min-h-96 flex-col rounded-[2.5rem] border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Standard Protocols</span>
        </div>
      </div>

      {/* 🔍 SEARCH */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
        <input 
          placeholder="Search protocols, tags, or steps..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-3 pl-10 text-xs font-bold outline-none transition-all focus:border-blue-500"
        />
      </div>

      {/* 🧭 CATEGORY FILTER */}
      <div className="mb-3 flex flex-wrap gap-2 px-1">
        {categoryOptions.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category as "All" | Protocol["category"])}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition-all ${
              selectedCategory === category
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-slate-50 text-slate-500 hover:border-blue-200 hover:text-blue-600"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* 🏷 TAG FILTER */}
      <div className="mb-5 flex flex-wrap gap-2 px-1">
        {tagOptions.map((tag) => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag as "All" | Protocol["tags"][number])}
            className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide transition-all ${
              selectedTag === tag
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-slate-200 bg-white text-slate-400 hover:border-amber-200 hover:text-amber-600"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* 📜 LIST OR DETAIL VIEW */}
      <div className="flex-1 space-y-2 pr-1 sm:pr-2">
        {!visibleActiveProtocol ? (
          <>
            {filteredProtocols.length === 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No protocols found</p>
                <p className="mt-1 text-[10px] text-slate-400">Try clearing filters or searching a different term.</p>
              </div>
            )}
            {filteredProtocols.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveProtocol(p)}
                className="w-full group flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all text-left"
              >
                <div>
                  <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-blue-500">{p.category}</p>
                  <p className="text-sm font-bold tracking-tight text-slate-800">{p.title}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.tags.map((tag) => (
                      <span
                        key={`${p.id}-${tag}`}
                        className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500"
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
          <div className="space-y-4 animate-in slide-in-from-right-2">
            <button 
              onClick={() => setActiveProtocol(null)}
              className="text-[9px] font-black uppercase text-slate-400 hover:text-blue-600 transition-all"
            >
              ← Back to Library
            </button>
            <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
              <h4 className="text-xs font-black uppercase text-blue-900 mb-4 flex items-center gap-2">
                <Pin className="h-3 w-3" /> {visibleActiveProtocol.title}
              </h4>
              <div className="mb-4 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white">
                  {visibleActiveProtocol.category}
                </span>
                {visibleActiveProtocol.tags.map((tag) => (
                  <span
                    key={`${visibleActiveProtocol.id}-${tag}`}
                    className="rounded-full border border-blue-200 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-blue-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <ul className="space-y-3">
                {visibleActiveProtocol.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-[10px] font-medium text-blue-800/80 leading-relaxed">
                    <span className="h-4 w-4 shrink-0 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px] font-black">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}