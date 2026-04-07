"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Mic, Square, Wand2, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResolvedActor } from "@/lib/hooks/useResolvedActor";
import {
  generateOperationalScribeDraft,
  type OperationalScribeMode,
} from "@/lib/helpers/scribe";
import { toast } from "sonner";

type GlobalMode = "CLINICAL" | "HANDOFF" | "OPERATIONS";
type GlobalScribeHistoryPayload = {
  version: 2;
  drafts: string[];
};

function readHistoryFromStorage(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  const saved = window.localStorage.getItem(storageKey);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved) as unknown;

    // Legacy format support: an array of strings.
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === "string").slice(0, 6);
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      "version" in parsed &&
      "drafts" in parsed &&
      (parsed as { version?: unknown }).version === 2 &&
      Array.isArray((parsed as { drafts?: unknown }).drafts)
    ) {
      return (parsed as { drafts: unknown[] }).drafts
        .filter((entry): entry is string => typeof entry === "string")
        .slice(0, 6);
    }
  } catch {
    return [];
  }

  return [];
}

function writeHistoryToStorage(storageKey: string, drafts: string[]) {
  if (typeof window === "undefined") return;
  const payload: GlobalScribeHistoryPayload = {
    version: 2,
    drafts: drafts.slice(0, 6),
  };
  window.localStorage.setItem(storageKey, JSON.stringify(payload));
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

function toOperationalMode(mode: GlobalMode): OperationalScribeMode {
  if (mode === "HANDOFF") return "HANDOFF";
  if (mode === "OPERATIONS") return "ALERT";
  return "SCHEDULE";
}

function clinicalTemplate(title: string, facts: string, transcript: string) {
  const factsLine = facts.trim() ? facts.trim() : "No additional chart context provided.";
  const subjective = transcript.trim() || "Patient context captured via quick scribe draft.";
  return [
    `CLINICAL NOTE DRAFT (${new Date().toLocaleString()})`,
    `Context: ${title.trim() || "General encounter"}`,
    "",
    "S:",
    subjective,
    "",
    "O:",
    factsLine,
    "",
    "A:",
    "Clinical status requires provider verification and focused reassessment.",
    "",
    "P:",
    "1. Continue monitoring and review pending diagnostics.",
    "2. Update disposition plan after reassessment.",
    "3. Co-sign and finalize after clinician review.",
  ].join("\n");
}

export default function GlobalScribeDock() {
  const HISTORY_KEY = "global-scribe-history-v1";
  const { actorRole, actorName } = useResolvedActor();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<GlobalMode>("CLINICAL");
  const [persona, setPersona] = useState<"AUTO" | "RN" | "MD" | "COORD">("AUTO");
  const [title, setTitle] = useState("ER shift documentation");
  const [facts, setFacts] = useState("");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [history, setHistory] = useState<string[]>(() => readHistoryFromStorage(HISTORY_KEY));

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("open-global-scribe", openHandler);
    return () => window.removeEventListener("open-global-scribe", openHandler);
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const generated = useMemo(() => {
    if (mode === "CLINICAL") {
      return clinicalTemplate(title, facts, transcript);
    }

    const contextFacts = facts
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return generateOperationalScribeDraft({
      mode: toOperationalMode(mode),
      contextTitle: title,
      contextFacts,
      transcript,
    });
  }, [facts, mode, title, transcript]);

  const resolvedPersona = useMemo(() => {
    if (persona !== "AUTO") return persona;
    if (actorRole === "NURSE" || actorRole === "CCMA") return "RN";
    if (actorRole === "DOCTOR" || actorRole === "SURGEON" || actorRole === "ANESTHESIOLOGIST") return "MD";
    if (actorRole === "UNIT_COORDINATOR" || actorRole === "ADMIN") return "COORD";
    return "RN";
  }, [actorRole, persona]);

  const personaDecoratedDraft = useMemo(() => {
    const signature = `\n\nGenerated for ${actorName} (${resolvedPersona})`;
    if (resolvedPersona === "MD") {
      return `${generated}\n\nProvider Verification:\n- Differential updated: [Yes/No]\n- Risk of deterioration: [Low/Mod/High]${signature}`;
    }
    if (resolvedPersona === "COORD") {
      return `${generated}\n\nOperations Confirmation:\n- Owner assigned: [Yes/No]\n- Escalation ETA: [Time]${signature}`;
    }
    return `${generated}\n\nNursing Verification:\n- Reassessment interval confirmed: [Yes/No]\n- Safety checks complete: [Yes/No]${signature}`;
  }, [actorName, generated, resolvedPersona]);

  const qualityFlags = useMemo(() => {
    const flags: string[] = [];
    if (personaDecoratedDraft.includes("[Add]") || personaDecoratedDraft.includes("[Assign]") || personaDecoratedDraft.includes("[Time]")) {
      flags.push("Contains placeholders that require clinician completion.");
    }
    if (personaDecoratedDraft.length < 120) {
      flags.push("Draft is very short. Add more context for a complete note.");
    }
    if (!title.trim()) {
      flags.push("Context title is required.");
    }
    if (facts.trim().length < 20) {
      flags.push("Add more objective facts to improve note quality.");
    }
    return flags;
  }, [facts, personaDecoratedDraft, title]);

  const canFinalize = qualityFlags.length === 0;

  const applyTemplate = (template: string) => {
    setFacts((current) => {
      const prefix = current.trim();
      return prefix ? `${prefix}\n${template}` : template;
    });
  };

  const saveToHistory = (draft: string) => {
    const next = [draft, ...history.filter((item) => item !== draft)].slice(0, 6);
    setHistory(next);
    writeHistoryToStorage(HISTORY_KEY, next);
  };

  const startListening = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone access denied");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let addedFinal = "";
      let currentInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.[0]) continue;
        if (result.isFinal) {
          addedFinal += `${result[0].transcript} `;
        } else {
          currentInterim += result[0].transcript;
        }
      }
      if (addedFinal) setTranscript((prev) => `${prev}${addedFinal}`);
      setInterimTranscript(currentInterim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted") toast.error(`Microphone error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setInterimTranscript("");
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterimTranscript("");
    setIsListening(false);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-blue-500 bg-blue-600 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-2xl shadow-blue-900/30 transition-colors hover:bg-blue-500 sm:bottom-6 sm:right-6 sm:px-4 sm:py-3"
      >
        <Sparkles className="h-4 w-4" />
        Global Scribe
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto flex h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:h-[calc(100dvh-3rem)] sm:p-5 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Insight Mode</p>
                <h3 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl dark:text-slate-100">Scope-Style Global AI Scribe</h3>
              </div>
              <button
                onClick={() => {
                  stopListening();
                  setOpen(false);
                }}
                className="rounded-xl border border-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-3 overflow-y-auto pr-1">
                <div className="grid grid-cols-3 gap-2">
                  {(["CLINICAL", "HANDOFF", "OPERATIONS"] as GlobalMode[]).map((item) => (
                    <button
                      key={item}
                      onClick={() => setMode(item)}
                      className={`rounded-xl border px-2 py-2 text-[10px] font-black uppercase tracking-widest ${
                        mode === item
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-500 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    { key: "AUTO", label: "Auto" },
                    { key: "RN", label: "RN" },
                    { key: "MD", label: "MD" },
                    { key: "COORD", label: "Coord" },
                  ] as const).map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setPersona(option.key)}
                      className={`rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                        persona === option.key
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-500 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/50">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Quick Context Templates</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(mode === "CLINICAL"
                      ? [
                          "Current vitals trend: [Insert]",
                          "Pending diagnostics: [Insert]",
                          "Primary assessment concern: [Insert]",
                        ]
                      : mode === "HANDOFF"
                        ? [
                            "Outstanding tasks: [Insert]",
                            "Escalation trigger: [Insert]",
                            "Primary owner next shift: [Insert]",
                          ]
                        : [
                            "Room constraint: [Insert]",
                            "Resource dependency: [Insert]",
                            "Critical timing window: [Insert]",
                          ]
                    ).map((template) => (
                      <button
                        key={template}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-500 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      >
                        + {template.split(":")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value.slice(0, 120))}
                  placeholder="Context title"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />

                <textarea
                  value={facts}
                  onChange={(event) => setFacts(event.target.value.slice(0, 800))}
                  placeholder="Context facts (one per line)"
                  rows={5}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />

                <textarea
                  value={transcript}
                  onChange={(event) => setTranscript(event.target.value.slice(0, 1400))}
                  placeholder="Live dictation or typed transcript"
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {interimTranscript ? (
                  <p className="text-[11px] italic text-slate-400">{interimTranscript}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  {!isListening ? (
                    <Button
                      type="button"
                      onClick={() => void startListening()}
                      className="h-9 rounded-xl bg-red-600 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-500"
                    >
                      <Mic className="mr-1 h-4 w-4" />
                      Start Dictation
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={stopListening}
                      className="h-9 rounded-xl bg-slate-900 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-800"
                    >
                      <Square className="mr-1 h-4 w-4" />
                      Stop Dictation
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setTranscript("");
                      setInterimTranscript("");
                    }}
                    className="h-9 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest"
                  >
                    Clear Transcript
                  </Button>
                </div>

                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Hotkey: Ctrl+Shift+S
                </p>
              </div>

              <div className="flex min-h-0 flex-col rounded-2xl border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">Generated Draft</p>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canFinalize}
                      onClick={() => {
                        navigator.clipboard.writeText(personaDecoratedDraft);
                        saveToHistory(personaDecoratedDraft);
                        toast.success("Global scribe draft copied");
                      }}
                      className="h-8 w-full rounded-lg border-blue-200 px-3 text-[10px] font-black uppercase tracking-widest text-blue-700 sm:w-auto dark:border-blue-700 dark:text-blue-300"
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      Copy
                    </Button>
                    <Button
                      type="button"
                      disabled={!canFinalize}
                      onClick={() => {
                        navigator.clipboard.writeText(personaDecoratedDraft);
                        saveToHistory(personaDecoratedDraft);
                        window.dispatchEvent(
                          new CustomEvent("apply-global-scribe", { detail: { text: personaDecoratedDraft, mode } })
                        );
                        toast.success("Draft copied and broadcast to active form listeners");
                      }}
                      className="h-8 w-full rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 sm:w-auto"
                    >
                      <Wand2 className="mr-1 h-3.5 w-3.5" />
                      Send Draft
                    </Button>
                  </div>
                </div>
                {qualityFlags.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-700/40 dark:bg-amber-950/30">
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Quality Check</p>
                    <ul className="mt-1 space-y-1">
                      {qualityFlags.map((flag) => (
                        <li key={flag} className="text-[10px] font-semibold text-amber-800 dark:text-amber-200">• {flag}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <pre className="mt-2 min-h-36 flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-blue-100 bg-white p-3 text-[11px] font-semibold text-slate-700 dark:border-blue-900 dark:bg-slate-900 dark:text-slate-200">
                  {personaDecoratedDraft}
                </pre>

                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Recent Drafts</p>
                    {history.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setHistory([]);
                          writeHistoryToStorage(HISTORY_KEY, []);
                        }}
                        className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  {history.length === 0 ? (
                    <p className="mt-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">No saved drafts yet.</p>
                  ) : (
                    <div className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                      {history.map((item, index) => (
                        <button
                          key={`${item.slice(0, 24)}-${index}`}
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(item);
                            toast.success("Draft copied from history");
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-left text-[10px] font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300"
                        >
                          {item.slice(0, 120)}{item.length > 120 ? "..." : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
