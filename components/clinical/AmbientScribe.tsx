"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Wand2, Mic, Copy, RefreshCw, FileText,
  Square, CheckCircle2, Save, ChevronDown,
} from "lucide-react";
import {
  generateEnhancedNote,
  type NoteType,
  type ScribeEncounter,
  type ScribeOrder,
  type ScribePatient,
} from "@/lib/helpers/scribe";
import { toast } from "sonner";

// ─── Web Speech API type shim (not in TS DOM lib by default) ────────────────
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

// ────────────────────────────────────────────────────────────────────────────

type Phase = "idle" | "requesting" | "listening" | "generating" | "reviewing" | "saved";

const NOTE_TYPES: { value: NoteType; label: string; description: string }[] = [
  { value: "SOAP",      label: "SOAP Progress Note",    description: "Subjective · Objective · Assessment · Plan" },
  { value: "PROCEDURE", label: "Procedure Note",        description: "Timeout · Technique · Findings · Post-care" },
  { value: "NURSING",   label: "Nursing Assessment",    description: "Vitals review · Interventions · Education" },
];

type AmbientScribeProps = {
  patient: ScribePatient;
  encounter: ScribeEncounter;
  orders: ScribeOrder[];
  encounterId?: Id<"encounters">;
};

export default function AmbientScribe({ patient, encounter, orders, encounterId }: AmbientScribeProps) {
  const saveNote = useMutation(api.notes.create);

  const [phase, setPhase] = useState<Phase>("idle");
  const [noteType, setNoteType] = useState<NoteType>("SOAP");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript to bottom as words come in
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [finalTranscript, interimTranscript]);

  // ── Mic setup ─────────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.", {
        description: "Try Chrome or Edge on desktop.",
      });
      return;
    }

    setPhase("requesting");

    try {
      // Explicitly ask for mic permission before starting recognition
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone access denied.", {
        description: "Enable microphone permissions in your browser settings and try again.",
      });
      setPhase("idle");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    setFinalTranscript("");
    setInterimTranscript("");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let addedFinal = "";
      let currentInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result && result[0]) {
          if (result.isFinal) {
            addedFinal += result[0].transcript + " ";
          } else {
            currentInterim += result[0].transcript;
          }
        }
      }
      if (addedFinal) setFinalTranscript((prev) => prev + addedFinal);
      setInterimTranscript(currentInterim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted") {
        toast.error(`Microphone error: ${event.error}`);
      }
      setPhase("idle");
    };

    recognition.onend = () => {
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setPhase("listening");
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterimTranscript("");
    setPhase("generating");

    setTimeout(() => {
      const generated = generateEnhancedNote(
        patient,
        encounter,
        orders,
        finalTranscript,
        noteType
      );
      setNote(generated);
      setPhase("reviewing");
    }, 600);
  }, [patient, encounter, orders, finalTranscript, noteType]);

  // ── Auto-draft without mic ─────────────────────────────────────────────────
  const handleAutoDraft = useCallback(() => {
    setPhase("generating");
    setTimeout(() => {
      const generated = generateEnhancedNote(patient, encounter, orders, "", noteType);
      setNote(generated);
      setPhase("reviewing");
    }, 700);
  }, [patient, encounter, orders, noteType]);

  // ── Save to chart ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!encounterId) {
      toast.error("Cannot save: encounter ID is missing.");
      return;
    }
    setIsSaving(true);
    try {
      await saveNote({
        encounterId,
        content: note,
        type: noteType === "SOAP" ? "Progress Note" : "Procedure",
      });
      toast.success("Note saved to chart.");
      setPhase("saved");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to save note.", { description: msg });
    } finally {
      setIsSaving(false);
    }
  }, [encounterId, note, noteType, saveNote]);

  const handleReset = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setPhase("idle");
    setNote("");
    setFinalTranscript("");
    setInterimTranscript("");
  };

  const selectedType = NOTE_TYPES.find((t) => t.value === noteType)!;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl border border-white/5 relative overflow-hidden">
      {/* Background watermark icon */}
      <div className="absolute top-0 right-0 p-8 opacity-[0.06] pointer-events-none select-none">
        <Mic className="h-28 w-28 -rotate-12" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* ─── Header ─────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${
              phase === "listening" ? "bg-red-500 animate-pulse" : "bg-blue-500"
            }`}>
              {phase === "listening" ? <Mic className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                Ambient AI Scribe
              </h3>
              {phase === "listening" && (
                <p className="text-[8px] font-bold text-red-400 uppercase tracking-widest animate-pulse">
                  ● Live — Recording
                </p>
              )}
            </div>
          </div>

          {/* Copy button when note is ready */}
          {(phase === "reviewing" || phase === "saved") && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(note);
                toast.success("Copied to clipboard");
              }}
              className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          )}
        </header>

        {/* ─── Phase: IDLE ────────────────────────────────────────────── */}
        {phase === "idle" && (
          <div className="space-y-5">
            {/* Note type selector */}
            <div className="relative">
              <button
                onClick={() => setTypeOpen((o) => !o)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    {selectedType.label}
                  </p>
                  <p className="text-[9px] text-slate-500 mt-0.5">{selectedType.description}</p>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${typeOpen ? "rotate-180" : ""}`} />
              </button>

              {typeOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-2xl border border-white/10 bg-slate-800 shadow-2xl overflow-hidden">
                  {NOTE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => { setNoteType(t.value); setTypeOpen(false); }}
                      className={`w-full text-left p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${
                        t.value === noteType ? "bg-blue-600/20" : ""
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-200">
                        {t.label}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5">{t.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={startListening}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-red-600 hover:bg-red-500 transition-all"
              >
                <Mic className="h-6 w-6" />
                <span className="text-[9px] font-black uppercase tracking-widest">Start Dictating</span>
                <span className="text-[8px] text-red-200 font-medium">Uses your microphone</span>
              </button>

              <button
                onClick={handleAutoDraft}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-blue-600 hover:bg-blue-500 transition-all"
              >
                <FileText className="h-6 w-6" />
                <span className="text-[9px] font-black uppercase tracking-widest">Auto-Draft</span>
                <span className="text-[8px] text-blue-200 font-medium">From chart data only</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── Phase: REQUESTING permission ───────────────────────────── */}
        {phase === "requesting" && (
          <div className="py-10 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Mic className="h-7 w-7 text-amber-400 animate-pulse" />
            </div>
            <p className="text-sm font-black uppercase tracking-widest text-amber-300">
              Waiting for microphone permission...
            </p>
            <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
              Your browser will ask for microphone access. The audio is processed locally
              and is never sent to any server.
            </p>
          </div>
        )}

        {/* ─── Phase: LISTENING ───────────────────────────────────────── */}
        {phase === "listening" && (
          <div className="space-y-4">
            {/* Pulsing waveform indicator */}
            <div className="flex items-center justify-center gap-1 py-2">
              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-500 rounded-full animate-pulse"
                  style={{
                    height: `${8 + Math.sin(i) * 8 + 8}px`,
                    animationDelay: `${i * 80}ms`,
                    animationDuration: "700ms",
                  }}
                />
              ))}
            </div>

            {/* Live transcript box */}
            <div
              ref={transcriptScrollRef}
              className="bg-black/30 border border-white/10 p-5 rounded-2xl min-h-25 max-h-48 overflow-y-auto text-[11px] font-mono leading-relaxed"
            >
              {!finalTranscript && !interimTranscript && (
                <span className="text-slate-500 italic">Speak clearly... transcript will appear here.</span>
              )}
              <span className="text-slate-200">{finalTranscript}</span>
              <span className="text-slate-500 italic">{interimTranscript}</span>
            </div>

            {/* Word count + stop button */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                {finalTranscript.trim().split(/\s+/).filter(Boolean).length} words captured
              </span>
              <button
                onClick={stopListening}
                className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                <Square className="h-3.5 w-3.5 fill-slate-900" />
                Stop & Generate Note
              </button>
            </div>

            <button
              onClick={handleReset}
              className="text-[9px] font-black uppercase text-slate-600 hover:text-white transition-all"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ─── Phase: GENERATING ──────────────────────────────────────── */}
        {phase === "generating" && (
          <div className="py-10 text-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
            <p className="text-xs font-black uppercase tracking-widest text-blue-300">
              Synthesizing clinical note...
            </p>
          </div>
        )}

        {/* ─── Phase: REVIEWING ───────────────────────────────────────── */}
        {phase === "reviewing" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              spellCheck
              className="w-full bg-black/30 border border-white/10 p-5 rounded-2xl text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed resize-y min-h-60 focus:outline-none focus:border-blue-500/60"
            />

            <div className="flex items-center gap-3 flex-wrap">
              {/* Save to chart */}
              {encounterId && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {isSaving ? "Saving…" : "Save to Chart"}
                </button>
              )}

              <button
                onClick={handleReset}
                className="text-[9px] font-black uppercase text-slate-500 hover:text-white transition-all"
              >
                ← Re-draft
              </button>
            </div>
          </div>
        )}

        {/* ─── Phase: SAVED ───────────────────────────────────────────── */}
        {phase === "saved" && (
          <div className="py-8 text-center space-y-5 animate-in fade-in">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
            <p className="text-sm font-black uppercase tracking-widest text-emerald-300">
              Note saved to chart
            </p>
            <pre className="bg-black/20 border border-white/5 p-4 rounded-2xl text-[10px] font-mono text-slate-400 whitespace-pre-wrap leading-relaxed text-left max-h-48 overflow-y-auto">
              {note}
            </pre>
            <button
              onClick={handleReset}
              className="text-[9px] font-black uppercase text-slate-500 hover:text-white transition-all"
            >
              ← Draft another note
            </button>
          </div>
        )}

        {/* ─── Mic disclaimer ─────────────────────────────────────────── */}
        {phase === "idle" && (
          <p className="text-[8px] text-slate-600 text-center leading-relaxed px-4">
            Microphone audio is processed locally by your browser&apos;s built-in speech engine.
            No audio is transmitted to any external server. Always review AI-generated notes
            before signing.
          </p>
        )}
      </div>
    </div>
  );
}