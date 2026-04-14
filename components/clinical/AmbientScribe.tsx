"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Wand2, Mic, Copy, RefreshCw, FileText,
  Square, CheckCircle2, Save, ChevronDown, Undo2, ClipboardList,
} from "lucide-react";
import {
  generateEnhancedNote,
  type NoteType,
  type ScribeEncounter,
  type ScribeOrder,
  type ScribePatient,
} from "@/lib/helpers/scribe";
import {
  mergeTranscriptFragment,
  splitTranscriptForHighlights,
  summarizeTranscriptQuality,
  type TranscriptQualitySegment,
} from "@/lib/helpers/transcriptionQuality";
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

type CorrectionHistoryEntry = {
  at: number;
  target: string;
  replacement: string;
  transcriptBefore: string;
  transcriptAfter: string;
};

const LANGUAGE_STORAGE_KEY = "ambient-scribe:language";
const VOCAB_STORAGE_KEY = "ambient-scribe:custom-vocabulary";
const IGNORED_FLAGS_STORAGE_KEY = "ambient-scribe:ignored-flags";
const AUTO_PROMOTE_VOCAB_KEY = "ambient-scribe:auto-promote-vocabulary";
const AUTO_PROMOTE_THRESHOLD_KEY = "ambient-scribe:auto-promote-threshold";
const PHRASE_FIX_COUNTS_KEY = "ambient-scribe:phrase-fix-counts";

const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "es-US", label: "Spanish/English (US)" },
  { value: "es-ES", label: "Spanish (ES)" },
] as const;

type RecognitionLanguage = (typeof LANGUAGE_OPTIONS)[number]["value"];

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function AmbientScribe({ patient, encounter, orders, encounterId }: AmbientScribeProps) {
  const saveNote = useMutation(api.notes.create);

  const [phase, setPhase] = useState<Phase>("idle");
  const [noteType, setNoteType] = useState<NoteType>("SOAP");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [transcriptConfidence, setTranscriptConfidence] = useState<number | null>(null);
  const [lowConfidenceSegments, setLowConfidenceSegments] = useState<TranscriptQualitySegment[]>([]);
  const [correctionTarget, setCorrectionTarget] = useState<string | null>(null);
  const [correctionValue, setCorrectionValue] = useState("");
  const [recognitionLanguage, setRecognitionLanguage] = useState<RecognitionLanguage>(() => {
    if (typeof window === "undefined") return "en-US";
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) as RecognitionLanguage | null;
    return LANGUAGE_OPTIONS.some((option) => option.value === saved) ? (saved as RecognitionLanguage) : "en-US";
  });
  const [customVocabularyInput, setCustomVocabularyInput] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(VOCAB_STORAGE_KEY) ?? "";
  });
  const [ignoredFlagPhrases, setIgnoredFlagPhrases] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(IGNORED_FLAGS_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [replaceAllCorrections, setReplaceAllCorrections] = useState(false);
  const [activeFlagIndex, setActiveFlagIndex] = useState(0);
  const [selectedFlagKeys, setSelectedFlagKeys] = useState<string[]>([]);
  const [batchReplaceValue, setBatchReplaceValue] = useState("");
  const [autoPromoteVocabulary, setAutoPromoteVocabulary] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = window.localStorage.getItem(AUTO_PROMOTE_VOCAB_KEY);
    return raw === null ? true : raw === "1";
  });
  const [autoPromoteThreshold, setAutoPromoteThreshold] = useState<number>(() => {
    if (typeof window === "undefined") return 3;
    const raw = window.localStorage.getItem(AUTO_PROMOTE_THRESHOLD_KEY);
    const parsed = raw ? Number(raw) : 3;
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 10 ? parsed : 3;
  });
  const [phraseFixCounts, setPhraseFixCounts] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(PHRASE_FIX_COUNTS_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return {};
      return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, value]) => {
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
          acc[key] = Math.floor(value);
        }
        return acc;
      }, {});
    } catch {
      return {};
    }
  });
  const [showHighImpactOnly, setShowHighImpactOnly] = useState(false);
  const [correctionHistory, setCorrectionHistory] = useState<CorrectionHistoryEntry[]>([]);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  const customVocabulary = useMemo(
    () => customVocabularyInput.split(",").map((item) => item.trim()).filter(Boolean),
    [customVocabularyInput]
  );

  const ignoredFlagSet = useMemo(
    () => new Set(ignoredFlagPhrases.map((phrase) => phrase.toLowerCase())),
    [ignoredFlagPhrases]
  );

  const transcriptHighlightParts = useMemo(
    () => splitTranscriptForHighlights(finalTranscript, lowConfidenceSegments),
    [finalTranscript, lowConfidenceSegments]
  );

  const selectedFlagSet = useMemo(() => new Set(selectedFlagKeys), [selectedFlagKeys]);

  const weakPhraseTrends = useMemo(() => {
    const normalizeFlagText = (text: string) => text.trim().toLowerCase();
    const buckets = new Map<string, { phrase: string; count: number; minConfidence: number; issues: Set<string> }>();
    lowConfidenceSegments.forEach((segment) => {
      const key = normalizeFlagText(segment.text);
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
        existing.minConfidence = Math.min(existing.minConfidence, segment.confidence);
        segment.issues.forEach((issue) => existing.issues.add(issue));
        return;
      }
      buckets.set(key, {
        phrase: segment.text,
        count: 1,
        minConfidence: segment.confidence,
        issues: new Set(segment.issues),
      });
    });

    return Array.from(buckets.values())
      .sort((a, b) => b.count - a.count || a.minConfidence - b.minConfidence)
      .slice(0, 5)
      .map((item) => ({
        phrase: item.phrase,
        count: item.count,
        minConfidence: item.minConfidence,
        issues: Array.from(item.issues),
      }));
  }, [lowConfidenceSegments]);

  const selectedBatchPreview = useMemo(() => {
    const normalizeFlagText = (text: string) => text.trim().toLowerCase();
    if (!finalTranscript || selectedFlagKeys.length === 0) return [] as Array<{ text: string; matches: number }>;

    const selectedTexts = lowConfidenceSegments
      .filter((segment) => selectedFlagSet.has(normalizeFlagText(segment.text)))
      .map((segment) => segment.text)
      .filter((text, index, array) => array.findIndex((item) => item.toLowerCase() === text.toLowerCase()) === index);

    return selectedTexts
      .map((text) => ({
        text,
        matches: (finalTranscript.match(new RegExp(escapeForRegExp(text), "gi")) ?? []).length,
      }))
      .filter((item) => item.matches > 0)
      .sort((a, b) => b.matches - a.matches);
  }, [finalTranscript, lowConfidenceSegments, selectedFlagKeys.length, selectedFlagSet]);

  const displayedLowConfidenceSegments = useMemo(() => {
    if (!showHighImpactOnly) return lowConfidenceSegments;
    return lowConfidenceSegments.filter((segment) => {
      const issuesText = segment.issues.join(" ").toLowerCase();
      return (
        segment.confidence <= 0.72 ||
        segment.issues.length >= 2 ||
        /unclear|low|dosage|medication|drug|name|number|frequency/.test(issuesText)
      );
    });
  }, [lowConfidenceSegments, showHighImpactOnly]);

  const navigableLowConfidenceSegments = displayedLowConfidenceSegments;

  const activeFlag = navigableLowConfidenceSegments[activeFlagIndex] ?? null;

  const applyTranscriptQuality = useCallback((value: string) => {
    const summary = summarizeTranscriptQuality(value, {
      domain: "clinical",
      customVocabulary,
    });
    setTranscriptConfidence(summary.averageConfidence);
    setLowConfidenceSegments(
      summary.lowConfidenceSegments.filter((segment) => !ignoredFlagSet.has(segment.text.toLowerCase()))
    );
    return summary.normalizedText;
  }, [customVocabulary, ignoredFlagSet]);

  const regenerateFromTranscript = useCallback((transcript: string) => {
    const processedTranscript = applyTranscriptQuality(transcript);
    const generated = generateEnhancedNote(
      patient,
      encounter,
      orders,
      processedTranscript,
      noteType
    );
    setNote(generated);
    return processedTranscript;
  }, [applyTranscriptQuality, encounter, noteType, orders, patient]);

  const qualityPack = useMemo(() => {
    const lines = [
      `Ambient Scribe QA Pack (${new Date().toLocaleString()})`,
      `Language: ${recognitionLanguage}`,
      `Confidence: ${transcriptConfidence !== null ? `${Math.round(transcriptConfidence * 100)}%` : "n/a"}`,
      `Flagged segments: ${lowConfidenceSegments.length}`,
      `Corrections applied: ${correctionHistory.length}`,
      `Ignored phrases: ${ignoredFlagPhrases.length > 0 ? ignoredFlagPhrases.join(", ") : "none"}`,
      `Custom vocabulary: ${customVocabulary.length > 0 ? customVocabulary.join(", ") : "none"}`,
      "",
      "Flagged phrases:",
      ...(lowConfidenceSegments.length > 0
        ? lowConfidenceSegments.map((segment) => {
            const issues = segment.issues.length > 0 ? ` | issues: ${segment.issues.join(", ")}` : "";
            return `- ${segment.text} (${Math.round(segment.confidence * 100)}%)${issues}`;
          })
        : ["- none"]),
      "",
      "Transcript:",
      finalTranscript || "(empty)",
    ];
    return lines.join("\n");
  }, [correctionHistory.length, customVocabulary, finalTranscript, ignoredFlagPhrases, lowConfidenceSegments, recognitionLanguage, transcriptConfidence]);

  const openCorrectionEditor = useCallback((segment: string) => {
    setCorrectionTarget(segment);
    setCorrectionValue(segment);
  }, []);

  const ignoreFlagPhrase = useCallback((phrase: string) => {
    const trimmed = phrase.trim();
    if (!trimmed) return;
    setIgnoredFlagPhrases((current) => {
      const exists = current.some((item) => item.toLowerCase() === trimmed.toLowerCase());
      if (exists) return current;
      return [...current, trimmed].slice(0, 30);
    });
    toast.success("Phrase ignored from future warnings.");
  }, []);

  const flagKey = useCallback((text: string) => text.trim().toLowerCase(), []);

  const toggleFlagSelection = useCallback((text: string) => {
    const key = flagKey(text);
    setSelectedFlagKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }, [flagKey]);

  const selectAllFlags = useCallback(() => {
    setSelectedFlagKeys(lowConfidenceSegments.map((segment) => flagKey(segment.text)));
  }, [flagKey, lowConfidenceSegments]);

  const clearSelectedFlags = useCallback(() => {
    setSelectedFlagKeys([]);
  }, []);

  const selectMatchingFlags = useCallback((text: string) => {
    const targetKey = flagKey(text);
    const matches = displayedLowConfidenceSegments
      .map((segment) => segment.text)
      .filter((segmentText) => flagKey(segmentText) === targetKey)
      .map((segmentText) => flagKey(segmentText));

    if (matches.length === 0) {
      toast.message("No matching flagged phrases found.");
      return;
    }

    setSelectedFlagKeys((current) => Array.from(new Set([...current, ...matches])));
    toast.success(`Selected ${matches.length} matching phrase(s).`);
  }, [displayedLowConfidenceSegments, flagKey]);

  const addPhraseToVocabulary = useCallback((phrase: string) => {
    const trimmed = phrase.trim();
    if (!trimmed) return;

    const current = customVocabularyInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (current.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      toast.message("Phrase is already in custom vocabulary.");
      return;
    }

    setCustomVocabularyInput([...current, trimmed].join(", "));
    toast.success("Added phrase to custom vocabulary.");
  }, [customVocabularyInput]);

  const recordPhraseCorrection = useCallback((phrase: string) => {
    const trimmed = phrase.trim();
    if (!trimmed) return;

    const key = trimmed.toLowerCase();
    setPhraseFixCounts((current) => {
      const nextCount = (current[key] ?? 0) + 1;
      const next = { ...current, [key]: nextCount };

      if (autoPromoteVocabulary && nextCount >= autoPromoteThreshold) {
        setCustomVocabularyInput((previous) => {
          const existing = previous
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

          if (existing.some((item) => item.toLowerCase() === key)) {
            return previous;
          }

          toast.success(`Auto-promoted \"${trimmed}\" to vocabulary.`);
          return [...existing, trimmed].join(", ");
        });
      }

      return next;
    });
  }, [autoPromoteThreshold, autoPromoteVocabulary]);

  const batchIgnoreSelected = useCallback(() => {
    if (selectedFlagKeys.length === 0) {
      toast.message("Select flagged phrases first.");
      return;
    }

    const selectedTexts = lowConfidenceSegments
      .filter((segment) => selectedFlagSet.has(flagKey(segment.text)))
      .map((segment) => segment.text);

    if (selectedTexts.length === 0) {
      toast.message("Selected flagged phrases are no longer available.");
      return;
    }

    setIgnoredFlagPhrases((current) => {
      const next = [...current];
      selectedTexts.forEach((text) => {
        if (!next.some((existing) => existing.toLowerCase() === text.toLowerCase())) {
          next.push(text);
        }
      });
      return next.slice(0, 30);
    });
    setSelectedFlagKeys([]);
    toast.success(`Ignored ${selectedTexts.length} flagged phrase(s).`);
  }, [flagKey, lowConfidenceSegments, selectedFlagKeys.length, selectedFlagSet]);

  const batchReplaceSelected = useCallback(() => {
    const replacement = batchReplaceValue.trim();
    if (selectedFlagKeys.length === 0) {
      toast.message("Select flagged phrases first.");
      return;
    }
    if (!replacement) {
      toast.error("Enter replacement text for batch replace.");
      return;
    }

    const selectedTexts = lowConfidenceSegments
      .filter((segment) => selectedFlagSet.has(flagKey(segment.text)))
      .map((segment) => segment.text)
      .filter((text, index, array) => array.findIndex((item) => item.toLowerCase() === text.toLowerCase()) === index);

    if (selectedTexts.length === 0) {
      toast.message("Selected flagged phrases are no longer available.");
      return;
    }

    setFinalTranscript((previous) => {
      let updated = previous;
      selectedTexts.forEach((text) => {
        updated = updated.replace(new RegExp(escapeForRegExp(text), "gi"), replacement);
      });

      recordPhraseCorrection(replacement);

      const processed = applyTranscriptQuality(updated);
      if (phase === "reviewing") {
        const regenerated = generateEnhancedNote(patient, encounter, orders, processed, noteType);
        setNote(regenerated);
      }

      setCorrectionHistory((current) => [
        {
          at: Date.now(),
          target: `Batch (${selectedTexts.length})`,
          replacement,
          transcriptBefore: previous,
          transcriptAfter: processed,
        },
        ...current,
      ].slice(0, 20));

      return processed;
    });

    setSelectedFlagKeys([]);
    setBatchReplaceValue("");
    toast.success(`Batch replaced ${selectedTexts.length} flagged phrase(s).`);
  }, [applyTranscriptQuality, batchReplaceValue, encounter, flagKey, lowConfidenceSegments, noteType, orders, patient, phase, recordPhraseCorrection, selectedFlagKeys.length, selectedFlagSet]);

  const clearIgnoredFlags = useCallback(() => {
    setIgnoredFlagPhrases([]);
    toast.success("Cleared ignored phrase list.");
  }, []);

  const applyCorrection = useCallback(() => {
    const target = correctionTarget?.trim();
    const replacement = correctionValue.trim();

    if (!target || !replacement) {
      toast.error("Correction text is required.");
      return;
    }

    const escapedTarget = escapeForRegExp(target);
    const targetPattern = new RegExp(escapedTarget, replaceAllCorrections ? "gi" : "i");

    setFinalTranscript((previous) => {
      if (!targetPattern.test(previous)) {
        toast.error("That phrase was not found in the current transcript.");
        return previous;
      }

      const updated = previous.replace(targetPattern, replacement);
      const processedTranscript = applyTranscriptQuality(updated);
      recordPhraseCorrection(replacement);

      setCorrectionHistory((current) => [
        {
          at: Date.now(),
          target,
          replacement,
          transcriptBefore: previous,
          transcriptAfter: processedTranscript,
        },
        ...current,
      ].slice(0, 20));

      if (phase === "reviewing") {
        const regenerated = generateEnhancedNote(patient, encounter, orders, processedTranscript, noteType);
        setNote(regenerated);
      }

      return processedTranscript;
    });

    setCorrectionTarget(null);
    setCorrectionValue("");
    toast.success("Applied correction and refreshed confidence.");
  }, [applyTranscriptQuality, correctionTarget, correctionValue, encounter, noteType, orders, patient, phase, recordPhraseCorrection, replaceAllCorrections]);

  const undoLastCorrection = useCallback(() => {
    setCorrectionHistory((current) => {
      if (current.length === 0) {
        toast.message("No correction to undo.");
        return current;
      }
      const [latest, ...rest] = current;
      setFinalTranscript(latest.transcriptBefore);
      if (phase === "reviewing") {
        regenerateFromTranscript(latest.transcriptBefore);
      } else {
        applyTranscriptQuality(latest.transcriptBefore);
      }
      toast.success("Last correction reverted.");
      return rest;
    });
  }, [applyTranscriptQuality, phase, regenerateFromTranscript]);

  const insertSpeakerTag = useCallback((speaker: "Provider" | "Patient") => {
    const tag = `\n[${speaker}]: `;
    setFinalTranscript((previous) => {
      const merged = mergeTranscriptFragment(previous, tag);
      return applyTranscriptQuality(merged);
    });
    toast.success(`${speaker} tag inserted.`);
  }, [applyTranscriptQuality]);

  const copyQualityPack = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(qualityPack);
      toast.success("QA pack copied.");
    } catch {
      toast.error("Unable to copy QA pack.");
    }
  }, [qualityPack]);

  const acceptAllCleanups = useCallback(() => {
    if (!finalTranscript.trim()) {
      toast.message("No transcript text to clean yet.");
      return;
    }

    const processed = applyTranscriptQuality(finalTranscript);
    setFinalTranscript(processed);

    if (phase === "reviewing") {
      regenerateFromTranscript(processed);
    }

    toast.success("Applied all cleanup suggestions.");
  }, [applyTranscriptQuality, finalTranscript, phase, regenerateFromTranscript]);

  const cycleActiveFlag = useCallback((direction: -1 | 1) => {
    if (navigableLowConfidenceSegments.length === 0) return;
    setActiveFlagIndex((current) => {
      const next = current + direction;
      if (next < 0) return navigableLowConfidenceSegments.length - 1;
      if (next >= navigableLowConfidenceSegments.length) return 0;
      return next;
    });
  }, [navigableLowConfidenceSegments.length]);

  // Auto-scroll transcript to bottom as words come in
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [finalTranscript, interimTranscript]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, recognitionLanguage);
  }, [recognitionLanguage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VOCAB_STORAGE_KEY, customVocabularyInput);
  }, [customVocabularyInput]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AUTO_PROMOTE_VOCAB_KEY, autoPromoteVocabulary ? "1" : "0");
  }, [autoPromoteVocabulary]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AUTO_PROMOTE_THRESHOLD_KEY, String(autoPromoteThreshold));
  }, [autoPromoteThreshold]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PHRASE_FIX_COUNTS_KEY, JSON.stringify(phraseFixCounts));
  }, [phraseFixCounts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(IGNORED_FLAGS_STORAGE_KEY, JSON.stringify(ignoredFlagPhrases));
  }, [ignoredFlagPhrases]);

  useEffect(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.lang = recognitionLanguage;
  }, [recognitionLanguage]);

  useEffect(() => {
    if (navigableLowConfidenceSegments.length === 0) {
      setActiveFlagIndex(0);
      return;
    }
    setActiveFlagIndex((current) => Math.min(current, navigableLowConfidenceSegments.length - 1));
  }, [navigableLowConfidenceSegments.length]);

  useEffect(() => {
    const validKeys = new Set(lowConfidenceSegments.map((segment) => flagKey(segment.text)));
    setSelectedFlagKeys((current) => current.filter((key) => validKeys.has(key)));
  }, [flagKey, lowConfidenceSegments]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        cycleActiveFlag(1);
        return;
      }
      if (key === "p") {
        event.preventDefault();
        cycleActiveFlag(-1);
        return;
      }
      if (key === "e") {
        if (!activeFlag) return;
        event.preventDefault();
        openCorrectionEditor(activeFlag.text);
        return;
      }
      if (key === "a") {
        event.preventDefault();
        acceptAllCleanups();
        return;
      }
      if (key === "s") {
        if (!activeFlag) return;
        event.preventDefault();
        selectMatchingFlags(activeFlag.text);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [acceptAllCleanups, activeFlag, cycleActiveFlag, openCorrectionEditor, selectMatchingFlags]);

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
    recognition.lang = recognitionLanguage;

    setFinalTranscript("");
    setInterimTranscript("");
    setTranscriptConfidence(null);
    setLowConfidenceSegments([]);

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
      if (addedFinal) {
        setFinalTranscript((prev) => {
          const merged = mergeTranscriptFragment(prev, addedFinal);
          return applyTranscriptQuality(merged);
        });
      }
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
  }, [applyTranscriptQuality, recognitionLanguage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterimTranscript("");
    setPhase("generating");

    setTimeout(() => {
      regenerateFromTranscript(finalTranscript);
      setPhase("reviewing");
    }, 600);
  }, [finalTranscript, regenerateFromTranscript]);

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
    setTranscriptConfidence(null);
    setLowConfidenceSegments([]);
    setCorrectionTarget(null);
    setCorrectionValue("");
    setCorrectionHistory([]);
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

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Language</p>
                <select
                  value={recognitionLanguage}
                  onChange={(event) => setRecognitionLanguage(event.target.value as RecognitionLanguage)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-slate-800 px-3 text-[11px] text-slate-100"
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Priority Vocabulary</p>
                <input
                  value={customVocabularyInput}
                  onChange={(event) => setCustomVocabularyInput(event.target.value)}
                  placeholder="troponin, metoprolol, atrial fibrillation"
                  className="h-10 w-full rounded-xl border border-white/10 bg-slate-800 px-3 text-[11px] text-slate-100 placeholder:text-slate-500"
                />
              </div>
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
              <span className="text-slate-200">
                {transcriptHighlightParts.map((part, index) => {
                  if (!part.flagged) {
                    return <span key={`plain-${index}`}>{part.text}</span>;
                  }

                  const isActive = activeFlag?.text.toLowerCase() === part.flagged.text.toLowerCase();
                  return (
                    <button
                      key={`flag-${part.flagged.text}-${index}`}
                      type="button"
                      onClick={() => openCorrectionEditor(part.flagged!.text)}
                      className={`rounded px-1 ${isActive ? "bg-amber-400/40 text-amber-100" : "bg-amber-400/20 text-amber-100/90"}`}
                      title={`Flagged (${Math.round(part.flagged.confidence * 100)}%): ${part.flagged.issues.join(", ") || "review"}`}
                    >
                      {part.text}
                    </button>
                  );
                })}
              </span>
              <span className="text-slate-500 italic">{interimTranscript}</span>
            </div>

            {lowConfidenceSegments.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[10px]">
                <span className="font-black uppercase tracking-wider text-slate-300">
                  Flag {Math.min(activeFlagIndex + 1, navigableLowConfidenceSegments.length)}/{navigableLowConfidenceSegments.length}
                </span>
                <button
                  type="button"
                  onClick={() => cycleActiveFlag(-1)}
                  className="rounded border border-white/20 px-2 py-1 font-black uppercase tracking-widest text-slate-200 hover:bg-white/10"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => cycleActiveFlag(1)}
                  className="rounded border border-white/20 px-2 py-1 font-black uppercase tracking-widest text-slate-200 hover:bg-white/10"
                >
                  Next
                </button>
                {activeFlag && (
                  <button
                    type="button"
                    onClick={() => openCorrectionEditor(activeFlag.text)}
                    className="rounded border border-amber-300/40 px-2 py-1 font-black uppercase tracking-widest text-amber-100 hover:bg-amber-300/10"
                  >
                    Edit Active
                  </button>
                )}
              </div>
            ) : null}

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

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => insertSpeakerTag("Provider")}
                className="rounded-md border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-200 hover:bg-white/10"
              >
                Tag Provider
              </button>
              <button
                type="button"
                onClick={() => insertSpeakerTag("Patient")}
                className="rounded-md border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-200 hover:bg-white/10"
              >
                Tag Patient
              </button>
              <button
                type="button"
                onClick={copyQualityPack}
                className="rounded-md border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-200 hover:bg-white/10"
              >
                <ClipboardList className="mr-1 inline h-3 w-3" />Copy QA Pack
              </button>
            </div>

            {transcriptConfidence !== null && (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[10px] text-slate-300">
                Transcript confidence: <span className="font-black">{Math.round(transcriptConfidence * 100)}%</span>
              </div>
            )}

            {lowConfidenceSegments.length > 0 ? (
              <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-[10px] text-amber-100">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black uppercase tracking-widest text-[9px]">Review suggested phrases</p>
                  <button
                    type="button"
                    onClick={() => setShowHighImpactOnly((current) => !current)}
                    className="rounded border border-amber-300/40 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-amber-300/10"
                  >
                    {showHighImpactOnly ? "Show All" : "High Impact"}
                  </button>
                </div>
                <ul className="mt-2 space-y-1 text-[10px]">
                  {displayedLowConfidenceSegments.map((segment, index) => (
                    <li key={`${segment.text}-${index}`}>
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={selectedFlagSet.has(flagKey(segment.text))}
                          onChange={() => toggleFlagSelection(segment.text)}
                          className="h-3.5 w-3.5"
                          title="Select for batch action"
                        />
                        <button
                          type="button"
                          onClick={() => openCorrectionEditor(segment.text)}
                          className="w-full truncate rounded-md border border-amber-300/30 px-2 py-1 text-left hover:bg-amber-300/10"
                          title="Edit this phrase"
                        >
                          • {segment.text}
                        </button>
                        <button
                          type="button"
                          onClick={() => ignoreFlagPhrase(segment.text)}
                          className="rounded-md border border-amber-300/30 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-amber-300/10"
                          title="Ignore phrase"
                        >
                          Ignore
                        </button>
                        <button
                          type="button"
                          onClick={() => selectMatchingFlags(segment.text)}
                          className="rounded-md border border-amber-300/30 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-amber-300/10"
                          title="Select matching flagged phrases"
                        >
                          Match
                        </button>
                        <button
                          type="button"
                          onClick={() => addPhraseToVocabulary(segment.text)}
                          className="rounded-md border border-amber-300/30 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-amber-300/10"
                          title="Add phrase to custom vocabulary"
                        >
                          Vocab
                        </button>
                      </div>
                      <p className="mt-0.5 truncate text-[9px] text-amber-200">
                        {Math.round(segment.confidence * 100)}% confidence
                        {segment.issues.length > 0 ? ` • ${segment.issues.join(", ")}` : ""}
                      </p>
                    </li>
                  ))}
                  {displayedLowConfidenceSegments.length === 0 && (
                    <li className="text-[9px] text-amber-200">No high-impact phrases in current flags.</li>
                  )}
                </ul>
              </div>
            ) : null}

            {lowConfidenceSegments.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[10px] text-slate-200">
                <p className="font-black uppercase tracking-widest text-[9px]">Batch actions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={selectAllFlags} className="rounded border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-white/10">Select all</button>
                  <button type="button" onClick={clearSelectedFlags} className="rounded border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-white/10">Clear</button>
                  <button type="button" onClick={batchIgnoreSelected} className="rounded border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-white/10">Ignore selected</button>
                  <button
                    type="button"
                    onClick={() => activeFlag && selectMatchingFlags(activeFlag.text)}
                    disabled={!activeFlag}
                    className="rounded border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Select Active Matches
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={batchReplaceValue}
                    onChange={(event) => setBatchReplaceValue(event.target.value)}
                    placeholder="Batch replacement text"
                    className="h-8 flex-1 rounded border border-white/20 bg-slate-900/60 px-2 text-[10px]"
                  />
                  <button type="button" onClick={batchReplaceSelected} className="rounded border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-white/10">Replace selected</button>
                </div>
                {selectedBatchPreview.length > 0 ? (
                  <div className="mt-2 rounded border border-white/10 bg-slate-900/40 px-2 py-2 text-[9px]">
                    <p className="font-black uppercase tracking-widest text-slate-300">Replacement preview</p>
                    <div className="mt-1 max-h-16 space-y-1 overflow-y-auto text-slate-300">
                      {selectedBatchPreview.map((item) => (
                        <p key={item.text} className="truncate">
                          {item.text}{" -> "}{item.matches} match(es)
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="mt-2 text-[9px] text-slate-400">Selected: {selectedFlagKeys.length}</p>
              </div>
            ) : null}

            {weakPhraseTrends.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[10px] text-slate-200">
                <p className="font-black uppercase tracking-widest text-[9px]">Weak phrase trends</p>
                <div className="mt-2 space-y-1">
                  {weakPhraseTrends.map((item) => (
                    <p key={item.phrase} className="truncate text-[9px] text-slate-300">
                      {item.phrase} • {item.count}x • min {Math.round(item.minConfidence * 100)}%
                      {item.issues.length > 0 ? ` • ${item.issues.join(", ")}` : ""}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[10px] text-slate-200">
              <p className="font-black uppercase tracking-widest text-[9px]">Vocabulary auto-promote</p>
              <label className="mt-2 flex items-center gap-2 text-[9px] text-slate-300">
                <input
                  type="checkbox"
                  checked={autoPromoteVocabulary}
                  onChange={(event) => setAutoPromoteVocabulary(event.target.checked)}
                />
                Auto-add corrected phrases to vocabulary
              </label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] text-slate-400">Threshold</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={autoPromoteThreshold}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) return;
                    setAutoPromoteThreshold(Math.max(1, Math.min(10, Math.round(next))));
                  }}
                  className="h-7 w-16 rounded border border-white/20 bg-slate-900/60 px-2 text-[10px]"
                />
              </div>
            </div>

            {correctionTarget && (
              <div className="rounded-2xl border border-blue-400/40 bg-blue-400/10 px-4 py-3 text-[10px] text-blue-100">
                <p className="font-black uppercase tracking-widest text-[9px]">Quick correction</p>
                <p className="mt-1 text-[10px] text-blue-200">Original: {correctionTarget}</p>
                <input
                  value={correctionValue}
                  onChange={(event) => setCorrectionValue(event.target.value)}
                  className="mt-2 w-full rounded-md border border-blue-300/40 bg-slate-900/60 px-2 py-1 text-[10px] text-blue-50 outline-none"
                />
                <label className="mt-2 flex items-center gap-2 text-[9px] font-semibold text-blue-100">
                  <input
                    type="checkbox"
                    checked={replaceAllCorrections}
                    onChange={(event) => setReplaceAllCorrections(event.target.checked)}
                  />
                  Replace all occurrences
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={applyCorrection}
                    className="rounded-md bg-blue-500 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white hover:bg-blue-400"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCorrectionTarget(null); setCorrectionValue(""); }}
                    className="rounded-md border border-blue-300/40 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-blue-100 hover:bg-blue-300/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {ignoredFlagPhrases.length > 0 && (
              <div className="rounded-2xl border border-slate-600/60 bg-slate-800/60 px-4 py-3 text-[10px] text-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black uppercase tracking-widest text-[9px]">Ignored flagged phrases</p>
                  <button
                    type="button"
                    onClick={clearIgnoredFlags}
                    className="rounded-md border border-slate-400/40 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-slate-700/60"
                  >
                    Clear
                  </button>
                </div>
                <p className="mt-2 truncate text-[10px] text-slate-300">{ignoredFlagPhrases.join(" • ")}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={acceptAllCleanups}
                className="rounded-md border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-200 hover:bg-white/10"
              >
                Accept All Cleanups
              </button>
            </div>
            <p className="text-[9px] text-slate-400">
              Shortcuts: Alt+N next flag, Alt+P previous flag, Alt+E edit active flag, Alt+S select active matches, Alt+A accept all cleanups.
            </p>

            {correctionHistory.length > 0 && (
              <div className="rounded-2xl border border-slate-600/60 bg-slate-800/60 px-4 py-3 text-[10px] text-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black uppercase tracking-widest text-[9px]">Correction history</p>
                  <button
                    type="button"
                    onClick={undoLastCorrection}
                    className="rounded-md border border-slate-400/40 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-slate-700/60"
                  >
                    <Undo2 className="mr-1 inline h-3 w-3" />Undo Last
                  </button>
                </div>
                <div className="mt-2 max-h-22 space-y-1 overflow-y-auto">
                  {correctionHistory.slice(0, 5).map((entry) => (
                    <p key={`${entry.at}-${entry.target}`} className="truncate text-[10px] text-slate-300">
                      {new Date(entry.at).toLocaleTimeString()} • {entry.target}{" -> "}{entry.replacement}
                    </p>
                  ))}
                </div>
              </div>
            )}

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
            {lowConfidenceSegments.length > 0 ? (
              <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-[10px] text-amber-100">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black uppercase tracking-widest text-[9px]">Tap a phrase to correct before save</p>
                  <button
                    type="button"
                    onClick={() => setShowHighImpactOnly((current) => !current)}
                    className="rounded border border-amber-300/40 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-amber-300/10"
                  >
                    {showHighImpactOnly ? "Show All" : "High Impact"}
                  </button>
                </div>
                <ul className="mt-2 space-y-1 text-[10px]">
                  {displayedLowConfidenceSegments.map((segment, index) => (
                    <li key={`${segment.text}-${index}`}>
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={selectedFlagSet.has(flagKey(segment.text))}
                          onChange={() => toggleFlagSelection(segment.text)}
                          className="h-3.5 w-3.5"
                          title="Select for batch action"
                        />
                        <button
                          type="button"
                          onClick={() => openCorrectionEditor(segment.text)}
                          className="w-full truncate rounded-md border border-amber-300/30 px-2 py-1 text-left hover:bg-amber-300/10"
                          title="Edit this phrase"
                        >
                          • {segment.text}
                        </button>
                        <button
                          type="button"
                          onClick={() => ignoreFlagPhrase(segment.text)}
                          className="rounded-md border border-amber-300/30 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-amber-300/10"
                          title="Ignore phrase"
                        >
                          Ignore
                        </button>
                        <button
                          type="button"
                          onClick={() => selectMatchingFlags(segment.text)}
                          className="rounded-md border border-amber-300/30 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-amber-300/10"
                          title="Select matching flagged phrases"
                        >
                          Match
                        </button>
                        <button
                          type="button"
                          onClick={() => addPhraseToVocabulary(segment.text)}
                          className="rounded-md border border-amber-300/30 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-amber-300/10"
                          title="Add phrase to custom vocabulary"
                        >
                          Vocab
                        </button>
                      </div>
                      <p className="mt-0.5 truncate text-[9px] text-amber-200">
                        {Math.round(segment.confidence * 100)}% confidence
                        {segment.issues.length > 0 ? ` • ${segment.issues.join(", ")}` : ""}
                      </p>
                    </li>
                  ))}
                  {displayedLowConfidenceSegments.length === 0 && (
                    <li className="text-[9px] text-amber-200">No high-impact phrases in current flags.</li>
                  )}
                </ul>
              </div>
            ) : null}

            {lowConfidenceSegments.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[10px] text-slate-200">
                <p className="font-black uppercase tracking-widest text-[9px]">Batch actions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={selectAllFlags} className="rounded border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-white/10">Select all</button>
                  <button type="button" onClick={clearSelectedFlags} className="rounded border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-white/10">Clear</button>
                  <button type="button" onClick={batchIgnoreSelected} className="rounded border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-white/10">Ignore selected</button>
                  <button
                    type="button"
                    onClick={() => activeFlag && selectMatchingFlags(activeFlag.text)}
                    disabled={!activeFlag}
                    className="rounded border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Select Active Matches
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={batchReplaceValue}
                    onChange={(event) => setBatchReplaceValue(event.target.value)}
                    placeholder="Batch replacement text"
                    className="h-8 flex-1 rounded border border-white/20 bg-slate-900/60 px-2 text-[10px]"
                  />
                  <button type="button" onClick={batchReplaceSelected} className="rounded border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-white/10">Replace selected</button>
                </div>
                {selectedBatchPreview.length > 0 ? (
                  <div className="mt-2 rounded border border-white/10 bg-slate-900/40 px-2 py-2 text-[9px]">
                    <p className="font-black uppercase tracking-widest text-slate-300">Replacement preview</p>
                    <div className="mt-1 max-h-16 space-y-1 overflow-y-auto text-slate-300">
                      {selectedBatchPreview.map((item) => (
                        <p key={item.text} className="truncate">
                          {item.text}{" -> "}{item.matches} match(es)
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="mt-2 text-[9px] text-slate-400">Selected: {selectedFlagKeys.length}</p>
              </div>
            ) : null}

            {weakPhraseTrends.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[10px] text-slate-200">
                <p className="font-black uppercase tracking-widest text-[9px]">Weak phrase trends</p>
                <div className="mt-2 space-y-1">
                  {weakPhraseTrends.map((item) => (
                    <p key={item.phrase} className="truncate text-[9px] text-slate-300">
                      {item.phrase} • {item.count}x • min {Math.round(item.minConfidence * 100)}%
                      {item.issues.length > 0 ? ` • ${item.issues.join(", ")}` : ""}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[10px] text-slate-200">
              <p className="font-black uppercase tracking-widest text-[9px]">Vocabulary auto-promote</p>
              <label className="mt-2 flex items-center gap-2 text-[9px] text-slate-300">
                <input
                  type="checkbox"
                  checked={autoPromoteVocabulary}
                  onChange={(event) => setAutoPromoteVocabulary(event.target.checked)}
                />
                Auto-add corrected phrases to vocabulary
              </label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] text-slate-400">Threshold</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={autoPromoteThreshold}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) return;
                    setAutoPromoteThreshold(Math.max(1, Math.min(10, Math.round(next))));
                  }}
                  className="h-7 w-16 rounded border border-white/20 bg-slate-900/60 px-2 text-[10px]"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={acceptAllCleanups}
                className="rounded-md border border-white/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-200 hover:bg-white/10"
              >
                Accept All Cleanups
              </button>
            </div>

            {correctionTarget && (
              <div className="rounded-2xl border border-blue-400/40 bg-blue-400/10 px-4 py-3 text-[10px] text-blue-100">
                <p className="font-black uppercase tracking-widest text-[9px]">Quick correction</p>
                <p className="mt-1 text-[10px] text-blue-200">Original: {correctionTarget}</p>
                <input
                  value={correctionValue}
                  onChange={(event) => setCorrectionValue(event.target.value)}
                  className="mt-2 w-full rounded-md border border-blue-300/40 bg-slate-900/60 px-2 py-1 text-[10px] text-blue-50 outline-none"
                />
                <label className="mt-2 flex items-center gap-2 text-[9px] font-semibold text-blue-100">
                  <input
                    type="checkbox"
                    checked={replaceAllCorrections}
                    onChange={(event) => setReplaceAllCorrections(event.target.checked)}
                  />
                  Replace all occurrences
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={applyCorrection}
                    className="rounded-md bg-blue-500 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white hover:bg-blue-400"
                  >
                    Apply + Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCorrectionTarget(null); setCorrectionValue(""); }}
                    className="rounded-md border border-blue-300/40 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-blue-100 hover:bg-blue-300/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {correctionHistory.length > 0 && (
              <div className="rounded-2xl border border-slate-600/60 bg-slate-800/60 px-4 py-3 text-[10px] text-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black uppercase tracking-widest text-[9px]">Correction history</p>
                  <button
                    type="button"
                    onClick={undoLastCorrection}
                    className="rounded-md border border-slate-400/40 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-slate-700/60"
                  >
                    <Undo2 className="mr-1 inline h-3 w-3" />Undo Last
                  </button>
                </div>
                <div className="mt-2 max-h-22 space-y-1 overflow-y-auto">
                  {correctionHistory.slice(0, 5).map((entry) => (
                    <p key={`${entry.at}-${entry.target}`} className="truncate text-[10px] text-slate-300">
                      {new Date(entry.at).toLocaleTimeString()} • {entry.target}{" -> "}{entry.replacement}
                    </p>
                  ))}
                </div>
              </div>
            )}

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