"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateOperationalScribeDraft,
  type OperationalScribeMode,
} from "@/lib/helpers/scribe";
import { toast } from "sonner";

type ScribeAssistCardProps = {
  mode: OperationalScribeMode;
  contextTitle: string;
  contextFacts?: string[];
  onApply: (text: string) => void;
  onRequestCurrentValue?: () => string;
  className?: string;
};

const mapGlobalModeToOperational = (incomingMode?: string): OperationalScribeMode | null => {
  if (incomingMode === "HANDOFF") return "HANDOFF";
  if (incomingMode === "OPERATIONS") return "ALERT";
  if (incomingMode === "CLINICAL") return "SCHEDULE";
  if (incomingMode === "HANDOFF" || incomingMode === "ALERT" || incomingMode === "SCHEDULE") {
    return incomingMode;
  }
  return null;
};

export default function ScribeAssistCard({
  mode,
  contextTitle,
  contextFacts,
  onApply,
  onRequestCurrentValue,
  className,
}: ScribeAssistCardProps) {
  const [transcript, setTranscript] = useState("");
  const [profile, setProfile] = useState<"concise" | "detailed" | "handoff">("concise");
  const [applyStrategy, setApplyStrategy] = useState<"replace" | "append">("replace");
  const [lastAppliedText, setLastAppliedText] = useState<string | null>(null);

  const applyProfile = (draft: string) => {
    if (profile === "detailed") {
      return `${draft}\n\nReview Notes:\n- Pending contraindications: [Add]\n- Expected reassessment window: [Add]`;
    }
    if (profile === "handoff") {
      return `${draft}\n\nShift Handoff Focus:\n- Owner: [Assign]\n- Next checkpoint: [Time]\n- Escalate if: [Condition]`;
    }
    return draft;
  };

  const generated = useMemo(
    () =>
      generateOperationalScribeDraft({
        mode,
        contextTitle,
        contextFacts,
        transcript,
      }),
    [mode, contextTitle, contextFacts, transcript]
  );

  const preview = applyProfile(generated);
  const hasPlaceholders = useMemo(
    () => preview.includes("[Add]") || preview.includes("[Assign]") || preview.includes("[Time]") || preview.includes("[Condition]"),
    [preview]
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ text?: string; mode?: string }>;
      if (!customEvent.detail?.text) return;
      const mappedMode = mapGlobalModeToOperational(customEvent.detail.mode);
      if (mappedMode && mappedMode !== mode) {
        return;
      }

      const current = onRequestCurrentValue?.() ?? "";
      const nextText = applyStrategy === "append" && current.trim().length > 0
        ? `${current.trim()}\n\n${customEvent.detail.text}`
        : customEvent.detail.text;

      setLastAppliedText(current);
      onApply(nextText);
      toast.success("Global Scribe draft applied to this field");
    };

    window.addEventListener("apply-global-scribe", handler as EventListener);
    return () => window.removeEventListener("apply-global-scribe", handler as EventListener);
  }, [applyStrategy, mode, onApply, onRequestCurrentValue]);

  return (
    <div
      className={[
        "rounded-xl border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-950/20",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
        AI Scribe Assist
      </p>
      <p className="mt-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        Optional dictation or free text:
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { id: "concise", label: "Concise" },
          { id: "detailed", label: "Detailed" },
          { id: "handoff", label: "Handoff" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setProfile(item.id as "concise" | "detailed" | "handoff")}
            className={`rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${
              profile === item.id
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-blue-100 bg-white text-slate-500 hover:border-blue-300 dark:border-blue-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setApplyStrategy("replace")}
          className={`rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${
            applyStrategy === "replace"
              ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          Replace Field
        </button>
        <button
          type="button"
          onClick={() => setApplyStrategy("append")}
          className={`rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${
            applyStrategy === "append"
              ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          Append Field
        </button>
      </div>
      <textarea
        value={transcript}
        onChange={(event) => setTranscript(event.target.value.slice(0, 500))}
        placeholder="Add context and let Scribe draft a structured note..."
        className="mt-2 w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500 dark:border-blue-800 dark:bg-slate-900 dark:text-slate-200"
        rows={3}
      />
      <div className="mt-2 rounded-lg border border-blue-100 bg-white p-2 dark:border-blue-900 dark:bg-slate-900">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Draft Preview</p>
        <pre className="mt-1 max-h-36 overflow-y-auto whitespace-pre-wrap text-[10px] font-semibold text-slate-600 dark:text-slate-300">{preview}</pre>
      </div>
      {hasPlaceholders ? (
        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
          Complete placeholders before final sign-off.
        </p>
      ) : null}
      {lastAppliedText !== null ? (
        <button
          type="button"
          onClick={() => {
            onApply(lastAppliedText);
            setLastAppliedText(null);
            toast.success("Last apply action undone");
          }}
          className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500 underline-offset-2 hover:underline"
        >
          Undo last apply
        </button>
      ) : null}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {transcript.trim().length}/500
        </span>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(preview);
              toast.success("Scribe draft copied");
            }}
            className="h-8 w-full rounded-lg border-blue-200 px-3 text-[10px] font-black uppercase tracking-widest text-blue-700 hover:bg-blue-100 hover:text-blue-800 sm:w-auto dark:border-blue-700 dark:text-blue-300"
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            Copy
          </Button>
          <Button
            type="button"
            onClick={() => {
              const current = onRequestCurrentValue?.() ?? "";
              const nextText = applyStrategy === "append" && current.trim().length > 0
                ? `${current.trim()}\n\n${preview}`
                : preview;
              setLastAppliedText(current);
              onApply(nextText);
              toast.success("Scribe draft applied");
            }}
            className="h-8 w-full rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 sm:w-auto"
          >
            <Wand2 className="mr-1 h-3.5 w-3.5" />
            Apply Draft
          </Button>
        </div>
      </div>
    </div>
  );
}
