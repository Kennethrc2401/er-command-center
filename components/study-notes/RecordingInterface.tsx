"use client";

import { useState, useRef, useEffect, useCallback, useMemo, type ChangeEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mic, StopCircle, BookmarkPlus, CheckCircle2, AlertTriangle, Loader2, Stethoscope, Undo2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { extractTopicsFromTranscription } from "@/lib/helpers/academicAI";
import {
  mergeTranscriptFragment,
  splitTranscriptForHighlights,
  summarizeTranscriptQuality,
  type TranscriptQualitySegment,
} from "@/lib/helpers/transcriptionQuality";

const RECORDING_DRAFT_STORAGE_KEY = "study-notes:recording-draft";
const RECORDING_DEBUG_ENABLED = process.env.NEXT_PUBLIC_RECORDING_DEBUG === "true";
const RECORDING_CUSTOM_VOCAB_KEY = "study-notes:custom-vocabulary";
const RECORDING_IGNORED_FLAGS_KEY = "study-notes:ignored-flags";
const RECORDING_AUTO_PROMOTE_VOCAB_KEY = "study-notes:auto-promote-vocabulary";
const RECORDING_AUTO_PROMOTE_THRESHOLD_KEY = "study-notes:auto-promote-threshold";
const RECORDING_PHRASE_FIX_COUNTS_KEY = "study-notes:phrase-fix-counts";

const RECOGNITION_LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "es-MX", label: "Spanish (Latin America)" },
  { value: "es-US", label: "Mixed English + Spanish (Beta)" },
] as const;

type RecognitionLanguage = (typeof RECOGNITION_LANGUAGE_OPTIONS)[number]["value"];

type StarterTemplateSeed = {
  label: string;
  content: string;
};

const STARTER_TEMPLATES_BY_LANGUAGE: Record<RecognitionLanguage, StarterTemplateSeed[]> = {
  "en-US": [
    { label: "Exam Focus", content: "Exam focus: clarify this concept and expected question types." },
    { label: "Define Term", content: "Definition: [term] means [meaning]." },
    { label: "Action Item", content: "Action item: review this tonight and create flashcards." },
    { label: "Ask Prof", content: "Question for professor: can you explain this step again?" },
    { label: "Clinical Link", content: "Clinical relevance: this applies to patient care when..." },
  ],
  "es-ES": [
    { label: "Clave de examen", content: "Clave de examen: aclarar este concepto y posibles preguntas." },
    { label: "Definicion", content: "Definicion: [termino] significa [significado]." },
    { label: "Tarea", content: "Tarea: repasar esto hoy y hacer tarjetas de estudio." },
    { label: "Pregunta al profe", content: "Pregunta para el profesor: puede explicar este paso otra vez?" },
    { label: "Relacion clinica", content: "Relacion clinica: esto aplica al cuidado del paciente cuando..." },
  ],
  "es-MX": [
    { label: "Clave de examen", content: "Clave de examen: aclarar este concepto y preguntas probables." },
    { label: "Definicion", content: "Definicion: [termino] quiere decir [significado]." },
    { label: "Pendiente", content: "Pendiente: estudiar esto hoy y hacer tarjetas." },
    { label: "Duda para profe", content: "Duda para el profe: puede repetir este paso?" },
    { label: "Aplicacion clinica", content: "Aplicacion clinica: esto se usa en pacientes cuando..." },
  ],
  "es-US": [
    { label: "Bilingual Summary", content: "Summary/Resumen: key point in English + espanol for review." },
    { label: "Term Pair", content: "Termino clave / key term: [espanol] = [english]." },
    { label: "Ask Clarification", content: "Pregunta/question: can you explain this in both languages?" },
    { label: "Action Item", content: "Action item/tarea: review this section and practice both terms." },
    { label: "Clinical Context", content: "Contexto clinico / clinical context: this matters when..." },
  ],
};

type MarkerType = "Exam" | "Definition" | "Formula" | "Action Item" | "General";

type ClassModePreset = {
  id: string;
  label: string;
  subjectHint: string;
  defaultClassName: string;
  defaultMarkerLabel: string;
  defaultMarkerType: MarkerType;
  autoPauseThresholdSeconds: number;
  preferredExportFormat: "markdown" | "txt";
};

const CLASS_MODE_PRESETS: ClassModePreset[] = [
  {
    id: "med-lecture",
    label: "Med Lecture",
    subjectHint: "Medicine / Nursing",
    defaultClassName: "Clinical Lecture",
    defaultMarkerLabel: "Exam hint",
    defaultMarkerType: "Exam",
    autoPauseThresholdSeconds: 150,
    preferredExportFormat: "markdown",
  },
  {
    id: "formula-heavy",
    label: "Formula Heavy",
    subjectHint: "Math / Physics / Engineering",
    defaultClassName: "Problem-Solving Session",
    defaultMarkerLabel: "Formula",
    defaultMarkerType: "Formula",
    autoPauseThresholdSeconds: 120,
    preferredExportFormat: "markdown",
  },
  {
    id: "review-session",
    label: "Review Session",
    subjectHint: "Exam Review",
    defaultClassName: "Exam Review",
    defaultMarkerLabel: "Action item",
    defaultMarkerType: "Action Item",
    autoPauseThresholdSeconds: 90,
    preferredExportFormat: "txt",
  },
];

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type RecordingMarker = {
  label: string;
  markerType: MarkerType;
  elapsedSeconds: number;
  createdAt: number;
};

type NoteTemplate = {
  id: string;
  label: string;
  content: string;
  createdAt: number;
};

type TemplateImportMode = "replace" | "merge";

type TemplateImportPreview = {
  mode: TemplateImportMode;
  foundInFileCount: number;
  validCount: number;
  duplicateInFileCount: number;
  duplicateAgainstExistingCount: number;
  newToAddCount: number;
  replacingExistingCount: number;
  finalTemplates: NoteTemplate[];
  sampleTemplates: Array<{ label: string; content: string }>;
};

type CorrectionHistoryEntry = {
  at: number;
  target: string;
  replacement: string;
  transcriptionBefore: string;
  transcriptionAfter: string;
};

type ReviewSuite = "all" | "high-impact" | "strict";

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type RecordingMode = "voice" | "text";

type SpeechEngineStatus = "idle" | "starting" | "listening" | "restarting" | "error" | "unsupported";

interface RecordingInterfaceProps {
  subject: string;
  userId: Id<"users">;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
}

export default function RecordingInterface({
  subject,
  userId,
  isRecording,
  setIsRecording,
}: RecordingInterfaceProps) {
  const defaultPreset = CLASS_MODE_PRESETS[0];
  const [className, setClassName] = useState(`${subject} Class`);
  const [professor, setProfessor] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>(defaultPreset.id);
  const [autoPauseThresholdSeconds, setAutoPauseThresholdSeconds] = useState<number>(defaultPreset.autoPauseThresholdSeconds);
  const [preferredExportFormat, setPreferredExportFormat] = useState<"markdown" | "txt">(defaultPreset.preferredExportFormat);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [transcription, setTranscription] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingMarkers, setRecordingMarkers] = useState<RecordingMarker[]>([]);
  const [markerLabel, setMarkerLabel] = useState(defaultPreset.defaultMarkerLabel);
  const [markerType, setMarkerType] = useState<MarkerType>(defaultPreset.defaultMarkerType);
  const [lastSpeechAt, setLastSpeechAt] = useState(0);
  const [lastAudioActivityAt, setLastAudioActivityAt] = useState(0);
  const [pauseStartedAt, setPauseStartedAt] = useState<number | null>(null);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [audioQuality, setAudioQuality] = useState<"Good" | "Fair" | "Poor" | "Unknown">("Unknown");
  const [bytesRecorded, setBytesRecorded] = useState(0);
  const [speechEngineStatus, setSpeechEngineStatus] = useState<SpeechEngineStatus>("idle");
  const [speechEngineError, setSpeechEngineError] = useState<string | null>(null);
  const [transcriptConfidence, setTranscriptConfidence] = useState<number | null>(null);
  const [lowConfidenceSegments, setLowConfidenceSegments] = useState<TranscriptQualitySegment[]>([]);
  const [correctionTarget, setCorrectionTarget] = useState<string | null>(null);
  const [correctionValue, setCorrectionValue] = useState("");
  const [replaceAllCorrections, setReplaceAllCorrections] = useState(false);
  const [ignoredFlagPhrases, setIgnoredFlagPhrases] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(RECORDING_IGNORED_FLAGS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [correctionHistory, setCorrectionHistory] = useState<CorrectionHistoryEntry[]>([]);
  const [activeFlagIndex, setActiveFlagIndex] = useState(0);
  const [selectedFlagKeys, setSelectedFlagKeys] = useState<string[]>([]);
  const [batchReplaceValue, setBatchReplaceValue] = useState("");
  const [reviewSuite, setReviewSuite] = useState<ReviewSuite>("all");
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>([]);
  const [autoPromoteVocabulary, setAutoPromoteVocabulary] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = window.localStorage.getItem(RECORDING_AUTO_PROMOTE_VOCAB_KEY);
    return raw === null ? true : raw === "1";
  });
  const [autoPromoteThreshold, setAutoPromoteThreshold] = useState<number>(() => {
    if (typeof window === "undefined") return 3;
    const raw = window.localStorage.getItem(RECORDING_AUTO_PROMOTE_THRESHOLD_KEY);
    const parsed = raw ? Number(raw) : 3;
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 10 ? parsed : 3;
  });
  const [phraseFixCounts, setPhraseFixCounts] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(RECORDING_PHRASE_FIX_COUNTS_KEY);
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
  const [isRunningPreflight, setIsRunningPreflight] = useState(false);
  const [preflightResult, setPreflightResult] = useState<string | null>(null);
  const [customVocabularyInput, setCustomVocabularyInput] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(RECORDING_CUSTOM_VOCAB_KEY) ?? "";
  });
  const [hasRecoverableDraft, setHasRecoverableDraft] = useState(() => {
    if (typeof window === "undefined") return false;
    const raw = window.localStorage.getItem(RECORDING_DRAFT_STORAGE_KEY);
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw) as { transcription?: string };
      return Boolean(parsed?.transcription);
    } catch {
      return false;
    }
  });
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("voice");
  const [templates, setTemplates] = useState<NoteTemplate[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem("study-notes:templates");
    if (!raw) return [];
    try {
      return JSON.parse(raw) as NoteTemplate[];
    } catch {
      return [];
    }
  });
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateEditing, setTemplateEditing] = useState<NoteTemplate | null>(null);
  const [templateInputLabel, setTemplateInputLabel] = useState("");
  const [templateInputContent, setTemplateInputContent] = useState("");
  const [templateImportMode, setTemplateImportMode] = useState<TemplateImportMode>("replace");
  const [templateImportPreview, setTemplateImportPreview] = useState<TemplateImportPreview | null>(null);
  const [showAllImportSamples, setShowAllImportSamples] = useState(false);
  const [templateImportSearch, setTemplateImportSearch] = useState("");
  const [recognitionLanguage, setRecognitionLanguage] = useState<RecognitionLanguage>(() => {
    if (typeof window === "undefined") return "en-US";
    const saved = window.localStorage.getItem("study-notes:recognition-language") as RecognitionLanguage | null;
    if (!saved) return "en-US";

    const isSupportedOption = RECOGNITION_LANGUAGE_OPTIONS.some((option) => option.value === saved);
    return isSupportedOption ? saved : "en-US";
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionLanguageRef = useRef<RecognitionLanguage>("en-US");
  const templateImportInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRestartTimeoutRef = useRef<number | NodeJS.Timeout | null>(null);
  const recognitionShouldRunRef = useRef(false);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const qualityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const createSession = useMutation(api.academicScribe.createStudySession);
  const endSession = useMutation(api.academicScribe.endStudySession);
  const createNote = useMutation(api.academicScribe.createStudyNote);
  const discardSession = useMutation(api.academicScribe.discardStudySession);

  const logDebug = useCallback((...args: unknown[]) => {
    if (RECORDING_DEBUG_ENABLED) {
      console.log(...args);
    }
  }, []);

  const customVocabulary = customVocabularyInput
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);

  const ignoredFlagSet = useMemo(
    () => new Set(ignoredFlagPhrases.map((phrase) => phrase.toLowerCase())),
    [ignoredFlagPhrases]
  );

  const transcriptHighlightParts = useMemo(
    () => splitTranscriptForHighlights(transcription, lowConfidenceSegments),
    [lowConfidenceSegments, transcription]
  );

  const recentConfidenceAverage = useMemo(() => {
    if (confidenceHistory.length === 0) return null;
    return confidenceHistory.reduce((total, value) => total + value, 0) / confidenceHistory.length;
  }, [confidenceHistory]);

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
    if (!transcription || selectedFlagKeys.length === 0) return [] as Array<{ text: string; matches: number }>;

    const selectedTexts = lowConfidenceSegments
      .filter((segment) => selectedFlagSet.has(normalizeFlagText(segment.text)))
      .map((segment) => segment.text)
      .filter((text, index, array) => array.findIndex((item) => item.toLowerCase() === text.toLowerCase()) === index);

    return selectedTexts
      .map((text) => ({
        text,
        matches: (transcription.match(new RegExp(escapeForRegExp(text), "gi")) ?? []).length,
      }))
      .filter((item) => item.matches > 0)
      .sort((a, b) => b.matches - a.matches);
  }, [lowConfidenceSegments, selectedFlagKeys.length, selectedFlagSet, transcription]);

  const displayedLowConfidenceSegments = useMemo(() => {
    if (reviewSuite === "all") return lowConfidenceSegments;
    return lowConfidenceSegments.filter((segment) => {
      const issuesText = segment.issues.join(" ").toLowerCase();
      if (reviewSuite === "high-impact") {
        return (
          segment.confidence <= 0.72 ||
          segment.issues.length >= 2 ||
          /unclear|low|dosage|medication|drug|name|number|frequency/.test(issuesText)
        );
      }

      return (
        segment.confidence <= 0.6 ||
        segment.issues.length >= 3 ||
        /unclear|low|dosage|medication|drug|name|number|frequency|ambiguous|uncertain/.test(issuesText)
      );
    });
  }, [lowConfidenceSegments, reviewSuite]);

  const navigableLowConfidenceSegments = displayedLowConfidenceSegments;

  const activeFlag = navigableLowConfidenceSegments[activeFlagIndex] ?? null;

  const qualityPack = useMemo(() => {
    const lines = [
      `Study Notes QA Pack (${new Date().toLocaleString()})`,
      `Subject: ${subject}`,
      `Mode: ${recordingMode}`,
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
      transcription || "(empty)",
    ];
    return lines.join("\n");
  }, [correctionHistory.length, customVocabulary, ignoredFlagPhrases, lowConfidenceSegments, recordingMode, recognitionLanguage, subject, transcription, transcriptConfidence]);

  const transcriptionDomain = /med|nurs|clinical|anatom|physio|pharm|triage/i.test(subject)
    ? "clinical"
    : "general";

  const applyTranscriptionQuality = useCallback(
    (value: string) => {
      const summary = summarizeTranscriptQuality(value, {
        domain: transcriptionDomain,
        customVocabulary,
      });
      setTranscriptConfidence(summary.averageConfidence);
      setConfidenceHistory((current) => [...current, summary.averageConfidence].slice(-24));
      setLowConfidenceSegments(
        summary.lowConfidenceSegments.filter((segment) => !ignoredFlagSet.has(segment.text.toLowerCase()))
      );
      return summary.normalizedText;
    },
    [customVocabulary, ignoredFlagSet, transcriptionDomain]
  );

  const acceptAllCleanups = useCallback(() => {
    if (!transcription.trim()) {
      toast.message("No transcript text to clean yet");
      return;
    }

    setTranscription((previous) => applyTranscriptionQuality(previous));
    toast.success("Applied all cleanup suggestions");
  }, [applyTranscriptionQuality, transcription]);

  const cycleActiveFlag = useCallback((direction: -1 | 1) => {
    if (navigableLowConfidenceSegments.length === 0) return;
    setActiveFlagIndex((current) => {
      const next = current + direction;
      if (next < 0) return navigableLowConfidenceSegments.length - 1;
      if (next >= navigableLowConfidenceSegments.length) return 0;
      return next;
    });
  }, [navigableLowConfidenceSegments.length]);

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
    toast.success("Phrase ignored from future warnings");
  }, []);

  const flagKey = useCallback((text: string) => text.trim().toLowerCase(), []);

  const toggleFlagSelection = useCallback((text: string) => {
    const key = flagKey(text);
    setSelectedFlagKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }, [flagKey]);

  const selectAllFlags = useCallback(() => {
    setSelectedFlagKeys(displayedLowConfidenceSegments.map((segment) => flagKey(segment.text)));
  }, [displayedLowConfidenceSegments, flagKey]);

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

    setTranscription((previous) => {
      let updated = previous;
      selectedTexts.forEach((text) => {
        updated = updated.replace(new RegExp(escapeForRegExp(text), "gi"), replacement);
      });

      recordPhraseCorrection(replacement);

      const processed = applyTranscriptionQuality(updated);
      setCorrectionHistory((current) => [
        {
          at: Date.now(),
          target: `Batch (${selectedTexts.length})`,
          replacement,
          transcriptionBefore: previous,
          transcriptionAfter: processed,
        },
        ...current,
      ].slice(0, 25));
      return processed;
    });

    setSelectedFlagKeys([]);
    setBatchReplaceValue("");
    toast.success(`Batch replaced ${selectedTexts.length} flagged phrase(s).`);
  }, [applyTranscriptionQuality, batchReplaceValue, flagKey, lowConfidenceSegments, recordPhraseCorrection, selectedFlagKeys.length, selectedFlagSet]);

  const clearIgnoredFlags = useCallback(() => {
    setIgnoredFlagPhrases([]);
    toast.success("Ignored phrase list cleared");
  }, []);

  const closeCorrectionEditor = useCallback(() => {
    setCorrectionTarget(null);
    setCorrectionValue("");
  }, []);

  const applyCorrection = useCallback(() => {
    const target = correctionTarget?.trim();
    const replacement = correctionValue.trim();

    if (!target || !replacement) {
      toast.error("Correction text is required");
      return;
    }

    const escapedTarget = escapeForRegExp(target);
    const targetPattern = new RegExp(escapedTarget, replaceAllCorrections ? "gi" : "i");

    setTranscription((previous) => {
      if (!targetPattern.test(previous)) {
        toast.error("Selected phrase was not found in transcript");
        return previous;
      }

      const updated = previous.replace(targetPattern, replacement);
      const processed = applyTranscriptionQuality(updated);
      recordPhraseCorrection(replacement);

      setCorrectionHistory((current) => [
        {
          at: Date.now(),
          target,
          replacement,
          transcriptionBefore: previous,
          transcriptionAfter: processed,
        },
        ...current,
      ].slice(0, 25));

      return processed;
    });

    closeCorrectionEditor();
    toast.success("Applied correction");
  }, [applyTranscriptionQuality, closeCorrectionEditor, correctionTarget, correctionValue, recordPhraseCorrection, replaceAllCorrections]);

  const undoLastCorrection = useCallback(() => {
    setCorrectionHistory((current) => {
      if (current.length === 0) {
        toast.message("No correction to undo");
        return current;
      }

      const [latest, ...rest] = current;
      setTranscription(latest.transcriptionBefore);
      applyTranscriptionQuality(latest.transcriptionBefore);
      toast.success("Undid last correction");
      return rest;
    });
  }, [applyTranscriptionQuality]);

  const insertSpeakerTag = useCallback(
    (speaker: "Instructor" | "Student") => {
      const tag = `\n[${speaker}]: `;
      setTranscription((previous) => {
        const merged = mergeTranscriptFragment(previous, tag);
        return applyTranscriptionQuality(merged);
      });
      toast.success(`${speaker} tag inserted`);
    },
    [applyTranscriptionQuality]
  );

  const copyQualityPack = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(qualityPack);
      toast.success("QA pack copied");
    } catch {
      toast.error("Unable to copy QA pack");
    }
  }, [qualityPack]);

  const persistTemplates = useCallback((newTemplates: NoteTemplate[]) => {
    setTemplates(newTemplates);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("study-notes:templates", JSON.stringify(newTemplates));
    }
  }, []);

  const starterLanguageKey: RecognitionLanguage = recognitionLanguage;

  const starterLanguageLabel =
    RECOGNITION_LANGUAGE_OPTIONS.find((option) => option.value === starterLanguageKey)?.label || "Current language";

  const loadStarterTemplates = useCallback(() => {
    const seedTemplates = STARTER_TEMPLATES_BY_LANGUAGE[starterLanguageKey];
    const existingKeys = new Set(templates.map((t) => `${t.label}::${t.content}`));
    const additions: NoteTemplate[] = [];

    for (const seed of seedTemplates) {
      const key = `${seed.label}::${seed.content}`;
      if (!existingKeys.has(key)) {
        additions.push({
          id: crypto.randomUUID(),
          label: seed.label,
          content: seed.content,
          createdAt: Date.now(),
        });
      }
    }

    if (additions.length === 0) {
      toast.message(`Starter templates for ${starterLanguageLabel} are already loaded.`);
      return;
    }

    persistTemplates([...templates, ...additions]);
    toast.success(`Loaded ${additions.length} starter templates for ${starterLanguageLabel}`);
  }, [persistTemplates, starterLanguageKey, starterLanguageLabel, templates]);

  const replaceWithStarterTemplates = useCallback(() => {
    if (templates.length > 0) {
      const confirmed = window.confirm(
        `Replace all current templates with starter templates for ${starterLanguageLabel}?`
      );
      if (!confirmed) return;
    }

    const seedTemplates = STARTER_TEMPLATES_BY_LANGUAGE[starterLanguageKey].map((seed) => ({
      id: crypto.randomUUID(),
      label: seed.label,
      content: seed.content,
      createdAt: Date.now(),
    }));

    persistTemplates(seedTemplates);
    toast.success(`Replaced templates with ${seedTemplates.length} starter templates for ${starterLanguageLabel}`);
  }, [persistTemplates, starterLanguageKey, starterLanguageLabel, templates.length]);

  const exportTemplates = useCallback(() => {
    if (templates.length === 0) {
      toast.message("No templates to export yet.");
      return;
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      templates,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `study-notes-templates-${starterLanguageKey}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success("Templates exported.");
  }, [starterLanguageKey, templates]);

  const openTemplateImportDialog = useCallback(() => {
    templateImportInputRef.current?.click();
  }, []);

  const applyTemplateImport = useCallback(() => {
    if (!templateImportPreview) return;

    persistTemplates(templateImportPreview.finalTemplates);
    if (templateImportPreview.mode === "merge") {
      if (templateImportPreview.newToAddCount === 0) {
        toast.message("No new templates to merge from file.");
      } else {
        toast.success(`Merged ${templateImportPreview.newToAddCount} templates from file.`);
      }
    } else {
      toast.success(`Imported ${templateImportPreview.finalTemplates.length} templates (replaced existing).`);
    }

    setTemplateImportPreview(null);
    setShowAllImportSamples(false);
    setTemplateImportSearch("");
  }, [persistTemplates, templateImportPreview]);

  const cancelTemplateImportPreview = useCallback(() => {
    setTemplateImportPreview(null);
    setShowAllImportSamples(false);
    setTemplateImportSearch("");
    toast.message("Template import cancelled.");
  }, []);

  const importTemplates = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as unknown;

        const candidate = Array.isArray(parsed)
          ? parsed
          : (parsed as { templates?: unknown })?.templates;

        if (!Array.isArray(candidate)) {
          throw new Error("Invalid template file format");
        }

        const foundInFileCount = candidate.length;

        const normalized: NoteTemplate[] = candidate
          .filter((item) => typeof item === "object" && item !== null)
          .map((item) => {
            const template = item as Partial<NoteTemplate>;
            const label = typeof template.label === "string" ? template.label.trim() : "";
            const content = typeof template.content === "string" ? template.content.trim() : "";

            if (!label || !content) {
              return null;
            }

            return {
              id: typeof template.id === "string" && template.id ? template.id : crypto.randomUUID(),
              label,
              content,
              createdAt:
                typeof template.createdAt === "number" && Number.isFinite(template.createdAt)
                  ? template.createdAt
                  : Date.now(),
            };
          })
          .filter((item): item is NoteTemplate => item !== null);

        if (normalized.length === 0) {
          throw new Error("No valid templates found in file");
        }

        const importKeys = new Set<string>();
        const dedupedImports: NoteTemplate[] = [];
        let duplicateInFileCount = 0;

        for (const template of normalized) {
          const key = `${template.label.toLowerCase()}::${template.content.toLowerCase()}`;
          if (importKeys.has(key)) {
            duplicateInFileCount += 1;
            continue;
          }
          importKeys.add(key);
          dedupedImports.push(template);
        }

        if (templateImportMode === "merge") {
          const existingKeys = new Set(templates.map((t) => `${t.label.toLowerCase()}::${t.content.toLowerCase()}`));
          const mergedAdditions = dedupedImports.filter(
            (template) => !existingKeys.has(`${template.label.toLowerCase()}::${template.content.toLowerCase()}`)
          );
          const duplicateAgainstExistingCount = dedupedImports.length - mergedAdditions.length;

          setTemplateImportPreview({
            mode: "merge",
            foundInFileCount,
            validCount: normalized.length,
            duplicateInFileCount,
            duplicateAgainstExistingCount,
            newToAddCount: mergedAdditions.length,
            replacingExistingCount: 0,
            finalTemplates: [...templates, ...mergedAdditions],
            sampleTemplates: dedupedImports.map((template) => ({
              label: template.label,
              content: template.content,
            })),
          });
          setShowAllImportSamples(false);
          setTemplateImportSearch("");
        } else {
          setTemplateImportPreview({
            mode: "replace",
            foundInFileCount,
            validCount: normalized.length,
            duplicateInFileCount,
            duplicateAgainstExistingCount: 0,
            newToAddCount: dedupedImports.length,
            replacingExistingCount: templates.length,
            finalTemplates: dedupedImports,
            sampleTemplates: dedupedImports.map((template) => ({
              label: template.label,
              content: template.content,
            })),
          });
          setShowAllImportSamples(false);
          setTemplateImportSearch("");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to import templates";
        toast.error(`Template import failed: ${message}`);
      } finally {
        event.target.value = "";
      }
    },
    [templateImportMode, templates]
  );

  const createTemplate = useCallback(() => {
    const trimmedLabel = templateInputLabel.trim();
    const trimmedContent = templateInputContent.trim();

    if (!trimmedLabel || !trimmedContent) {
      toast.error("Template label and content are required");
      return;
    }

    if (templateEditing) {
      // Update existing
      const updated = templates.map((t) =>
        t.id === templateEditing.id
          ? { ...t, label: trimmedLabel, content: trimmedContent }
          : t
      );
      persistTemplates(updated);
      toast.success("Template updated");
    } else {
      // Create new
      const newTemplate: NoteTemplate = {
        id: crypto.randomUUID(),
        label: trimmedLabel,
        content: trimmedContent,
        createdAt: Date.now(),
      };
      persistTemplates([...templates, newTemplate]);
      toast.success("Template saved");
    }

    setTemplateEditing(null);
    setTemplateInputLabel("");
    setTemplateInputContent("");
  }, [templateEditing, templateInputLabel, templateInputContent, templates, persistTemplates]);

  const deleteTemplate = useCallback(
    (id: string) => {
      persistTemplates(templates.filter((t) => t.id !== id));
      toast.success("Template deleted");
    },
    [templates, persistTemplates]
  );

  const editTemplate = useCallback((template: NoteTemplate) => {
    setTemplateEditing(template);
    setTemplateInputLabel(template.label);
    setTemplateInputContent(template.content);
  }, []);

  const cancelTemplateEdit = useCallback(() => {
    setTemplateEditing(null);
    setTemplateInputLabel("");
    setTemplateInputContent("");
  }, []);

  const insertTemplate = useCallback(
    (content: string) => {
      setTranscription((prev) => {
        const merged = mergeTranscriptFragment(prev, content);
        return applyTranscriptionQuality(merged);
      });
      toast.success("Template inserted");
    },
    [applyTranscriptionQuality]
  );

  const startTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const stopAudioMeter = useCallback(() => {
    if (qualityIntervalRef.current) {
      clearInterval(qualityIntervalRef.current);
      qualityIntervalRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setAudioQuality("Unknown");
  }, []);

  const clearRecognitionRestart = useCallback(() => {
    if (recognitionRestartTimeoutRef.current) {
      clearTimeout(recognitionRestartTimeoutRef.current);
      recognitionRestartTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RECORDING_CUSTOM_VOCAB_KEY, customVocabularyInput);
  }, [customVocabularyInput]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RECORDING_AUTO_PROMOTE_VOCAB_KEY, autoPromoteVocabulary ? "1" : "0");
  }, [autoPromoteVocabulary]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RECORDING_AUTO_PROMOTE_THRESHOLD_KEY, String(autoPromoteThreshold));
  }, [autoPromoteThreshold]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RECORDING_PHRASE_FIX_COUNTS_KEY, JSON.stringify(phraseFixCounts));
  }, [phraseFixCounts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RECORDING_IGNORED_FLAGS_KEY, JSON.stringify(ignoredFlagPhrases));
  }, [ignoredFlagPhrases]);

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

  const startRecognition = useCallback((allowRetry = true) => {
    const recognition = recognitionRef.current;
    logDebug("🎤 Speech: startRecognition called", {
      hasRecognition: !!recognition,
      shouldRun: recognitionShouldRunRef.current,
      isRecording: isRecordingRef.current,
      isPaused: isPausedRef.current,
      allowRetry,
    });

    if (!recognition || !recognitionShouldRunRef.current || !isRecordingRef.current || isPausedRef.current) {
      logDebug("🎤 Speech: Skipping startRecognition - conditions not met");
      return false;
    }

    try {
      setSpeechEngineStatus("starting");
      setSpeechEngineError(null);
      recognition.start();
      logDebug("✅ Speech: recognition.start() called successfully");
      return true;
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : "";
      console.error("❌ Speech: recognition.start() failed:", errorName, error);
      
      if (allowRetry && errorName === "InvalidStateError") {
        setSpeechEngineStatus("restarting");
        logDebug("🔄 Speech: Scheduling retry in 300ms due to InvalidStateError");
        clearRecognitionRestart();
        recognitionRestartTimeoutRef.current = window.setTimeout(() => {
          logDebug("🔄 Speech: Retrying recognition.start()");
          void startRecognition(false);
        }, 300);
      } else {
        setSpeechEngineStatus("error");
        setSpeechEngineError(errorName || "Failed to start speech recognition");
      }
      return false;
    }
  }, [clearRecognitionRestart, logDebug]);

  const stopRecognition = useCallback(() => {
    recognitionShouldRunRef.current = false;
    clearRecognitionRestart();
    setSpeechEngineStatus("idle");

    try {
      recognitionRef.current?.stop();
    } catch {
      // Speech recognition may already be stopping or stopped.
    }
  }, [clearRecognitionRestart]);

  const handleRecognitionLanguageChange = useCallback(
    (nextLanguage: RecognitionLanguage) => {
      setRecognitionLanguage(nextLanguage);

      if (typeof window !== "undefined") {
        window.localStorage.setItem("study-notes:recognition-language", nextLanguage);
      }

      recognitionLanguageRef.current = nextLanguage;

      if (recognitionRef.current) {
        recognitionRef.current.lang = nextLanguage;
      }

      // If voice capture is active, restart recognition quickly so the new language takes effect now.
      if (recordingMode === "voice" && isRecordingRef.current && !isPausedRef.current && recognitionShouldRunRef.current) {
        setSpeechEngineStatus("restarting");
        clearRecognitionRestart();

        try {
          recognitionRef.current?.stop();
        } catch {
          // Ignore stop timing issues while switching language.
        }

        recognitionRestartTimeoutRef.current = window.setTimeout(() => {
          void startRecognition(false);
        }, 300);
      }

      const selectedLabel =
        RECOGNITION_LANGUAGE_OPTIONS.find((option) => option.value === nextLanguage)?.label || nextLanguage;
      toast.success(`Recognition language set to ${selectedLabel}`);
    },
    [clearRecognitionRestart, recordingMode, startRecognition]
  );

  const startAudioMeter = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      qualityIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        const buffer = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(buffer);
        const avg = buffer.reduce((sum, value) => sum + value, 0) / buffer.length;

        if (avg > 10) {
          setLastAudioActivityAt(Date.now());
        }

        if (avg > 28) {
          setAudioQuality("Good");
        } else if (avg > 14) {
          setAudioQuality("Fair");
        } else {
          setAudioQuality("Poor");
        }
      }, 2000);
    } catch {
      setAudioQuality("Unknown");
    }
  }, []);

  const applyClassPreset = useCallback((presetId: string) => {
    const preset = CLASS_MODE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setSelectedPresetId(preset.id);
    setClassName(preset.defaultClassName);
    setMarkerLabel(preset.defaultMarkerLabel);
    setMarkerType(preset.defaultMarkerType);
    setAutoPauseThresholdSeconds(preset.autoPauseThresholdSeconds);
    setPreferredExportFormat(preset.preferredExportFormat);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("study-notes:preferred-export-format", preset.preferredExportFormat);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !isRecording) return;

    const intervalId = window.setInterval(() => {
      const payload = {
        className,
        professor,
        markerLabel,
        markerType,
        selectedPresetId,
        autoPauseThresholdSeconds,
        preferredExportFormat,
        transcription,
        elapsedTime,
        recordingMarkers,
        pauseSeconds,
        updatedAt: Date.now(),
      };
      window.localStorage.setItem(RECORDING_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [
    isRecording,
    className,
    professor,
    markerLabel,
    markerType,
    selectedPresetId,
    autoPauseThresholdSeconds,
    preferredExportFormat,
    transcription,
    elapsedTime,
    recordingMarkers,
    pauseSeconds,
  ]);

  const getSpeechRecognitionCtor = useCallback(() => {
    const browserWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };

    return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
  }, []);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    
    if (SpeechRecognitionCtor) {
      logDebug("🎤 Speech: Initializing Web Speech API");
      recognitionRef.current = new SpeechRecognitionCtor() as unknown as SpeechRecognitionLike;
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = recognitionLanguageRef.current;
      logDebug(`🎤 Speech: Configuration set (continuous, interimResults, lang=${recognitionLanguageRef.current})`);

      recognitionRef.current.onstart = () => {
        logDebug("✅ Speech: Recognition started - listening for audio");
        setSpeechEngineStatus("listening");
        setSpeechEngineError(null);
        setLastSpeechAt(Date.now());
      };

      recognitionRef.current.onend = () => {
        logDebug("⏹️  Speech: Recognition ended unexpectedly");
        if (recognitionShouldRunRef.current && isRecordingRef.current && !isPausedRef.current) {
          setSpeechEngineStatus("restarting");
          logDebug("🔄 Speech: Auto-restarting because recording is still active");
          clearRecognitionRestart();
          recognitionRestartTimeoutRef.current = window.setTimeout(() => {
            logDebug("🔄 Speech: Calling startRecognition from onend handler");
            void startRecognition(false);
          }, 300);
          return;
        }

        setSpeechEngineStatus("idle");
      };

      recognitionRef.current.onresult = (event: SpeechRecognitionResultEventLike) => {
        logDebug(`📝 Speech: onresult event (resultIndex: ${event.resultIndex}, total results: ${event.results.length})`);
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const isFinal = event.results[i].isFinal;
          
          logDebug(`  Result[${i}]: "${transcript}" (final: ${isFinal})`);
          
          if (transcript.trim()) {
            setLastSpeechAt(Date.now());
            setSpeechEngineStatus("listening");
            setSpeechEngineError(null);
          }

          if (isFinal) {
            logDebug(`  ✅ Final transcript: "${transcript}"`);
            setTranscription((prev) => {
              const merged = mergeTranscriptFragment(prev, transcript);
              return applyTranscriptionQuality(merged);
            });
          } else {
            logDebug(`  💬 Interim result: "${transcript}"`);
          }
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEventLike) => {
        console.error(`❌ Speech: Recognition error - ${event.error}`);
        
        if (event.error === "no-speech") {
          logDebug("⚠️  Speech: No speech detected - microphone may be muted or too quiet");
          return;
        }

        if (event.error === "aborted") {
          logDebug("ℹ️  Speech: Recognition was aborted");
          return;
        }

        setSpeechEngineStatus("error");
        setSpeechEngineError(event.error);
        toast.error(`Transcription error: ${event.error}`);
      };
      
      logDebug("✅ Speech: Web Speech API initialized and ready");
    } else {
      setSpeechEngineStatus("unsupported");
      setSpeechEngineError("This browser does not support speech recognition.");
      console.error("❌ Speech: Web Speech API not supported in this browser");
      toast.error("Speech recognition not supported in your browser");
    }
  }, [applyTranscriptionQuality, clearRecognitionRestart, getSpeechRecognitionCtor, logDebug, startRecognition]);

  useEffect(() => {
    recognitionLanguageRef.current = recognitionLanguage;
    if (!recognitionRef.current) return;
    recognitionRef.current.lang = recognitionLanguage;
    logDebug(`🌐 Speech: Active recognition language set to ${recognitionLanguage}`);
  }, [logDebug, recognitionLanguage]);

  const startRecording = async () => {
    try {
      // Create session in backend (common to both modes)
      const newSessionId = await createSession({
        userId,
        subject,
        className,
        professor: professor || undefined,
      });
      setSessionId(newSessionId);
      logDebug("✅ Recording: Session created with ID:", newSessionId);

      if (recordingMode === "voice") {
        // VOICE MODE: Request mic, start media recorder, start speech recognition
        logDebug("🎙️ Recording: Voice mode - requesting microphone permission...");

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        logDebug("✅ Recording: Microphone permission granted");
        logDebug("📊 Recording: Audio tracks available:", stream.getAudioTracks().length);

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        let totalBytes = 0;

        logDebug("📝 Recording: MediaRecorder created");

        mediaRecorder.ondataavailable = (event) => {
          const bytes = event.data.size;
          totalBytes += bytes;
          audioChunksRef.current.push(event.data);
          logDebug(`📦 Recording: Audio chunk received (${bytes} bytes, total: ${totalBytes} bytes)`);
          setBytesRecorded(totalBytes);
        };

        mediaRecorder.onstop = () => {
          logDebug("⏹️  Recording: MediaRecorder stopped, total bytes:", totalBytes);
          if (recognitionShouldRunRef.current && isRecordingRef.current && !isPausedRef.current) {
            toast.message("Audio capture ended unexpectedly. You can restart the session if needed.");
          }
        };

        mediaRecorder.onerror = (event) => {
          console.error("❌ Recording: MediaRecorder error:", event.error);
          toast.error(`Recording error: ${event.error}`);
        };

        mediaRecorder.start(1000);
        logDebug("🎬 Recording: MediaRecorder started with 1s timeslice");
        startAudioMeter(stream);

        // Start speech-to-text
        logDebug("🎤 Recording: Voice mode - starting speech recognition");
        recognitionShouldRunRef.current = true;
        isRecordingRef.current = true;
        setSpeechEngineStatus("starting");
        setSpeechEngineError(null);
        clearRecognitionRestart();
        const recognitionStarted = startRecognition();
        logDebug("🎤 Recording: Speech recognition start result:", recognitionStarted);
      } else {
        // TEXT MODE: Just set up for typing with timer
        logDebug("📝 Recording: Text mode - ready for manual typing");
        setSpeechEngineStatus("idle");
        setSpeechEngineError(null);
      }

      // Common state reset
      setIsRecording(true);
      setIsPaused(false);
      setRecordingMarkers([]);
      setPauseStartedAt(null);
      setPauseSeconds(0);
      setLastSpeechAt(Date.now());
      setLastAudioActivityAt(Date.now());
      setElapsedTime(0);
      setBytesRecorded(0);
      setTranscription("");
      setTranscriptConfidence(null);
      setConfidenceHistory([]);
      setLowConfidenceSegments([]);
      setCorrectionTarget(null);
      setCorrectionValue("");
      setCorrectionHistory([]);
      setHasRecoverableDraft(false);

      startTimer();
      logDebug("✅ Recording: All systems ready");
      toast.success(`Recording started in ${recordingMode === "voice" ? "voice" : "text"} mode`);
    } catch (error) {
      const err = error as Error;

      if (err?.name === "NotAllowedError" || err?.message?.includes("Permission")) {
        console.error("❌ Recording: Microphone permission denied. Please enable microphone access in your browser settings.");
        toast.error("Microphone permission denied. Please enable it in your browser settings.");
      } else if (err?.name === "NotFoundError") {
        console.error("❌ Recording: No microphone found. Please connect a microphone.");
        toast.error("No microphone found. Please connect a microphone.");
      } else {
        console.error("❌ Recording: Failed to start:", err);
        toast.error("Failed to start recording");
      }
    }
  };

  const runPreflightCheck = async () => {
    if (isRecording) {
      toast.info("Stop the active recording before running pre-flight checks.");
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      setSpeechEngineStatus("unsupported");
      setSpeechEngineError("This browser does not support speech recognition.");
      setPreflightResult("Speech recognition unsupported in this browser.");
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    setIsRunningPreflight(true);
    setSpeechEngineStatus("starting");
    setSpeechEngineError(null);
    setPreflightResult(null);

    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      await new Promise((resolve) => window.setTimeout(resolve, 500));

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buffer);
      const averageLevel = buffer.reduce((sum, value) => sum + value, 0) / buffer.length;
      const micLooksActive = averageLevel > 8;

      const speechSample = await new Promise<string>((resolve, reject) => {
        const recognition = new SpeechRecognitionCtor() as unknown as SpeechRecognitionLike;
        let finalTranscript = "";
        let settled = false;

        const settle = (value: string, isError = false) => {
          if (settled) return;
          settled = true;
          if (isError) {
            reject(new Error(value));
          } else {
            resolve(value);
          }
        };

        const timeoutId = window.setTimeout(() => {
          try {
            recognition.stop();
          } catch {
            // Ignore stop errors in test mode.
          }
          settle(finalTranscript.trim());
        }, 5000);

        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = recognitionLanguage;

        recognition.onstart = () => {
          setSpeechEngineStatus("listening");
        };

        recognition.onresult = (event: SpeechRecognitionResultEventLike) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.trim();
            if (!transcript) continue;

            if (event.results[i].isFinal) {
              finalTranscript = `${finalTranscript} ${transcript}`.trim();
            }
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
          clearTimeout(timeoutId);
          if (event.error === "no-speech") {
            settle(finalTranscript.trim());
            return;
          }
          settle(event.error, true);
        };

        recognition.onend = () => {
          clearTimeout(timeoutId);
          settle(finalTranscript.trim());
        };

        recognition.start();
      });

      const heardText = speechSample.trim();
      if (heardText) {
        setPreflightResult(`Pre-flight passed: mic active and speech recognized ("${heardText}").`);
        setSpeechEngineStatus("idle");
        toast.success("Pre-flight passed: transcription is ready.");
      } else if (micLooksActive) {
        setPreflightResult("Mic is active, but no words were recognized. Speak louder and closer, then retry.");
        setSpeechEngineStatus("error");
        setSpeechEngineError("No words recognized during test.");
        toast.warning("Mic works, but speech was not recognized. Try again in a quieter spot.");
      } else {
        setPreflightResult("Mic signal is very low and no words were recognized. Check mic selection or input volume.");
        setSpeechEngineStatus("error");
        setSpeechEngineError("Low microphone signal during test.");
        toast.warning("Mic signal was low. Check your microphone settings.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pre-flight check failed";
      setSpeechEngineStatus("error");
      setSpeechEngineError(message);
      setPreflightResult(`Pre-flight failed: ${message}`);
      toast.error(`Pre-flight failed: ${message}`);
    } finally {
      if (audioContext) {
        void audioContext.close();
      }
      stream?.getTracks().forEach((track) => track.stop());
      setIsRunningPreflight(false);
    }
  };

  const restoreDraft = () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(RECORDING_DRAFT_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        className?: string;
        professor?: string;
        markerLabel?: string;
        markerType?: MarkerType;
        selectedPresetId?: string;
        autoPauseThresholdSeconds?: number;
        preferredExportFormat?: "markdown" | "txt";
        transcription?: string;
        elapsedTime?: number;
        recordingMarkers?: RecordingMarker[];
        pauseSeconds?: number;
      };

      if (parsed.className) setClassName(parsed.className);
      if (parsed.professor) setProfessor(parsed.professor);
      if (parsed.markerLabel) setMarkerLabel(parsed.markerLabel);
      if (parsed.markerType) setMarkerType(parsed.markerType);
      if (parsed.selectedPresetId) setSelectedPresetId(parsed.selectedPresetId);
      if (parsed.autoPauseThresholdSeconds) setAutoPauseThresholdSeconds(parsed.autoPauseThresholdSeconds);
      if (parsed.preferredExportFormat) setPreferredExportFormat(parsed.preferredExportFormat);
      if (parsed.transcription) setTranscription(parsed.transcription);
      if (parsed.elapsedTime) setElapsedTime(parsed.elapsedTime);
      if (parsed.recordingMarkers) setRecordingMarkers(parsed.recordingMarkers);
      if (parsed.pauseSeconds) setPauseSeconds(parsed.pauseSeconds);

      toast.success("Recovered your last recording draft.");
      setHasRecoverableDraft(false);
    } catch {
      toast.error("Could not restore draft.");
    }
  };

  const clearDraft = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(RECORDING_DRAFT_STORAGE_KEY);
    setHasRecoverableDraft(false);
  };

  const pauseRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !recognitionRef.current || !sessionId) return;

    try {
      logDebug("⏸️  Pause: User paused recording");
      recognitionShouldRunRef.current = false;
      clearRecognitionRestart();
      setSpeechEngineStatus("idle");

      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.pause();
        logDebug("✅ Pause: MediaRecorder paused");
      }

      stopRecognition();
      stopTimer();
      setPauseStartedAt(Date.now());
      setIsPaused(true);
      toast.info("Recording paused");
    } catch (error) {
      console.error("❌ Pause error:", error);
      toast.error("Failed to pause recording");
    }
  }, [clearRecognitionRestart, logDebug, sessionId, stopRecognition, stopTimer]);

  const resumeRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !recognitionRef.current || !sessionId) return;

    try {
      logDebug("▶️  Resume: User resumed recording");
      recognitionShouldRunRef.current = true;
      isRecordingRef.current = true;  // Set ref immediately before calling startRecognition
      isPausedRef.current = false;    // Set ref immediately before calling startRecognition
      setSpeechEngineStatus("starting");
      setSpeechEngineError(null);

      if (mediaRecorderRef.current.state === "paused") {
        mediaRecorderRef.current.resume();
        logDebug("✅ Resume: MediaRecorder resumed");
      }

      clearRecognitionRestart();
      void startRecognition();
      if (pauseStartedAt) {
        const pauseDuration = Math.max(0, Math.round((Date.now() - pauseStartedAt) / 1000));
        logDebug(`📊 Resume: Paused for ${pauseDuration} seconds`);
        setPauseSeconds((current) => current + pauseDuration);
      }
      setPauseStartedAt(null);
      startTimer();
      setIsPaused(false);
      toast.success("Recording resumed");
    } catch (error) {
      console.error("❌ Resume error:", error);
      toast.error("Failed to resume recording");
    }
  }, [clearRecognitionRestart, logDebug, pauseStartedAt, sessionId, startRecognition, startTimer]);

  const stopRecording = async () => {
    if (!sessionId) return;

    try {
      recognitionShouldRunRef.current = false;
      clearRecognitionRestart();
      setSpeechEngineStatus("idle");
      setSpeechEngineError(null);

      logDebug("⏹️  User clicked stop button");

      // Stop media recorder (voice mode only)
      if (recordingMode === "voice" && mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
          logDebug("✅ Stopping: MediaRecorder stopped");
        }
        mediaRecorderRef.current.stream.getTracks().forEach((track) => {
          track.stop();
          logDebug("✅ Stopping: Audio track stopped:", track.label);
        });

        // Stop speech recognition
        stopRecognition();

        // Stop audio meter
        stopAudioMeter();

        logDebug("📊 Recording: Total bytes captured:", bytesRecorded);
        logDebug("📊 Recording: Audio chunks collected:", audioChunksRef.current.length);
      } else if (recordingMode === "text") {
        logDebug("📊 Text Mode: Transcription length:", transcription.length);
      }

      // Stop timer
      stopTimer();

      setIsRecording(false);
      setIsPaused(false);

      // End session
      await endSession({
        sessionId: sessionId as Id<"studyClassSessions">,
        durationMinutes: Math.max(1, Math.round((elapsedTime - pauseSeconds) / 60)),
      });
      logDebug("✅ Session: Ended in backend");

      // Create note with transcription
      const processedTranscription = applyTranscriptionQuality(transcription);
      if (processedTranscription.trim()) {
        const { topics } = extractTopicsFromTranscription(processedTranscription, subject);

        setIsTranscribing(true);
        await createNote({
          sessionId: sessionId as Id<"studyClassSessions">,
          userId,
          rawTranscription: processedTranscription,
          subject,
          topics,
          recordingMarkers,
          transcriptStats: {
            totalSeconds: elapsedTime,
            pauseSeconds: pauseSeconds + (pauseStartedAt ? Math.max(0, Math.round((Date.now() - pauseStartedAt) / 1000)) : 0),
            markerCount: recordingMarkers.length,
          },
        });
        logDebug("✅ Note: Created with", topics.length, "topics");

        setIsTranscribing(false);
        toast.success(
          `Study note created with ${topics.length} topics identified`
        );

        // Reset form
        setTranscription("");
        setTranscriptConfidence(null);
        setLowConfidenceSegments([]);
        setCorrectionTarget(null);
        setCorrectionValue("");
        setCorrectionHistory([]);
        setSessionId(null);
        setBytesRecorded(0);
        clearDraft();
      } else {
        logDebug("⚠️  Note: No transcription captured");
        toast.error("No transcription captured");
      }
    } catch (error) {
      console.error("❌ Stop recording error:", error);
      toast.error("Failed to stop recording");
    } finally {
      setIsRecording(false);
      setIsPaused(false);
      setSpeechEngineStatus("idle");
    }
  };

  const discardRecording = async () => {
    if (!sessionId) return;

    try {
      logDebug("🗑️  Discard: User discarded recording");
      recognitionShouldRunRef.current = false;
      clearRecognitionRestart();
      setSpeechEngineStatus("idle");
      setSpeechEngineError(null);

      // Clean up media recorder (voice mode only)
      if (recordingMode === "voice" && mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
          logDebug("✅ Discarding: MediaRecorder stopped");
        }
        mediaRecorderRef.current.stream.getTracks().forEach((track) => {
          track.stop();
          logDebug("✅ Discarding: Audio track stopped");
        });

        stopRecognition();
        stopAudioMeter();
      }

      stopTimer();

      await discardSession({
        sessionId: sessionId as Id<"studyClassSessions">,
      });
      logDebug("✅ Discard: Session discarded in backend");

      setIsRecording(false);
      setIsPaused(false);
      setTranscription("");
      setRecordingMarkers([]);
      setPauseStartedAt(null);
      setPauseSeconds(0);
      setLastSpeechAt(0);
      setElapsedTime(0);
      setSessionId(null);
      setBytesRecorded(0);
      setTranscriptConfidence(null);
      setConfidenceHistory([]);
      setLowConfidenceSegments([]);
      setCorrectionTarget(null);
      setCorrectionValue("");
      setCorrectionHistory([]);
      clearDraft();

      toast.info("Recording discarded and reset.");
    } catch (error) {
      console.error("❌ Discard error:", error);
      toast.error("Failed to discard recording");
    } finally {
      setIsRecording(false);
      setIsPaused(false);
      setSpeechEngineStatus("idle");
    }
  };

  const speechStatusToneClass =
    speechEngineStatus === "listening"
      ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
      : speechEngineStatus === "starting" || speechEngineStatus === "restarting"
        ? "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
        : speechEngineStatus === "error" || speechEngineStatus === "unsupported"
          ? "border-red-300 text-red-700 dark:border-red-700 dark:text-red-300"
          : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300";

  const speechStatusLabel =
    speechEngineStatus === "listening"
      ? "Speech Engine: Listening"
      : speechEngineStatus === "starting"
        ? "Speech Engine: Starting"
        : speechEngineStatus === "restarting"
          ? "Speech Engine: Reconnecting"
          : speechEngineStatus === "error"
            ? "Speech Engine: Error"
            : speechEngineStatus === "unsupported"
              ? "Speech Engine: Unsupported"
              : "Speech Engine: Idle";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("study-notes:recognition-language", recognitionLanguage);
  }, [recognitionLanguage]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const addMarker = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;

    setRecordingMarkers((current) => [
      ...current,
      {
        label: trimmed,
        markerType,
        elapsedSeconds: elapsedTime,
        createdAt: Date.now(),
      },
    ]);
    toast.success(`Marker added at ${formatTime(elapsedTime)}`);
  };

  useEffect(() => {
    if (!isRecording || isPaused) return;

    const lastActivityAt = Math.max(lastSpeechAt, lastAudioActivityAt);
    if (!lastActivityAt) return;

    const silenceThresholdSeconds = autoPauseThresholdSeconds;
    const silentFor = Math.max(0, Date.now() - lastActivityAt) / 1000;
    const timeoutId = window.setTimeout(() => {
      void pauseRecording();
      toast.message("Auto-paused after extended silence. Resume when you are ready.");
    }, Math.max(0, (silenceThresholdSeconds - silentFor) * 1000));

    return () => window.clearTimeout(timeoutId);
  }, [elapsedTime, isRecording, isPaused, lastSpeechAt, lastAudioActivityAt, autoPauseThresholdSeconds, pauseRecording]);

  useEffect(() => {
    return () => {
      recognitionShouldRunRef.current = false;
      clearRecognitionRestart();
      stopTimer();
      stopAudioMeter();

      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore cleanup errors.
      }

      const mediaRecorder = mediaRecorderRef.current;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        try {
          mediaRecorder.stop();
        } catch {
          // Ignore cleanup errors.
        }
      }

      mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
    };
  }, [clearRecognitionRestart, stopAudioMeter, stopTimer]);

  return (
    <div className="space-y-4">
      <Dialog open={Boolean(templateImportPreview)} onOpenChange={(open) => { if (!open) setTemplateImportPreview(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Template Import Preview</DialogTitle>
            <DialogDescription>
              Review import details before applying changes to your current template set.
            </DialogDescription>
          </DialogHeader>

          {templateImportPreview && (
            <div className="space-y-2 text-sm">
              {(() => {
                const query = templateImportSearch.trim().toLowerCase();
                const filteredSamples = query
                  ? templateImportPreview.sampleTemplates.filter(
                      (template) =>
                        template.label.toLowerCase().includes(query) ||
                        template.content.toLowerCase().includes(query)
                    )
                  : templateImportPreview.sampleTemplates;
                const visibleSamples = showAllImportSamples ? filteredSamples : filteredSamples.slice(0, 5);

                return (
                  <>
              <p><strong>Mode:</strong> {templateImportPreview.mode === "merge" ? "Merge" : "Replace"}</p>
              <p><strong>Found in file:</strong> {templateImportPreview.foundInFileCount}</p>
              <p><strong>Valid entries:</strong> {templateImportPreview.validCount}</p>
              <p><strong>Duplicates inside file:</strong> {templateImportPreview.duplicateInFileCount}</p>
              {templateImportPreview.mode === "merge" ? (
                <>
                  <p><strong>Duplicates vs current templates:</strong> {templateImportPreview.duplicateAgainstExistingCount}</p>
                  <p><strong>New templates to add:</strong> {templateImportPreview.newToAddCount}</p>
                  <p><strong>Total templates after merge:</strong> {templateImportPreview.finalTemplates.length}</p>
                </>
              ) : (
                <>
                  <p><strong>Current templates to replace:</strong> {templateImportPreview.replacingExistingCount}</p>
                  <p><strong>Templates after replace:</strong> {templateImportPreview.finalTemplates.length}</p>
                </>
              )}

              <div className="mt-3 space-y-2">
                <Input
                  value={templateImportSearch}
                  onChange={(event) => setTemplateImportSearch(event.target.value)}
                  placeholder="Search preview templates by label or content"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Showing {visibleSamples.length} of {filteredSamples.length} matched templates
                  {templateImportSearch.trim() ? ` for "${templateImportSearch.trim()}"` : ""}.
                </p>
              </div>

              {filteredSamples.length > 0 && (
                <div className="mt-3 rounded-md border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Sample Templates ({visibleSamples.length} of {filteredSamples.length})
                    </p>
                    {filteredSamples.length > 5 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setShowAllImportSamples((current) => !current)}
                      >
                        {showAllImportSamples ? "Show less" : "Show all"}
                      </Button>
                    )}
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {visibleSamples.map((template, index) => (
                      <div
                        key={`${template.label}-${index}`}
                        className="border-b border-slate-100 px-3 py-2 last:border-b-0 dark:border-slate-800"
                      >
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{template.label}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{template.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {filteredSamples.length === 0 && (
                <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  No templates match this search.
                </div>
              )}
                  </>
                );
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={cancelTemplateImportPreview}>Cancel</Button>
            <Button onClick={applyTemplateImport}>Apply Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasRecoverableDraft && !isRecording && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900 dark:text-amber-100">A previous draft was found from an interrupted session.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={clearDraft}>Dismiss</Button>
              <Button size="sm" onClick={restoreDraft}>Restore Draft</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recording Mode Selection */}
      {!isRecording && (
        <Card className="border-purple-200 bg-purple-50/70 dark:border-purple-900 dark:bg-purple-950/30">
          <CardContent className="space-y-3 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-2">Recording Mode</p>
                <div className="flex gap-2">
                  {(["voice", "text"] as RecordingMode[]).map((mode) => (
                    <Button
                      key={mode}
                      variant={recordingMode === mode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRecordingMode(mode)}
                      className="capitalize"
                    >
                      {mode === "voice" ? "🎤 Voice" : "✏️ Text"}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplateManager(!showTemplateManager)}
                className="gap-2"
              >
                📋 Manage Templates ({templates.length})
              </Button>
            </div>

            {/* Template Manager Modal */}
            {showTemplateManager && (
              <div className="border-t border-purple-200 pt-3 dark:border-purple-700">
                <div className="space-y-3">
                  <div className="rounded-md border border-purple-200 bg-white p-2 dark:border-purple-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Starter pack: {starterLanguageLabel}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={loadStarterTemplates}>
                          Load Starter Templates
                        </Button>
                        <Button size="sm" variant="outline" onClick={replaceWithStarterTemplates}>
                          Replace with Starter Pack
                        </Button>
                        <select
                          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                          value={templateImportMode}
                          onChange={(event) => setTemplateImportMode(event.target.value as TemplateImportMode)}
                          aria-label="Template import mode"
                        >
                          <option value="replace">Import: Replace</option>
                          <option value="merge">Import: Merge</option>
                        </select>
                        <Button size="sm" variant="outline" onClick={exportTemplates}>
                          Export
                        </Button>
                        <Button size="sm" variant="outline" onClick={openTemplateImportDialog}>
                          Import
                        </Button>
                      </div>
                    </div>
                    <input
                      ref={templateImportInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={importTemplates}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Template Label</label>
                    <Input
                      placeholder="e.g., 'Review This'"
                      value={templateInputLabel}
                      onChange={(e) => setTemplateInputLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Template Content</label>
                    <textarea
                      className="h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      placeholder="Text to insert when template is used"
                      value={templateInputContent}
                      onChange={(e) => setTemplateInputContent(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={createTemplate} className="flex-1">
                      {templateEditing ? "Update Template" : "Add Template"}
                    </Button>
                    {templateEditing && (
                      <Button size="sm" variant="outline" onClick={cancelTemplateEdit}>
                        Cancel
                      </Button>
                    )}
                  </div>

                  {templates.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium">Your Templates:</p>
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {templates.map((template) => (
                          <div
                            key={template.id}
                            className="flex items-center justify-between rounded-sm border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
                          >
                            <div className="flex-1 overflow-hidden">
                              <p className="truncate text-xs font-medium">{template.label}</p>
                              <p className="truncate text-xs text-slate-500">{template.content}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => editTemplate(template)}
                                className="h-6 w-6 p-0 text-xs"
                              >
                                ✎
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTemplate(template.id)}
                                className="h-6 w-6 p-0 text-xs text-red-600"
                              >
                                ✕
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isRecording && (
        <Card className="border-cyan-200 bg-cyan-50/70 dark:border-cyan-900 dark:bg-cyan-950/30">
          <CardContent className="space-y-3 pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">Class Mode Preset</p>
              <Badge variant="secondary">Preferred Export: {preferredExportFormat.toUpperCase()}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Preset</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={selectedPresetId}
                  onChange={(event) => applyClassPreset(event.target.value)}
                >
                  {CLASS_MODE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.label} ({preset.subjectHint})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Auto-Pause (seconds)</label>
                <Input
                  type="number"
                  min={30}
                  max={300}
                  value={autoPauseThresholdSeconds}
                  onChange={(event) => setAutoPauseThresholdSeconds(Math.max(30, Math.min(300, Number(event.target.value) || 120)))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Default Marker Type</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={markerType}
                  onChange={(event) => setMarkerType(event.target.value as MarkerType)}
                >
                  {(["Exam", "Definition", "Formula", "Action Item", "General"] as MarkerType[]).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session Setup */}
      {!isRecording && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Class Name</label>
            <Input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g., Linear Algebra Lecture"
              disabled={isRecording}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Professor</label>
            <Input
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="Optional"
              disabled={isRecording}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subject</label>
            <Badge variant="secondary" className="mt-2">
              {subject}
            </Badge>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Transcription Language</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={recognitionLanguage}
              onChange={(event) => handleRecognitionLanguageChange(event.target.value as RecognitionLanguage)}
            >
              {RECOGNITION_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Default is English. Mixed mode helps with code-switching but is less accurate than a single language.
            </p>
          </div>
          <div className="md:col-span-4">
            <label className="block text-sm font-medium mb-1">Priority Vocabulary (comma-separated)</label>
            <Input
              value={customVocabularyInput}
              onChange={(event) => setCustomVocabularyInput(event.target.value)}
              placeholder="e.g., sepsis, troponin, metoprolol, hemoglobin A1c"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Terms listed here are preserved during transcript cleanup to reduce mistakes on key names.
            </p>
          </div>
        </div>
      )}

      {/* Recording Control */}
      <Card className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              {isRecording ? (
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse"}`} />
                  <span className="text-2xl font-mono font-bold">
                    {formatTime(elapsedTime)}
                  </span>
                </div>
              ) : (
                <span className="text-slate-600 dark:text-slate-400">
                  Ready to record
                </span>
              )}
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Badge variant="outline" className={`w-fit gap-2 ${speechStatusToneClass}`}>
              {speechEngineStatus === "listening" && <CheckCircle2 className="h-3.5 w-3.5" />}
              {(speechEngineStatus === "starting" || speechEngineStatus === "restarting") && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {(speechEngineStatus === "error" || speechEngineStatus === "unsupported") && <AlertTriangle className="h-3.5 w-3.5" />}
              {speechEngineStatus === "idle" && <Mic className="h-3.5 w-3.5" />}
              <span>{speechStatusLabel}</span>
            </Badge>
            {!isRecording && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={runPreflightCheck}
                disabled={isRunningPreflight || isTranscribing}
              >
                {isRunningPreflight ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
                {isRunningPreflight ? "Running Pre-Flight" : "Test Mic + Transcription"}
              </Button>
            )}
          </div>

          {transcriptConfidence !== null && (
            <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
              <p className="font-medium text-slate-700 dark:text-slate-200">
                Transcript confidence: {Math.round(transcriptConfidence * 100)}%
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                Review flagged phrases before finalizing when confidence is below 80%.
              </p>
            </div>
          )}

          {confidenceHistory.length > 0 ? (
            <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-slate-700 dark:text-slate-200">Confidence trend</p>
                <span className="text-slate-500 dark:text-slate-400">
                  Avg {recentConfidenceAverage !== null ? `${Math.round(recentConfidenceAverage * 100)}%` : "n/a"}
                </span>
              </div>
              <div className="mt-2 flex h-10 items-end gap-1">
                {confidenceHistory.slice(-16).map((value, index) => (
                  <div
                    key={`${index}-${value}`}
                    className="min-w-0 flex-1 rounded-t bg-sky-500/70"
                    style={{ height: `${Math.max(6, Math.round(value * 40))}px` }}
                    title={`${Math.round(value * 100)}%`}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {lowConfidenceSegments.length > 0 ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">Review suggested for low-confidence phrases:</p>
                <div className="flex flex-wrap gap-1">
                  {([
                    ["all", "All"],
                    ["high-impact", "High impact"],
                    ["strict", "Strict"],
                  ] as const).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={reviewSuite === value ? "default" : "outline"}
                      onClick={() => setReviewSuite(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <ul className="mt-1 space-y-1">
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
                        className="w-full truncate rounded border border-amber-300/70 px-2 py-1 text-left hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/20"
                      >
                        • {segment.text}
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => ignoreFlagPhrase(segment.text)}
                        className="h-7 px-2 text-[10px]"
                      >
                        Ignore
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => selectMatchingFlags(segment.text)}
                        className="h-7 px-2 text-[10px]"
                      >
                        Match
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addPhraseToVocabulary(segment.text)}
                        className="h-7 px-2 text-[10px]"
                      >
                        Vocab
                      </Button>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-amber-700 dark:text-amber-300">
                      {Math.round(segment.confidence * 100)}% confidence
                      {segment.issues.length > 0 ? ` • ${segment.issues.join(", ")}` : ""}
                    </p>
                  </li>
                ))}
                {displayedLowConfidenceSegments.length === 0 && (
                  <li className="text-[11px] text-amber-700 dark:text-amber-300">No high-impact phrases in current flags.</li>
                )}
              </ul>
            </div>
          ) : null}

          {lowConfidenceSegments.length > 0 ? (
            <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
              <p className="font-medium text-slate-700 dark:text-slate-200">Batch actions</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={selectAllFlags}>Select all</Button>
                <Button type="button" size="sm" variant="outline" onClick={clearSelectedFlags}>Clear</Button>
                <Button type="button" size="sm" variant="outline" onClick={batchIgnoreSelected}>Ignore selected</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => activeFlag && selectMatchingFlags(activeFlag.text)}
                  disabled={!activeFlag}
                >
                  Select Active Matches
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={batchReplaceValue}
                  onChange={(event) => setBatchReplaceValue(event.target.value)}
                  placeholder="Batch replacement text"
                />
                <Button type="button" size="sm" variant="outline" onClick={batchReplaceSelected}>Replace selected</Button>
              </div>
              {selectedBatchPreview.length > 0 ? (
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200">Replacement preview</p>
                  <div className="mt-1 max-h-16 space-y-1 overflow-y-auto text-[11px] text-slate-600 dark:text-slate-300">
                    {selectedBatchPreview.map((item) => (
                      <p key={item.text} className="truncate">
                        {item.text}{" -> "}{item.matches} match(es)
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">Selected: {selectedFlagKeys.length}</p>
            </div>
          ) : null}

          {weakPhraseTrends.length > 0 ? (
            <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
              <p className="font-medium text-slate-700 dark:text-slate-200">Weak phrase trends</p>
              <div className="mt-1 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                {weakPhraseTrends.map((item) => (
                  <p key={item.phrase} className="truncate">
                    {item.phrase} • {item.count}x • min {Math.round(item.minConfidence * 100)}%
                    {item.issues.length > 0 ? ` • ${item.issues.join(", ")}` : ""}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
            <p className="font-medium text-slate-700 dark:text-slate-200">Vocabulary auto-promote</p>
            <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={autoPromoteVocabulary}
                onChange={(event) => setAutoPromoteVocabulary(event.target.checked)}
              />
              Auto-add corrected phrases to vocabulary
            </label>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-300">Threshold</span>
              <Input
                type="number"
                min={1}
                max={10}
                value={autoPromoteThreshold}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next)) return;
                  setAutoPromoteThreshold(Math.max(1, Math.min(10, Math.round(next))));
                }}
                className="h-8 w-20"
              />
            </div>
          </div>

          {transcription.trim().length > 0 && (
            <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-slate-700 dark:text-slate-200">Confidence heatmap</p>
                {lowConfidenceSegments.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-300">
                      Flag {Math.min(activeFlagIndex + 1, navigableLowConfidenceSegments.length)}/{navigableLowConfidenceSegments.length}
                    </span>
                    <Button type="button" size="sm" variant="outline" onClick={() => cycleActiveFlag(-1)}>Prev</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => cycleActiveFlag(1)}>Next</Button>
                    {activeFlag && (
                      <Button type="button" size="sm" variant="outline" onClick={() => openCorrectionEditor(activeFlag.text)}>
                        Edit Active
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed text-slate-600 dark:text-slate-300">
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
                      className={`rounded px-1 ${isActive ? "bg-amber-300 text-amber-900 dark:bg-amber-700 dark:text-amber-50" : "bg-amber-200 text-amber-900 dark:bg-amber-800/70 dark:text-amber-100"}`}
                      title={`Flagged (${Math.round(part.flagged.confidence * 100)}%): ${part.flagged.issues.join(", ") || "review"}`}
                    >
                      {part.text}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(isRecording || lowConfidenceSegments.length > 0) && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => insertSpeakerTag("Instructor")}>Tag Instructor</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => insertSpeakerTag("Student")}>Tag Student</Button>
              <Button type="button" size="sm" variant="outline" onClick={copyQualityPack} className="gap-1">
                <ClipboardList className="h-3.5 w-3.5" />Copy QA Pack
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={acceptAllCleanups}>
                Accept All Cleanups
              </Button>
              {ignoredFlagPhrases.length > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={clearIgnoredFlags}>
                  Reset Ignored
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={undoLastCorrection}
                disabled={correctionHistory.length === 0}
                className="gap-1"
              >
                <Undo2 className="h-3.5 w-3.5" />Undo Last
              </Button>
            </div>
          )}

          {(isRecording || lowConfidenceSegments.length > 0) && (
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Shortcuts: Alt+N next flag, Alt+P previous flag, Alt+E edit active flag, Alt+S select active matches, Alt+A accept all cleanups.
            </p>
          )}

          {correctionTarget && (
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              <p className="font-medium">Correct phrase</p>
              <p className="mt-1 truncate text-[11px] text-blue-700 dark:text-blue-300">Original: {correctionTarget}</p>
              <Input
                value={correctionValue}
                onChange={(event) => setCorrectionValue(event.target.value)}
                className="mt-2"
                placeholder="Replace with correct text"
              />
              <label className="mt-2 flex items-center gap-2 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                <input
                  type="checkbox"
                  checked={replaceAllCorrections}
                  onChange={(event) => setReplaceAllCorrections(event.target.checked)}
                />
                Replace all occurrences
              </label>
              <div className="mt-2 flex gap-2">
                <Button type="button" size="sm" onClick={applyCorrection}>Apply</Button>
                <Button type="button" size="sm" variant="outline" onClick={closeCorrectionEditor}>Cancel</Button>
              </div>
            </div>
          )}

          {ignoredFlagPhrases.length > 0 && (
            <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-slate-700 dark:text-slate-200">Ignored flagged phrases</p>
                <Button type="button" size="sm" variant="outline" onClick={clearIgnoredFlags}>Clear</Button>
              </div>
              <p className="mt-1 truncate text-slate-500 dark:text-slate-300">{ignoredFlagPhrases.join(" • ")}</p>
            </div>
          )}

          {correctionHistory.length > 0 && (
            <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
              <p className="font-medium text-slate-700 dark:text-slate-200">Correction history</p>
              <div className="mt-1 max-h-24 space-y-1 overflow-y-auto">
                {correctionHistory.slice(0, 5).map((entry) => (
                  <p key={`${entry.at}-${entry.target}`} className="truncate text-slate-500 dark:text-slate-300">
                    {new Date(entry.at).toLocaleTimeString()} - {entry.target}{" -> "}{entry.replacement}
                  </p>
                ))}
              </div>
            </div>
          )}

          {recordingMode === "voice" && (
            <div className="mb-4 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
              <label className="mb-1 block text-xs font-medium">Live Language</label>
              <select
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={recognitionLanguage}
                onChange={(event) => handleRecognitionLanguageChange(event.target.value as RecognitionLanguage)}
              >
                {RECOGNITION_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isRecording && preflightResult && (
            <div className="mb-4 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {preflightResult}
            </div>
          )}

          {!isRecording && speechEngineError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {speechEngineError}
            </div>
          )}

          {isRecording && recordingMode === "voice" && (
            <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm font-medium mb-2">Live Transcription:</p>
              <div className="max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                <p className="whitespace-pre-wrap italic">
                  {isPaused ? "Paused for break" : transcription || "Listening..."}
                </p>
              </div>
            </div>
          )}

          {isRecording && recordingMode === "text" && (
            <div className="mb-4 space-y-2">
              <label className="text-sm font-medium">Type Your Notes:</label>
              <textarea
                className="h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="Type your notes here... (They will be captured with timestamps)"
                value={transcription}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setTranscription(nextValue);
                  applyTranscriptionQuality(nextValue);
                }}
              />
              {templates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Quick Insert Templates:</p>
                  <div className="flex flex-wrap gap-2">
                    {templates.map((template) => (
                      <Button
                        key={template.id}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => insertTemplate(template.content)}
                        className="text-xs"
                      >
                        {template.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {templates.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  No templates yet. Open Manage Templates and click Load Starter Templates for {starterLanguageLabel}.
                </div>
              )}
            </div>
          )}

          {isRecording && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={markerLabel}
                  onChange={(event) => setMarkerLabel(event.target.value)}
                  placeholder="Marker label"
                  className="sm:flex-1"
                />
                  <select
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={markerType}
                    onChange={(event) => setMarkerType(event.target.value as MarkerType)}
                  >
                    {(["Exam", "Definition", "Formula", "Action Item", "General"] as MarkerType[]).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                <Button type="button" variant="outline" onClick={() => addMarker(markerLabel)} className="gap-2">
                  <BookmarkPlus className="h-4 w-4" />
                  Add Marker
                </Button>
              </div>
              {recordingMarkers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recordingMarkers.map((marker) => (
                    <Badge key={`${marker.createdAt}-${marker.elapsedSeconds}`} variant="secondary" className="gap-1">
                      <span>{formatTime(marker.elapsedSeconds)}</span>
                      <span>•</span>
                      <span>{marker.markerType}</span>
                      <span>•</span>
                      <span>{marker.label}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                size="lg"
                className="flex-1 gap-2"
                disabled={isTranscribing}
              >
                <Mic className="w-5 h-5" />
                Start Recording
              </Button>
            ) : (
              <>
                <Button
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  size="lg"
                  variant={isPaused ? "default" : "outline"}
                  className="flex-1 gap-2"
                >
                  <Mic className="w-5 h-5" />
                  {isPaused ? "Resume Recording" : "Pause Recording"}
                </Button>
                <Button
                  onClick={stopRecording}
                  size="lg"
                  variant="destructive"
                  className="flex-1 gap-2"
                >
                  <StopCircle className="w-5 h-5" />
                  Stop Recording
                </Button>
                <Button
                  onClick={discardRecording}
                  size="lg"
                  variant="outline"
                  className="flex-1 gap-2 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                >
                  Reset
                </Button>
              </>
            )}
          </div>

          {isTranscribing && (
            <div className="mt-3 p-2 bg-blue-100 dark:bg-blue-900 rounded text-sm text-blue-800 dark:text-blue-200">
              Processing transcription...
            </div>
          )}

          {isRecording && isPaused && (
            <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-950/30 rounded text-sm text-amber-800 dark:text-amber-200">
              Recording is paused. Resume when you return from break.
            </div>
          )}

          {isRecording && (
            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-4">
              <p>Markers: {recordingMarkers.length}</p>
              <p>Paused time: {Math.max(0, pauseSeconds)}s</p>
              {transcriptConfidence !== null && (
                <p>Confidence: {Math.round(transcriptConfidence * 100)}%</p>
              )}
              {recordingMode === "voice" && (
                <>
                  <p>Audio quality: {audioQuality}</p>
                  <p>Bytes recorded: {(bytesRecorded / 1024).toFixed(1)} KB</p>
                </>
              )}
              {recordingMode === "text" && (
                <p>Text length: {transcription.length} chars</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-slate-50 dark:bg-slate-800">
        <CardContent className="pt-6">
          <p className="text-sm font-semibold mb-2">💡 {recordingMode === "voice" ? "Recording" : "Typing"} Tips:</p>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            {recordingMode === "voice" && (
              <>
                <li>• Speak clearly and at a natural pace</li>
                <li>• Topics will be automatically extracted from your recording</li>
                <li>• You can edit and organize the transcription after</li>
                <li>• Longer recordings get better topic organization</li>
              </>
            )}
            {recordingMode === "text" && (
              <>
                <li>• Type your notes and ideas naturally</li>
                <li>• Use templates to quickly insert common phrases</li>
                <li>• Add markers to highlight important sections</li>
                <li>• Topics will be extracted from your typed text</li>
              </>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
